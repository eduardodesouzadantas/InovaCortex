/**
 * lib/orchestrator/executors/proposal-draft-executor.ts
 * V17 P3: Auto-generates a Proposal draft when a MeetingSession completes
 * within the ideal timing window and meets the probability threshold.
 *
 * V17 P3/P3 addition: send-window logging + autopilot scheduling.
 *   - After draft is approved and sent, logs the send hour for learning.
 *   - If AUTOPILOT_PROPOSALS=true, enqueues send_proposal_scheduled at
 *     the recommended send window computed by send-window engine.
 */

import { prisma } from "@/lib/prisma";
import { generateProposal } from "@/lib/proposal-engine";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import type { AgentImplementation, OrchestratorContext } from "@/lib/orchestrator/types";
import { logProposalSent, recommendSendAt } from "@/lib/services/deal-optimization/send-window";


// ─── Payload (what brainCycle enqueues) ──────────────────────────────────────

export interface ProposalDraftPayload {
    meetingSessionId: string;
    orgId: string;
    highPriority?: boolean; // true if prob >= 0.75
}

// ─── Main executor ───────────────────────────────────────────────────────────

async function runProposalDraftExecutor(
    input: ProposalDraftPayload,
    ctx: OrchestratorContext,
): Promise<{ success: boolean; data?: any; error?: string }> {
    const { meetingSessionId, orgId } = input;

    // ── 1. Load MeetingSession ────────────────────────────────────────────────
    const session = await (prisma as any).meetingSession.findUnique({
        where: { id: meetingSessionId },
    });

    if (!session) {
        return { success: false, error: `MeetingSession not found: ${meetingSessionId}` };
    }

    // ── 2. Idempotency — bail if a draft link already exists for this session ─
    const existingLink = await (prisma as any).proposalDraftLink.findUnique({
        where: { meetingSessionId },
    });
    if (existingLink) {
        return { success: true, data: { skipped: true, reason: "draft_already_exists", proposalId: existingLink.proposalId } };
    }

    // ── 3. Guard: no existing sent/accepted proposal on linked assessment ────
    if (session.assessmentId) {
        const blockerProposal = await (prisma as any).proposal.findFirst({
            where: {
                assessmentId: session.assessmentId,
                status: { in: ["sent", "accepted"] },
            },
        });
        if (blockerProposal) {
            return { success: true, data: { skipped: true, reason: "proposal_already_active", proposalId: blockerProposal.id } };
        }
    }

    // ── 4. Load assessment (required) ────────────────────────────────────────
    const assessment = session.assessmentId
        ? await (prisma as any).assessment.findUnique({ where: { id: session.assessmentId } })
        : null;

    if (!assessment) {
        return { success: false, error: "No linked assessment — cannot generate proposal" };
    }

    // ── 5. Load ROI projection and last PreSales artifact ────────────────────
    const [roiProjection, lastPreSales, existingVersion] = await Promise.all([
        (prisma as any).roiProjection.findFirst({ where: { assessmentId: assessment.id } }),
        (prisma as any).preSalesArtifact.findFirst({
            where: { assessmentId: assessment.id },
            orderBy: { createdAt: "desc" },
        }),
        (prisma as any).proposal.count({ where: { assessmentId: assessment.id } }),
    ]);

    // ── 6. Generate proposal deterministically ────────────────────────────────
    const generated = generateProposal({
        assessment,
        roiProjection: roiProjection ?? null,
        lastPreSales: lastPreSales ?? null,
        existingVersion,
    });

    // ── 7. Persist Proposal (status=draft) ───────────────────────────────────
    const proposal = await (prisma as any).proposal.create({
        data: {
            assessmentId: assessment.id,
            organizationId: orgId,
            status: "draft",
            publicSlug: generated.publicSlug,
            version: generated.version,
            modules: JSON.stringify(generated.modules),
            pricingEstimate: JSON.stringify(generated.pricingEstimate),
            roiSnapshot: JSON.stringify(generated.roiSnapshot),
            presalesSnapshot: JSON.stringify(generated.presalesSnapshot),
            customNotes: `[AUTO-GERADO] Rascunho criado automaticamente com base na MeetingSession ${meetingSessionId}.`,
        },
    });

    // ── 8. Create ProposalDraftLink (unique guard) ────────────────────────────
    await (prisma as any).proposalDraftLink.create({
        data: {
            orgId,
            meetingSessionId,
            proposalId: proposal.id,
        },
    });

    // ── 9. Create ReviewRequest (mandatory gate before sending) ───────────────
    const reviewRequest = await (prisma as any).reviewRequest.create({
        data: {
            orgId,
            entityType: "proposal",
            entityId: proposal.id,
            status: "pending",
        },
    });

    // ── 10. Audit Events ──────────────────────────────────────────────────────
    await Promise.all([
        (prisma as any).auditEvent.create({
            data: {
                organizationId: orgId,
                action: "proposalDraftGenerated",
                userId: "system:proposal-draft-executor",
                resourceType: "proposal",
                resourceId: proposal.id,
                details: JSON.stringify({
                    meetingSessionId,
                    assessmentId: assessment.id,
                    version: generated.version,
                    modulesCount: generated.modules.length,
                    pricingMin: generated.pricingEstimate.minBRL,
                    pricingMax: generated.pricingEstimate.maxBRL,
                }),
                ipAddress: "system",
            },
        }),
        (prisma as any).auditEvent.create({
            data: {
                organizationId: orgId,
                action: "reviewRequested",
                userId: "system:proposal-draft-executor",
                resourceType: "review_request",
                resourceId: reviewRequest.id,
                details: JSON.stringify({ entityType: "proposal", entityId: proposal.id }),
                ipAddress: "system",
            },
        }),
    ]);

    // ── 11. Send-window log (draft created = first touch, not a real send yet)  ─
    //        We log here so even draft creation starts training the model.
    await logProposalSent(orgId).catch(() => null); // non-blocking

    // ── 12. Autopilot: schedule send if setting enabled ───────────────────────
    const autopilotEnabled = await getAutopilotSetting(orgId);
    let scheduledSendAt: Date | null = null;

    if (autopilotEnabled) {
        const windowResult = await recommendSendAt(orgId);
        scheduledSendAt = windowResult.recommendedAt;

        // Enqueue future send action
        await (prisma as any).actionQueue.create({
            data: {
                organizationId: orgId,
                type: "send_proposal_scheduled",
                payloadJson: JSON.stringify({
                    proposalId: proposal.id,
                    meetingSessionId,
                    orgId,
                    bestHour: windowResult.bestHour,
                    fallback: windowResult.fallback,
                }),
                priority: input.highPriority ? "critical" : "high",
                relatedEntityType: "proposal",
                relatedEntityId: proposal.id,
                status: "pending",
                approvalRequired: true, // always require human approval before send
                reason: `Autopilot: send window at ${windowResult.bestHour}h (${windowResult.fallback ? "fallback" : "learned"})`,
                nextRetryAt: scheduledSendAt,
            },
        });

        await (prisma as any).auditEvent.create({
            data: {
                organizationId: orgId,
                action: "sendWindowScheduled",
                userId: "system:proposal-draft-executor",
                resourceType: "proposal",
                resourceId: proposal.id,
                details: JSON.stringify({
                    bestHour: windowResult.bestHour,
                    fallback: windowResult.fallback,
                    scheduledSendAt: scheduledSendAt.toISOString(),
                }),
                ipAddress: "system",
            },
        }).catch(() => null);
    }

    // ── 13. Notify owner via WhatsApp (non-blocking, best-effort) ────────────
    await notifyOwner(orgId, proposal, session, input.highPriority ?? false, scheduledSendAt);

    return {
        success: true,
        data: {
            proposalId: proposal.id,
            reviewRequestId: reviewRequest.id,
            publicSlug: generated.publicSlug,
            version: generated.version,
            pricingRange: `R$ ${generated.pricingEstimate.minBRL} – R$ ${generated.pricingEstimate.maxBRL}`,
            autopilotEnabled,
            scheduledSendAt: scheduledSendAt?.toISOString() ?? null,
        },
    };
}

