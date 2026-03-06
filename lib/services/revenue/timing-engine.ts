/**
 * lib/services/revenue/timing-engine.ts
 * V17: Determines whether to escalate proposal priority.
 *
 * Rules:
 * - No proposal 60min after meeting → escalate
 * - Proposal sent >24h without response → critical
 * - adjustedProbability > 0.70 → highest priority
 */

import { prisma } from "@/lib/prisma";

export type Priority = "low" | "medium" | "high" | "critical";

export interface EscalationResult {
    escalate: boolean;
    newPriority: Priority;
    reason: string;
}

export async function shouldEscalateProposal(meetingSessionId: string): Promise<EscalationResult> {
    const session = await (prisma as any).meetingSession.findUnique({
        where: { id: meetingSessionId }
    });

    if (!session || session.status !== "completed") {
        return { escalate: false, newPriority: "low", reason: "session_not_completed" };
    }

    const now = Date.now();
    const meetingEndMs = new Date(session.endAt).getTime();
    const minutesSinceMeeting = (now - meetingEndMs) / 60_000;

    // Load assessment + most recent proposal
    const assessment = session.assessmentId
        ? await (prisma as any).assessment.findUnique({ where: { id: session.assessmentId } })
        : null;

    const proposal = assessment
        ? await (prisma as any).proposal.findFirst({
            where: { assessmentId: assessment.id },
            orderBy: { updatedAt: "desc" }
        })
        : null;

    const probability = session.adjustedProbability ?? session.closeProbability ?? 0;

    // ─── Rule 1: High probability → max priority ──────────────────────────────
    if (probability > 0.70) {
        return { escalate: true, newPriority: "critical", reason: `high_probability:${(probability * 100).toFixed(0)}%` };
    }

    // ─── Rule 2: No proposal 60 min after meeting ──────────────────────────────
    if (minutesSinceMeeting >= 60 && !proposal) {
        return { escalate: true, newPriority: "high", reason: "no_proposal_60min_post_meeting" };
    }

    // ─── Rule 3: Proposal sent >24h without response ──────────────────────────
    if (proposal?.status === "sent") {
        const hoursSinceSent = (now - new Date(proposal.updatedAt).getTime()) / 3_600_000;
        if (hoursSinceSent >= 24) {
            return { escalate: true, newPriority: "critical", reason: `proposal_stale_${Math.round(hoursSinceSent)}h` };
        }
        if (hoursSinceSent >= 6) {
            return { escalate: true, newPriority: "high", reason: `proposal_no_response_${Math.round(hoursSinceSent)}h` };
        }
    }

    // ─── Rule 4: Tier-based baseline ──────────────────────────────────────────
    const tierPriority: Record<string, Priority> = {
        hot: "high",
        warm: "medium",
        cold: "low",
    };

    return {
        escalate: false,
        newPriority: tierPriority[session.priorityTier] ?? "medium",
        reason: "baseline_tier"
    };
}

/**
 * Batch escalation check for all completed sessions in org.
 * Returns only those that need escalation.
 */
export async function runEscalationCheck(orgId: string): Promise<Array<{
    sessionId: string;
    escalation: EscalationResult;
}>> {
    const sessions = await (prisma as any).meetingSession.findMany({
        where: { organizationId: orgId, status: "completed" }
    });

    const results = await Promise.all(
        sessions.map(async (s: any) => ({
            sessionId: s.id,
            escalation: await shouldEscalateProposal(s.id)
        }))
    );

    return results.filter(r => r.escalation.escalate);
}
