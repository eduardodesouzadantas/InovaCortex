/**
 * lib/orchestrator/executors/meeting-executor.ts
 * V16.3: Executes meeting-related ActionQueue items via WhatsApp
 *
 * Supported types: meeting_reminder_24h, meeting_reminder_1h,
 *   meeting_briefing_10m, meeting_followup_2h, meeting_followup_48h
 *
 * Deduplication: WhatsAppMessageLog has UNIQUE on actionQueueItemId.
 * Policy: checks META token, optional opt-out, rate limits.
 */

import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage, normalizePhone, isWhatsAppEnabled } from "@/lib/whatsapp";
import {
    buildMessageByKey,
    TemplateKey,
    MeetingTemplateInput
} from "@/lib/services/meeting-intelligence/meeting-templates";

const MEETING_ACTION_TYPES = new Set([
    "meeting_reminder_24h",
    "meeting_reminder_1h",
    "meeting_briefing_10m",
    "meeting_followup_2h",
    "meeting_followup_48h",
]);

const TEMPLATE_KEY_MAP: Record<string, TemplateKey> = {
    "meeting_reminder_24h": "meeting_reminder_24h",
    "meeting_reminder_1h": "meeting_reminder_1h",
    "meeting_briefing_10m": "meeting_reminder_1h",     // reuse 1h copy as briefing
    "meeting_followup_2h": "meeting_followup_2h",
    "meeting_followup_48h": "meeting_followup_48h",
};

export function isMeetingActionType(type: string): boolean {
    return MEETING_ACTION_TYPES.has(type);
}

export async function executeMeetingAction(item: any): Promise<{ success: boolean; reason?: string }> {
    const orgId = item.organizationId;
    const payload = JSON.parse(item.payloadJson || "{}");

    // ─── 1. Dedupe: bail if already have a log for this item ─────────────────
    const existingLog = await (prisma as any).whatsAppMessageLog.findUnique({
        where: { actionQueueItemId: item.id }
    });
    if (existingLog) {
        return { success: true, reason: "already_sent" };
    }

    // ─── 2. Load MeetingSession ──────────────────────────────────────────────
    const meetingId = payload.meetingId ?? payload.meetingSessionId;
    const session = meetingId
        ? await (prisma as any).meetingSession.findUnique({ where: { id: meetingId } })
        : null;

    const leadEmail = session?.leadEmail ?? payload.leadEmail ?? "";
    const toPhone: string | null = payload.phone ?? session?.phone ?? null;

    // ─── 3. Policy checks ────────────────────────────────────────────────────

    // 3a. Phone required
    if (!toPhone) {
        await logFailed(item, orgId, "", "no_phone", "Sem número de telefone para envio");
        return { success: false, reason: "no_phone" };
    }

    // 3b. Opt-out check (assessment.optOut if exists)
    if (leadEmail) {
        const assessment = await (prisma as any).assessment.findFirst({
            where: { organizationId: orgId, leadEmail }
        });
        if (assessment?.optOut === true) {
            await logFailed(item, orgId, toPhone, "opted_out", "Lead optou por não receber mensagens");
            return { success: false, reason: "opted_out" };
        }
    }

    // 3c. Rate limit: max 30 msgs/h per org
    const oneHourAgo = new Date(Date.now() - 3_600_000);
    const recentCount = await (prisma as any).whatsAppMessageLog.count({
        where: {
            organizationId: orgId,
            status: "sent",
            sentAt: { gte: oneHourAgo }
        }
    });
    if (recentCount >= 30) {
        await logFailed(item, orgId, toPhone, "rate_limited", "Rate limit: 30 msgs/h por org atingido");
        return { success: false, reason: "rate_limit" };
    }

    // ─── 4. Build Message ─────────────────────────────────────────────────────
    const templateKey = TEMPLATE_KEY_MAP[item.type] ?? "meeting_reminder_24h";
    const templateInput: MeetingTemplateInput = {
        leadName: payload.leadName ?? session?.leadName,
        leadPhone: normalizePhone(toPhone),
        startAt: session?.startAt ? new Date(session.startAt) : new Date(),
        timezone: session?.timezone ?? "America/Sao_Paulo",
        meetingUrl: session?.meetingUrl ?? payload.meetingUrl,
        rescheduleUrl: payload.rescheduleUrl,
        diagnosticoUrl: payload.diagnosticoUrl,
        propostaUrl: payload.propostaUrl,
    };
    const messageBody = buildMessageByKey(templateKey, templateInput);

    // ─── 5. Create log (queued) — this is the UNIQUE GUARD ───────────────────
    const log = await (prisma as any).whatsAppMessageLog.create({
        data: {
            organizationId: orgId,
            actionQueueItemId: item.id,
            toPhone: normalizePhone(toPhone),
            templateKey,
            status: "queued",
        }
    });

    // ─── 6. Send via WhatsApp ─────────────────────────────────────────────────
    if (!isWhatsAppEnabled) {
        // Stub mode — mark sent with stub id, no real message
        await (prisma as any).whatsAppMessageLog.update({
            where: { id: log.id },
            data: { status: "sent", waMessageId: `stub_${Date.now()}`, sentAt: new Date(), error: "stub/no_token" }
        });
        await audit(orgId, item.id, "notificationSent", `[STUB] ${templateKey} para ${toPhone}`);
        await markQueueItemDone(item.id);
        return { success: true, reason: "stub" };
    }

    const result = await sendWhatsAppMessage(normalizePhone(toPhone), messageBody);

    if (result.error || (!result.messageId && !result.stub)) {
        await (prisma as any).whatsAppMessageLog.update({
            where: { id: log.id },
            data: { status: "failed", error: result.error ?? "unknown", sentAt: new Date() }
        });
        await audit(orgId, item.id, "notificationFailed", result.error ?? "unknown");
        await markQueueItemFailed(item.id, result.error ?? "send_error");
        return { success: false, reason: result.error };
    }

    // Success
    await (prisma as any).whatsAppMessageLog.update({
        where: { id: log.id },
        data: { status: "sent", waMessageId: result.messageId, sentAt: new Date() }
    });
    await audit(orgId, item.id, "notificationSent", `${templateKey} → waMsgId=${result.messageId}`);
    await markQueueItemDone(item.id);
    return { success: true };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function logFailed(item: any, orgId: string, phone: string, templateKey: string, error: string) {
    try {
        await (prisma as any).whatsAppMessageLog.create({
            data: {
                organizationId: orgId,
                actionQueueItemId: item.id,
                toPhone: phone,
                templateKey: templateKey,
                status: "failed",
                error
            }
        });
    } catch { } // ignore if unique constraint already hit
    await audit(orgId, item.id, "notificationFailed", error);
    await markQueueItemFailed(item.id, error);
}

async function markQueueItemDone(id: string) {
    await (prisma as any).actionQueue.update({
        where: { id },
        data: { status: "executed", executedAt: new Date(), lockedByRunId: null, lockedUntil: null }
    });
}

async function markQueueItemFailed(id: string, reason: string) {
    const item = await (prisma as any).actionQueue.findUnique({ where: { id } });
    await (prisma as any).actionQueue.update({
        where: { id },
        data: { status: "rejected", reason, lockedByRunId: null, lockedUntil: null }
    });
}

async function audit(orgId: string, resourceId: string, action: string, details?: string) {
    await (prisma as any).auditEvent.create({
        data: {
            organizationId: orgId,
            action,
            userId: "system:meeting-executor",
            resourceType: "action_queue",
            resourceId,
            details,
            ipAddress: "system"
        }
    });
}
