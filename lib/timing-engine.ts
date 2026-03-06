/**
 * lib/timing-engine.ts
 * V17: Proposal timing & escalation engine.
 *
 * Evaluates a MeetingSession and determines whether its proposal
 * should be escalated in priority based on timing rules:
 *
 * Rule 1: Proposal not created 60 min after meeting ended → escalate to "high"
 * Rule 2: Proposal sent > 24h without response → escalate to "critical"
 * Rule 3: adjustedProbability > 0.70 → set priority "critical"
 *
 * These rules are evaluated in priority order (highest severity wins).
 */

import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EscalationPriority = "critical" | "high" | "medium" | "low";

export interface EscalationResult {
    escalate: boolean;
    newPriority: EscalationPriority;
    reason: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SIXTY_MINUTES_MS = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const HIGH_PROB_THRESHOLD = 0.70;

// ─── Main Function ────────────────────────────────────────────────────────────

export async function shouldEscalateProposal(
    meetingSessionId: string
): Promise<EscalationResult> {
    const now = Date.now();

    // 1. Load meeting session
    const session = await (prisma as any).meetingSession.findUnique({
        where: { id: meetingSessionId },
    });

    if (!session) {
        throw new Error(`MeetingSession not found: ${meetingSessionId}`);
    }

    const orgId: string = session.organizationId;
    const adjustedProbability: number = session.adjustedProbability ?? session.closeProbability ?? 0;

    // 2. Evaluate Rule 3 first (highest precedence — probability gate)
    if (adjustedProbability >= HIGH_PROB_THRESHOLD) {
        await syncActionQueuePriority(orgId, meetingSessionId, "critical");
        return {
            escalate: true,
            newPriority: "critical",
            reason: `adjustedProbability ${(adjustedProbability * 100).toFixed(1)}% ≥ 70% — máxima prioridade`,
        };
    }

    // 3. Load the most recent linked proposal (via assessmentId)
    let latestProposal: any = null;
    if (session.assessmentId) {
        latestProposal = await (prisma as any).proposal.findFirst({
            where: { assessmentId: session.assessmentId },
            orderBy: { createdAt: "desc" },
        });
    }

    // 4. Rule 2: Proposal sent > 24h without response
    if (latestProposal && latestProposal.status === "sent") {
        const sentAgo = now - new Date(latestProposal.updatedAt).getTime();
        if (sentAgo > TWENTY_FOUR_HOURS_MS) {
            await syncActionQueuePriority(orgId, meetingSessionId, "critical");
            return {
                escalate: true,
                newPriority: "critical",
                reason: `Proposta enviada há ${Math.round(sentAgo / 3600000)}h sem resposta`,
            };
        }
    }

    // 5. Rule 1: No proposal 60 min after meeting ended
    if (!latestProposal && session.endAt) {
        const endedAgo = now - new Date(session.endAt).getTime();
        if (endedAgo > SIXTY_MINUTES_MS && session.status !== "canceled") {
            const currentPriority = await resolveCurrentPriority(orgId, meetingSessionId);
            // Only escalate if not already at high/critical
            if (currentPriority === "medium" || currentPriority === "low") {
                await syncActionQueuePriority(orgId, meetingSessionId, "high");
                return {
                    escalate: true,
                    newPriority: "high",
                    reason: `Proposta não criada ${Math.round(endedAgo / 60000)} min após fim da reunião`,
                };
            }
        }
    }

    // 6. No escalation needed
    const currentPriority = await resolveCurrentPriority(orgId, meetingSessionId);
    return {
        escalate: false,
        newPriority: currentPriority,
        reason: "Nenhuma regra de escalação ativa",
    };
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

async function syncActionQueuePriority(
    orgId: string,
    meetingSessionId: string,
    priority: EscalationPriority
): Promise<void> {
    await (prisma as any).actionQueue.updateMany({
        where: {
            organizationId: orgId,
            relatedEntityType: "meeting_session",
            relatedEntityId: meetingSessionId,
            status: "pending",
        },
        data: { priority },
    });
}

async function resolveCurrentPriority(
    orgId: string,
    meetingSessionId: string
): Promise<EscalationPriority> {
    const item = await (prisma as any).actionQueue.findFirst({
        where: {
            organizationId: orgId,
            relatedEntityType: "meeting_session",
            relatedEntityId: meetingSessionId,
            status: "pending",
        },
        select: { priority: true },
        orderBy: { createdAt: "desc" },
    });
    return (item?.priority as EscalationPriority) ?? "medium";
}
