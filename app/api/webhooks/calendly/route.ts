import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MeetingIntelligenceService } from "@/lib/services/meeting-intelligence";
import {
    logWebhookFailure,
    logWebhookProcessed,
    logWebhookReceived,
    logWebhookRejected,
    parseWebhookJson,
    resolveCalendlyWebhookSecret,
    verifyCalendlySignature,
} from "@/lib/webhooks/security";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || entry.resetAt < now) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return true;
    }
    if (entry.count >= MAX_REQUESTS) return false;
    entry.count += 1;
    return true;
}

interface CalendlyEvent {
    event: string;
    payload: {
        event: string;
        invitee: string;
        event_start_time: string;
        event_end_time: string;
        timezone: string;
        invitee_email: string;
        invitee_name?: string;
        text_reminder_number?: string;
        cancel_url?: string;
        reschedule_url?: string;
        canceled?: boolean;
        canceler_name?: string;
        rescheduled?: boolean;
        new_invitee?: string;
    };
}

function parseCalendlyPayload(body: CalendlyEvent) {
    const p = body.payload;
    return {
        email: p.invitee_email,
        name: p.invitee_name ?? "",
        phone: p.text_reminder_number ?? null,
        startAt: p.event_start_time,
        endAt: p.event_end_time,
        timezone: p.timezone ?? "America/Sao_Paulo",
        externalEventId: p.invitee ?? p.event,
        eventUri: p.event,
        canceled: p.canceled ?? false,
        rescheduled: p.rescheduled ?? false,
        newInviteeUri: p.new_invitee ?? null,
    };
}

async function resolveOrgId(): Promise<string | null> {
    const org = await (prisma as any).organization.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true },
    });
    return org?.id ?? null;
}

async function upsertMeetingSession(orgId: string, data: ReturnType<typeof parseCalendlyPayload>) {
    const existing = await (prisma as any).meetingSession.findFirst({
        where: { organizationId: orgId, externalEventId: data.externalEventId },
        select: { id: true },
    });
    return existing ?? null;
}

async function POSTHandler(req: Request) {
    const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0]?.trim() || "unknown";

    if (!checkRateLimit(ip)) {
        logWebhookRejected("calendly", "rate_limited", { ip });
        return new NextResponse("Too Many Requests", { status: 429 });
    }

    const rawBody = await req.text();
    const webhookSecret = resolveCalendlyWebhookSecret();
    const signature = req.headers.get("Calendly-Webhook-Signature");

    if (!webhookSecret) {
        logWebhookFailure("calendly", "missing calendly webhook secret", { payloadBytes: rawBody.length });
        return new NextResponse("Calendly webhook not configured", { status: 503 });
    }

    if (!signature) {
        logWebhookRejected("calendly", "missing_signature", {
            header: "Calendly-Webhook-Signature",
            payloadBytes: rawBody.length,
            ip,
        });
        return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!verifyCalendlySignature(rawBody, signature, webhookSecret)) {
        logWebhookRejected("calendly", "invalid_signature", {
            header: "Calendly-Webhook-Signature",
            payloadBytes: rawBody.length,
            ip,
        });
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = parseWebhookJson<CalendlyEvent>(rawBody);
    if (!body?.event || !body.payload) {
        logWebhookRejected("calendly", "invalid_json_or_body", { payloadBytes: rawBody.length, ip });
        return new NextResponse("Bad Request: invalid JSON", { status: 400 });
    }

    logWebhookReceived("calendly", body, { payloadBytes: rawBody.length, ip });

    const eventType = body.event;
    const parsed = parseCalendlyPayload(body);
    const orgId = await resolveOrgId();
    if (!orgId) {
        logWebhookFailure("calendly", "organization not found", { eventType, ip });
        return new NextResponse("Organization not found", { status: 500 });
    }

    const ctx = { orgId, userId: "webhook:calendly" };

    await (prisma as any).auditEvent.create({
        data: {
            organizationId: orgId,
            action: "calendlyWebhookReceived",
            details: JSON.stringify({
                event: eventType,
                externalEventId: parsed.externalEventId,
                ip,
            }),
        },
    });

    if (eventType === "invitee.created" && !parsed.canceled && !parsed.rescheduled) {
        const existing = await upsertMeetingSession(orgId, parsed);
        if (existing) {
            logWebhookProcessed("calendly", body, { action: "scheduled", idempotent: true, sessionId: existing.id });
            return NextResponse.json({ ok: true, idempotent: true, sessionId: existing.id });
        }

        await MeetingIntelligenceService.handleMeetingScheduled({
            email: parsed.email,
            organizationId: orgId,
            startAt: parsed.startAt,
            endAt: parsed.endAt,
            timezone: parsed.timezone,
            externalEventId: parsed.externalEventId,
        }, ctx);

        logWebhookProcessed("calendly", body, { action: "scheduled" });
        return NextResponse.json({ ok: true, action: "scheduled" });
    }

    if (eventType === "invitee.canceled" || parsed.canceled) {
        const existing = await upsertMeetingSession(orgId, parsed);
        if (existing) {
            await (prisma as any).meetingSession.update({
                where: { id: existing.id },
                data: { status: "canceled" },
            });
        }

        await MeetingIntelligenceService.handleMeetingCanceled({
            externalEventId: parsed.externalEventId,
            organizationId: orgId,
        }, ctx);

        await (prisma as any).auditEvent.create({
            data: {
                organizationId: orgId,
                action: "meetingCanceled",
                details: JSON.stringify({
                    externalEventId: parsed.externalEventId,
                    ip,
                }),
            },
        });

        logWebhookProcessed("calendly", body, { action: "canceled" });
        return NextResponse.json({ ok: true, action: "canceled" });
    }

    if (parsed.rescheduled || eventType === "invitee.rescheduled") {
        const existing = await upsertMeetingSession(orgId, parsed);
        if (existing) {
            await (prisma as any).meetingSession.update({
                where: { id: existing.id },
                data: { status: "canceled" },
            });
        }

        await MeetingIntelligenceService.handleMeetingRescheduled({
            email: parsed.email,
            organizationId: orgId,
            startAt: parsed.startAt,
            endAt: parsed.endAt,
            timezone: parsed.timezone,
            externalEventId: parsed.newInviteeUri ?? parsed.externalEventId,
        }, ctx);

        await (prisma as any).auditEvent.create({
            data: {
                organizationId: orgId,
                action: "meetingRescheduled",
                details: JSON.stringify({
                    externalEventId: parsed.externalEventId,
                    ip,
                }),
            },
        });

        logWebhookProcessed("calendly", body, { action: "rescheduled" });
        return NextResponse.json({ ok: true, action: "rescheduled" });
    }

    logWebhookProcessed("calendly", body, { action: "ignored" });
    return NextResponse.json({ ok: true, action: "ignored", event: eventType });
}

export const POST = withApiLogging("/api/webhooks/calendly", "POST", POSTHandler);
