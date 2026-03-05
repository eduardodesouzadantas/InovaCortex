/**
 * lib/services/revenue/pipeline-health.ts
 * V17: Calculates org-level pipeline health metrics.
 *
 * Aggregates all active MeetingSession expectedRevenue to produce:
 * - weightedPipelineValue
 * - avgProbability
 * - projectedRevenue30d / 90d
 * - pipelineQualityIndex (0–100)
 */

import { prisma } from "@/lib/prisma";

export interface PipelineHealth {
    weightedPipelineValue: number;
    avgProbability: number;
    projectedRevenue30d: number;
    projectedRevenue90d: number;
    pipelineQualityIndex: number;   // 0–100
    totalActiveSessions: number;
    hotCount: number;
    warmCount: number;
    coldCount: number;
    agingProposals: number;         // proposals without response >24h
}

export async function calculatePipelineHealth(orgId: string): Promise<PipelineHealth> {
    const now = new Date();
    const since30d = new Date(now.getTime() - 30 * 86_400_000);
    const since90d = new Date(now.getTime() - 90 * 86_400_000);

    // All active sessions with calibrated data
    const sessions = await (prisma as any).meetingSession.findMany({
        where: { organizationId: orgId, status: { in: ["scheduled", "completed"] } }
    });

    const withData = sessions.filter((s: any) => s.expectedRevenue != null);

    // Weighted pipeline value = Σ (expectedRevenue)
    const weightedPipelineValue = withData.reduce((sum: number, s: any) => sum + (s.expectedRevenue ?? 0), 0);

    // Average adjusted probability
    const avgProbability = withData.length > 0
        ? withData.reduce((sum: number, s: any) => sum + (s.adjustedProbability ?? 0), 0) / withData.length
        : 0;

    // Tier counts
    const hotCount = sessions.filter((s: any) => s.priorityTier === "hot").length;
    const warmCount = sessions.filter((s: any) => s.priorityTier === "warm").length;
    const coldCount = sessions.filter((s: any) => s.priorityTier === "cold").length;

    // Historical close rate for projection
    const recentPerfs30d = await (prisma as any).meetingPerformance.findMany({
        where: { organizationId: orgId, createdAt: { gte: since30d } }
    });
    const recentPerfs90d = await (prisma as any).meetingPerformance.findMany({
        where: { organizationId: orgId, createdAt: { gte: since90d } }
    });

    const closeRate30d = recentPerfs30d.length > 0
        ? recentPerfs30d.filter((p: any) => p.outcome === "won").length / recentPerfs30d.length
        : avgProbability;
    const closeRate90d = recentPerfs90d.length > 0
        ? recentPerfs90d.filter((p: any) => p.outcome === "won").length / recentPerfs90d.length
        : avgProbability;

    // Future meetings within 30d / 90d
    const upcomingSessions30d = sessions.filter((s: any) => s.status === "scheduled" && new Date(s.startAt) <= new Date(now.getTime() + 30 * 86_400_000));
    const upcomingSessions90d = sessions.filter((s: any) => s.status === "scheduled" && new Date(s.startAt) <= new Date(now.getTime() + 90 * 86_400_000));

    const projectedRevenue30d = upcomingSessions30d.reduce((sum: number, s: any) => {
        return sum + ((s.revenueScore ?? 0) * closeRate30d);
    }, 0);

    const projectedRevenue90d = upcomingSessions90d.reduce((sum: number, s: any) => {
        return sum + ((s.revenueScore ?? 0) * closeRate90d);
    }, 0);

    // Aging proposals (sent > 24h without response)
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const agingProposals = await (prisma as any).proposal.count({
        where: {
            organizationId: orgId,
            status: "sent",
            updatedAt: { lt: dayAgo }
        }
    });

    // Pipeline Quality Index (0–100)
    // Factors: avg probability (40%), hot ratio (30%), aging penalty (20%), volume (10%)
    const probScore = avgProbability * 40;
    const hotRatio = sessions.length > 0 ? hotCount / sessions.length : 0;
    const hotScore = hotRatio * 30;
    const agingPenalty = Math.min(agingProposals * 5, 20);
    const volumeScore = Math.min(sessions.length * 2, 10);
    const pipelineQualityIndex = Math.round(Math.min(probScore + hotScore - agingPenalty + volumeScore, 100));

    return {
        weightedPipelineValue: Math.round(weightedPipelineValue * 100) / 100,
        avgProbability: Math.round(avgProbability * 1000) / 1000,
        projectedRevenue30d: Math.round(projectedRevenue30d * 100) / 100,
        projectedRevenue90d: Math.round(projectedRevenue90d * 100) / 100,
        pipelineQualityIndex: Math.max(0, pipelineQualityIndex),
        totalActiveSessions: sessions.length,
        hotCount,
        warmCount,
        coldCount,
        agingProposals,
    };
}
