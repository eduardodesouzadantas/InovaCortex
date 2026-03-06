/**
 * lib/orchestrator/executors/briefing-executor.ts
 * V16.3-P2: Sends a pre-meeting briefing to the org owner via WhatsApp.
 * Triggered by ActionQueue items with type = "generate_presales" / "briefing_10m".
 */

import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage, normalizePhone, isWhatsAppEnabled } from "@/lib/whatsapp";
import { buildBriefing } from "@/lib/services/meeting-intelligence/briefing-engine";

export async function executeBriefingAction(item: any): Promise<{ success: boolean; reason?: string }> {
    const orgId = item.organizationId;
    const payload = JSON.parse(item.payloadJson || "{}");

    // Only handle briefing types
    if (item.type !== "generate_presales" && item.type !== "briefing_10m") {
        return { success: false, reason: "not_a_briefing_type" };
    }

    const meetingSessionId = payload.meetingId ?? payload.meetingSessionId;

    // 1. Load OrgNotificationChannel
    const channel = await (prisma as any).orgNotificationChannel.findUnique({
        where: { organizationId: orgId }
    });

    const ownerPhone = channel?.ownerWhatsApp ?? null;

    if (!ownerPhone) {
        // Log and skip — owner hasn't configured their number
        await (prisma as any).auditEvent.create({
            data: {
                organizationId: orgId,
                action: "briefingSkipped",
                userId: "system:briefing-executor",
                resourceType: "action_queue",
                resourceId: item.id,
                details: "Owner phone not configured in OrgNotificationChannel.",
                ipAddress: "system"
            }
        });
        await (prisma as any).actionQueue.update({
            where: { id: item.id },
            data: { status: "rejected", reason: "owner_phone_not_configured", lockedByRunId: null, lockedUntil: null }
        });
        return { success: false, reason: "no_owner_phone" };
    }

    // 2. Generate Briefing
    const briefing = await buildBriefing(meetingSessionId);

    // 3. Send to owner phone
    const phoneE164 = normalizePhone(ownerPhone);

    if (!isWhatsAppEnabled) {
        // Stub — log but don't send real message
        await (prisma as any).auditEvent.create({
            data: {
                organizationId: orgId,
                action: "briefingSent",
                userId: "system:briefing-executor",
                resourceType: "action_queue",
                resourceId: item.id,
                details: `[STUB] Briefing para ${phoneE164}. Tokens: ${briefing.tokensUsed ?? 0}`,
                ipAddress: "system"
            }
        });
        await (prisma as any).actionQueue.update({
            where: { id: item.id },
            data: { status: "executed", executedAt: new Date(), lockedByRunId: null, lockedUntil: null }
        });

        // Log cost if AI was used
        if (briefing.costUsd) {
            await (prisma as any).agentRun.create({
                data: {
                    organizationId: orgId,
                    agentName: "BriefingAgent",
                    status: "succeeded",
                    inputHash: item.id,
                    inputJson: item.payloadJson,
                    outputJson: JSON.stringify({ length: briefing.text.length }),
                    costUsd: briefing.costUsd,
                    tokensIn: briefing.tokensUsed ?? 0,
                    tokensOut: 0,
                    relatedEntityType: "meeting_session",
                    relatedEntityId: meetingSessionId,
                    startedAt: new Date(),
                    finishedAt: new Date()
                }
            });
        }

        return { success: true, reason: "stub" };
    }

    const result = await sendWhatsAppMessage(phoneE164, briefing.text);

    if (result.error) {
        await (prisma as any).auditEvent.create({
            data: {
                organizationId: orgId,
                action: "briefingFailed",
                userId: "system:briefing-executor",
                resourceType: "action_queue",
                resourceId: item.id,
                details: result.error,
                ipAddress: "system"
            }
        });
        await (prisma as any).actionQueue.update({
            where: { id: item.id },
            data: { status: "rejected", reason: result.error, lockedByRunId: null, lockedUntil: null }
        });
        return { success: false, reason: result.error };
    }

    // Success
    await (prisma as any).auditEvent.create({
        data: {
            organizationId: orgId,
            action: "briefingSent",
            userId: "system:briefing-executor",
            resourceType: "action_queue",
            resourceId: item.id,
            details: `Owner: ${phoneE164} | waMsgId: ${result.messageId} | Stub: ${briefing.stub}`,
            ipAddress: "system"
        }
    });

    if (briefing.costUsd) {
        await (prisma as any).agentRun.create({
            data: {
                organizationId: orgId,
                agentName: "BriefingAgent",
                status: "succeeded",
                inputHash: item.id,
                inputJson: item.payloadJson,
                outputJson: JSON.stringify({ waMessageId: result.messageId }),
                costUsd: briefing.costUsd,
                tokensIn: briefing.tokensUsed ?? 0,
                tokensOut: 0,
                relatedEntityType: "meeting_session",
                relatedEntityId: meetingSessionId,
                startedAt: new Date(),
                finishedAt: new Date()
            }
        });
    }

    await (prisma as any).actionQueue.update({
        where: { id: item.id },
        data: { status: "executed", executedAt: new Date(), lockedByRunId: null, lockedUntil: null }
    });

    return { success: true };
}