// ─── Owner notification (WhatsApp) ───────────────────────────────────────────

async function notifyOwner(
    orgId: string,
    proposal: any,
    session: any,
    highPriority: boolean,
    scheduledSendAt: Date | null = null,
): Promise<void> {
    try {
        const channel = await (prisma as any).orgNotificationChannel.findUnique({
            where: { organizationId: orgId },
        });
        if (!channel?.ownerWhatsApp) return;

        const priorityFlag = highPriority ? "🚨 *ALTA PRIORIDADE* — " : "";
        const sessionRef = session.leadEmail ?? `sessão ${session.id.slice(0, 8)}`;
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://app.inovacortex.com.br";
        const reviewUrl = `${baseUrl}/admin/proposals/${proposal.id}`;

        const scheduleInfo = scheduledSendAt
            ? `\n⏰ *Envio agendado para:* ${scheduledSendAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })} (autopilot)`
            : "";

        const body = [
            `${priorityFlag}📄 *Proposta Rascunho Gerada Automaticamente*`,
            ``,
            `👤 Lead: ${sessionRef}`,
            `💰 Investimento estimado: R$ ${proposal.pricingEstimate ? JSON.parse(proposal.pricingEstimate).minBRL?.toLocaleString("pt-BR") : "—"}`,
            scheduleInfo,
            ``,
            `✅ Revise e envie com 1 clique:`,
            reviewUrl,
            ``,
            `_Gerado pelo BrainCycle — InovaCortex_`,
        ].join("\n");

        await sendWhatsAppMessage(channel.ownerWhatsApp, body);
    } catch {
        // Non-blocking — swallow notification errors
    }
}

// ─── Autopilot setting helper ─────────────────────────────────────────────────

async function getAutopilotSetting(orgId: string): Promise<boolean> {
    // Reads system setting key "ai.autopilot_proposals" — default OFF
    const setting = await (prisma as any).systemSetting.findUnique({
        where: { key_organizationId: { key: "ai.autopilot_proposals", organizationId: orgId } },
    }).catch(() => null);
    return setting?.value === "true";
}

// ─── Agent registration ───────────────────────────────────────────────────────

export const ProposalDraftAgent: AgentImplementation = {
    name: "ProposalDraftAgent",
    run: (input, ctx) => runProposalDraftExecutor(input as ProposalDraftPayload, ctx),
};
