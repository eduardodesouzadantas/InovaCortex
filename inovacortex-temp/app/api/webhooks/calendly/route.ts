import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MeetingIntelligenceService } from "@/lib/services/meeting-intelligence";
import crypto from "crypto";

// ─── Simple in-memory rate limiter (per IP, resets with cold start) ───────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 30;

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || entry.resetAt < now) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return true;
    }
    if (entry.count >= MAX_REQUESTS) return false;
    entry.count++;
    return true;
}

// ─── Calendly HMAC signature verification ────────────────────────────────────
async function verifyCalendlySignature(req: Request, rawBody: string): Promise<boolean> {
    const webhookSecret = process.env.WEBHOOK_SECRET_CALENDLY;
    if (!webhookSecret) return false;

    const signature = req.headers.get("Calendly-Webhook-Signature");

    // Calendly uses "t=<timestamp>,v1=<hmac>" format
    if (signature) {
        const parts = Object.fromEntries(
            signature.split(",").map(p => p.split("=") as [string, string])
        );
        const timestamp = parts["t"];
        const v1 = parts["v1"];
        if (!timestamp || !v1) return false;

        const toSign = `${timestamp}.${rawBody}`;
        const expected = crypto.createHmac("sha256", webhookSecret).update(toSign).digest("hex");
        return crypto.timingSafeEqual(Buffer.from(v1, "hex"), Buffer.from(expected, "hex"));
    }

    // Fallback: query param ?secret=...
    const url = new URL(req.url);
    const querySecret = url.searchParams.get("secret");
    if (querySecret) {
        return crypto.timingSafeEqual(
            Buffer.from(querySecret),
            Buffer.from(webhookSecret)
        );
    }

    return false;
}

// ─── Calendly Payload Parser ──────────────────────────────────────────────────
interface CalendlyEvent {
    event: string;          // "invitee.created" | "invitee.canceled"
    payload: {
        event: string;      // event URI
        invitee: string;    // invitee URI
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
        new_invitee?: string;  // URI of new meeting if rescheduled
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
        externalEventId: p.invitee ?? p.event,  // use invitee URI as stable unique ID
        eventUri: p.event,
        canceled: p.canceled ?? false,
        rescheduled: p.rescheduled ?? false,
        newInviteeUri: p.new_invitee ?? null,
    };
}

// ─── Resolve orgId ──────────────────────────────────────────────────────────
async function resolveOrgId(): Promise<string | null> {
    // For now, resolve by finding the first org. 
    // In multi-tenant V2, webhook payload metadata or custom field could carry orgSlug.
    const org = await (prisma as any).organization.findFirst({
        orderBy: { createdAt: "asc" }
    });
    return org?.id ?? null;
}

// ─── Idempotent session upsert ───────────────────────────────────────────────
async function upsertMeetingSession(orgId: string, data: ReturnType<typeof parseCalendlyPayload>) {
    const existing = await (prisma as any).meetingSession.findFirst({
        where: { organizationId: orgId, externalEventId: data.externalEventId }
    });
    return existing ?? null;
}

// ─── Main Route Handler ──────────────────────────────────────────────────────
export async function POST(req: Request) {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";

    if (!checkRateLimit(ip)) {
        return new NextResponse("Too Many Requests", { status: 429 });
    }

    const rawBody = await req.text();

    const isValid = await verifyCalendlySignature(req, rawBody);
    if (!isValid) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    let body: CalendlyEvent;
    try {
        body = JSON.parse(rawBody);
    } catch {
        return new NextResponse("Bad Request: invalid JSON", { status: 400 });
    }

    const eventType = body.event;
    const parsed = parseCalendlyPayload(body);

    const orgId = await resolveOrgId();
    if (!orgId) {
        return new NextResponse("Organization not found", { status: 500 });
    }

    const ctx = { orgId, userId: "webhook:calendly" };

    // Audit: webhook received
    await (prisma as any).auditEvent.create({
        data: {
            organizationId: orgId,
            action: "calendlyWebhookReceived",
            userId: "webhook:calendly",
            resourceType: "meeting_session",
            resourceId: parsed.externalEventId,
            details: `event=${eventType}`,
            ipAddress: ip
        }
    });

    // Handle invitee.created (scheduled)
    if (eventType === "invitee.created" && !parsed.canceled && !parsed.rescheduled) {
        const existing = await upsertMeetingSession(orgId, parsed);
        if (existing) {
            // Already processed — idempotent skip
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

        return NextResponse.json({ ok: true, action: "scheduled" });
    }

    // Handle cancellation  
    if (eventType === "invitee.canceled" || parsed.canceled) {
        const existing = await upsertMeetingSession(orgId, parsed);
        if (existing) {
            await (prisma as any).meetingSession.update({
                where: { id: existing.id },
                data: { status: "canceled" }
            });
        }
        await MeetingIntelligenceService.handleMeetingCanceled({
            externalEventId: parsed.externalEventId,
            organizationId: orgId
        }, ctx);

        await (prisma as any).auditEvent.create({
            data: {
                organizationId: orgId,
                action: "meetingCanceled",
                userId: "webhook:calendly",
                resourceType: "meeting_session",
                resourceId: parsed.externalEventId,
                ipAddress: ip
            }
        });

        return NextResponse.json({ ok: true, action: "canceled" });
    }

    // Handle reschedule (update existing + schedule new, if Calendly sends it)
    if (parsed.rescheduled || eventType === "invitee.rescheduled") {
        const existing = await upsertMeetingSession(orgId, parsed);
        if (existing) {
            await (prisma as any).meetingSession.update({
                where: { id: existing.id },
                data: { status: "canceled" }
            });
        }
        // Treat as new scheduled meeting
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
                userId: "webhook:calendly",
                resourceType: "meeting_session",
                resourceId: parsed.externalEventId,
                ipAddress: ip
            }
        });

        return NextResponse.json({ ok: true, action: "rescheduled" });
    }

    // Unknown event type — log and return OK to avoid Calendly retries
    return NextResponse.json({ ok: true, action: "ignored", event: eventType });
}
