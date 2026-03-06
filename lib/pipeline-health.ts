/**
 * lib/pipeline-health.ts
 * V17: Pipeline Health aggregator.
 *
 * Calculates org-level pipeline health based on:
 *   - Sum of expectedRevenue (weighted pipeline value)
 *   - Average adjustedProbability
 *   - 30-day close rate (MeetingPerformance outcomes)
 *   - Volume of upcoming meetings (next 30 days)
 *   - Proposal aging (proposals sent > N days without response)
 *
 * pipelineQualityIndex (0–100) is a composite weighted score.
 */

import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PipelineHealthResult {
    /** Sum of (expectedRevenue) across active sessions */
    weightedPipelineValue: number;
    /** Mean adjustedProbability across active sessions */
    avgProbability: number;
    /** Projected closed revenue in next 30 days */
    projectedRevenue30d: number;
    /** Projected closed revenue in next 90 days */
    projectedRevenue90d: number;
    /** Composite quality index 0–100 */
    pipelineQualityIndex: number;
    // Diagnostics
    activeSessions: number;
    upcomingSessions30d: number;
    closeRate30d: number;
    stalledProposals: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n));
}

// ─── Main Function ────────────────────────────────────────────────────────────

export async function calculatePipelineHealth(
    orgId: string
): Promise<PipelineHealthResult> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 86400000);
    const ninetyDaysAhead = new Date(now.getTime() + 90 * 86400000);
    const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000);

    // ---  Parallel fetches ---
    const [
        activeSessions,
        performance30d,
        upcomingSessions30d,
        upcomingSessions90d,
        stalledProposals,
    ] = await Promise.all([
        // Active sessions with expected revenue
        (prisma as any).meetingSession.findMany({
            where: {
                organizationId: orgId,
                status: { not: "canceled" },
                expectedRevenue: { not: null },
                adjustedProbability: { not: null },
            },
            select: {
                id: true,
                expectedRevenue: true,
                adjustedProbability: true,
                startAt: true,
            },
        }),

        // Org win/loss history (last 30d)
        (prisma as any).meetingPerformance.groupBy({
            by: ["outcome"],
            where: {
                organizationId: orgId,
                outcome: { in: ["won", "lost"] },
                createdAt: { gte: thirtyDaysAgo },
            },
            _count: { _all: true },
        }),

        // Upcoming sessions in next 30d
        (prisma as any).meetingSession.count({
            where: {
                organizationId: orgId,
                status: "scheduled",
                startAt: { gte: now, lte: thirtyDaysAhead },
            },
        }),

        // Upcoming sessions in next 90d
        (prisma as any).meetingSession.count({
            where: {
                organizationId: orgId,
                status: "scheduled",
                startAt: { gte: now, lte: ninetyDaysAhead },
            },
        }),

        // Stalled proposals (sent > 5 days without response)
        (prisma as any).proposal.count({
            where: {
                organizationId: orgId,
                status: "sent",
                updatedAt: { lt: fiveDaysAgo },
            },
        }),
    ]);

    // --- Aggregations ---

    const weightedPipelineValue: number = activeSessions.reduce(
        (sum: number, s: any) => sum + (s.expectedRevenue ?? 0),
        0
    );

    const avgProbability: number =
        activeSessions.length > 0
            ? activeSessions.reduce((sum: number, s: any) => sum + (s.adjustedProbability ?? 0), 0) /
            activeSessions.length
            : 0;

    // Close rate last 30d
    const perfMap: Record<string, number> = {};
    for (const row of (performance30d as any[])) {
        perfMap[row.outcome] = row._count._all;
    }
    const won30d = perfMap["won"] ?? 0;
    const lost30d = perfMap["lost"] ?? 0;
    const total30d = won30d + lost30d;
    const closeRate30d: number = total30d > 0 ? won30d / total30d : 0;

    // Projected revenue 30d = sessions starting in next 30d × their expectedRevenue
    const projectedRevenue30d: number = activeSessions
        .filter((s: any) => {
            const startAt = new Date(s.startAt);
            return startAt >= now && startAt <= thirtyDaysAhead;
        })
        .reduce((sum: number, s: any) => sum + (s.expectedRevenue ?? 0), 0);

    // Projected revenue 90d = full pipeline × closeRate30d (historical rate as proxy)
    const projectedRevenue90d: number = Math.round(
        weightedPipelineValue * Math.max(closeRate30d, avgProbability)
    );

    // --- Pipeline Quality Index (0–100) ---
    // Components:
    //   avg probability  35%
    //   close rate 30d   25%
    //   pipeline volume  20% (capped at 10 sessions = 100%)
    //   no stalls        20% (deduction for stalled proposals)

    const probScore = clamp(avgProbability * 100, 0, 100) * 0.35;
    const closeScore = clamp(closeRate30d * 100, 0, 100) * 0.25;
    const volumeScore = clamp((activeSessions.length / 10) * 100, 0, 100) * 0.20;
    const stallDeduction = clamp(stalledProposals * 10, 0, 100) * 0.20;
    const pipelineQualityIndex = Math.round(
        clamp(probScore + closeScore + volumeScore - stallDeduction, 0, 100)
    );

    return {
        weightedPipelineValue: Math.round(weightedPipelineValue),
        avgProbability: Math.round(avgProbability * 1000) / 1000,
        projectedRevenue30d: Math.round(projectedRevenue30d),
        projectedRevenue90d: projectedRevenue90d,
        pipelineQualityIndex,
        activeSessions: activeSessions.length,
        upcomingSessions30d,
        closeRate30d: Math.round(closeRate30d * 1000) / 1000,
        stalledProposals,
    };
}
