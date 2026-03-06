
import { prisma } from "@/lib/prisma";
import { subDays, startOfDay, endOfDay } from "date-fns";

export type WindowKey = "7d" | "30d" | "90d";

export interface PerformanceMetrics {
    revenueCents: number;
    mrrCents: number;
    pipelineCents: number;
    proposalsSent: number;
    proposalAcceptanceRate: number;
    meetingsBooked: number;
    meetingShowRate: number;
    avgReplyTimeMinutes: number;
    leaksOpenCents: number;
    pipelineVelocityDays: number;
}

export interface RepPerformance extends PerformanceMetrics {
    repId: string;
    name: string;
    role: string;
    score: number;
    wins: number;
    leaksOwnedCents: number;
}

/**
 * Computes Global Organization KPIs
 */
export async function computeOrgKPIs(orgId: string, window: WindowKey): Promise<PerformanceMetrics> {
    const days = window === "7d" ? 7 : window === "30d" ? 30 : 90;
    const since = subDays(new Date(), days);

    // 1. Revenue & MRR (from won meetings/proposals in window)
    const meetings = await (prisma as any).meetingPerformance.findMany({
        where: {
            sessionId: { in: await getSessionIds(orgId, since) },
            outcome: "won"
        }
    });
    const revenueCents = meetings.reduce((sum: number, m: any) => sum + (m.closedValue || 0), 0);
    const mrrCents = Math.round(revenueCents / (days / 30));

    // 2. Pipeline (Open proposals)
    const openProposals = await (prisma as any).proposal.findMany({
        where: { organizationId: orgId, status: "draft" }
    });
    const pipelineCents = openProposals.reduce((sum: number, p: any) => sum + (p.valueCents || 0), 0);

    // 3. Proposals Stats
    const sentProposals = await (prisma as any).proposal.findMany({
        where: { organizationId: orgId, createdAt: { gte: since } }
    });
    const acceptedProposals = sentProposals.filter((p: any) => p.status === "accepted");
    const proposalAcceptanceRate = sentProposals.length > 0 ? (acceptedProposals.length / sentProposals.length) * 100 : 0;

    // 4. Meetings Stats
    const allMeetings = await (prisma as any).meetingSession.findMany({
        where: { organizationId: orgId, startAt: { gte: since } }
    });
    const showCount = allMeetings.filter((m: any) => m.status === "completed").length;
    const meetingShowRate = allMeetings.length > 0 ? (showCount / allMeetings.length) * 100 : 0;

    // 5. Reply Time (Simple version: avg delta between inbound and next outbound in same conversation)
    const avgReplyTimeMinutes = await computeAvgReplyTime(orgId, since);

    // 6. Leaks
    const openLeaks = await (prisma as any).profitLeak.findMany({
        where: { organizationId: orgId, status: "open" }
    });
    const leaksOpenCents = openLeaks.reduce((sum: number, l: any) => sum + (l.impactCents || 0), 0);

    return {
        revenueCents,
        mrrCents,
        pipelineCents,
        proposalsSent: sentProposals.length,
        proposalAcceptanceRate,
        meetingsBooked: allMeetings.length,
        meetingShowRate,
        avgReplyTimeMinutes,
        leaksOpenCents,
        pipelineVelocityDays: 12, // Placeholder or semi-static for now
    };
}

/**
 * Computes Rep-specific KPIs
 */
export async function computeRepKPIs(orgId: string, repId: string, window: WindowKey): Promise<RepPerformance> {
    const days = window === "7d" ? 7 : window === "30d" ? 30 : 90;
    const since = subDays(new Date(), days);

    const rep = await (prisma as any).salesRep.findUnique({ where: { id: repId } });
    if (!rep) throw new Error("Rep not found");

    // Get assigned entities
    const assignments = await (prisma as any).salesAssignment.findMany({
        where: { organizationId: orgId, salesRepId: repId }
    });
    const leadIds = assignments.filter((a: any) => a.entityType === "lead").map((a: any) => a.entityId);
    const proposalIds = assignments.filter((a: any) => a.entityType === "proposal").map((a: any) => a.entityId);

    // 1. Revenue
    const repMeetings = await (prisma as any).meetingPerformance.findMany({
        where: {
            sessionId: { in: await getSessionIdsByLeads(leadIds, since) },
            outcome: "won"
        }
    });
    const revenueCents = repMeetings.reduce((sum: number, m: any) => sum + (m.closedValue || 0), 0);
    const wins = repMeetings.length;

    // 2. Reply Time (Specific to rep)
    const avgReplyTimeMinutes = await computeAvgReplyTime(orgId, since, repId);

    // 3. Leaks Owned
    const ownedLeaks = await (prisma as any).profitLeak.findMany({
        where: {
            organizationId: orgId,
            status: "open",
            OR: [
                { entityId: { in: leadIds } },
                { entityId: { in: proposalIds } }
            ]
        }
    });
    const leaksOwnedCents = ownedLeaks.reduce((sum: number, l: any) => sum + (l.impactCents || 0), 0);

    // 4. Combined Metrics (Simplified reuse)
    const orgKpi = await computeOrgKPIs(orgId, window); // This is overkill if we want pure performance, but for now we mix

    // 5. Score Calculation
    // score = (wins*5) + (showRate*3) + (proposalAcceptanceRate*3) - (replyTimeAvg/30) - (leaksOwnedCents/1_000_000)
    const score = (wins * 5) + (orgKpi.meetingShowRate * 0.03) + (orgKpi.proposalAcceptanceRate * 0.03)
        - (avgReplyTimeMinutes / 30) - (leaksOwnedCents / 1000000);

    return {
        ...orgKpi, // Placeholder for other metrics
        repId,
        name: rep.name,
        role: rep.role,
        revenueCents,
        wins,
        avgReplyTimeMinutes,
        leaksOwnedCents,
        score: Math.max(0, Math.round(score * 10) / 10)
    };
}

export async function buildLeaderboards(orgId: string, window: WindowKey) {
    const reps = await (prisma as any).salesRep.findMany({
        where: { organizationId: orgId, active: true }
    });

    const results = await Promise.all(reps.map((r: any) => computeRepKPIs(orgId, r.id, window)));

    return results.sort((a, b) => b.score - a.score);
}

export async function upsertPerformanceSnapshot(orgId: string, window: WindowKey) {
    const orgStats = await computeOrgKPIs(orgId, window);
    const leaderboards = await buildLeaderboards(orgId, window);

    const statsJson = JSON.stringify({
        org: orgStats,
        leaderboards
    });

    return (prisma as any).performanceSnapshot.create({
        data: {
            organizationId: orgId,
            window,
            statsJson
        }
    });
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

async function getSessionIds(orgId: string, since: Date): Promise<string[]> {
    const sessions = await (prisma as any).meetingSession.findMany({
        where: { organizationId: orgId, startAt: { gte: since } },
        select: { id: true }
    });
    return sessions.map((s: any) => s.id);
}

async function getSessionIdsByLeads(leadIds: string[], since: Date): Promise<string[]> {
    const sessions = await (prisma as any).meetingSession.findMany({
        where: {
            startAt: { gte: since },
            assessment: { id: { in: leadIds } } // Assuming assessment is the lead entity
        },
        select: { id: true }
    });
    return sessions.map((s: any) => s.id);
}

async function computeAvgReplyTime(orgId: string, since: Date, repId?: string): Promise<number> {
    // Logic: Inbound message followed by Outbound message in same conversation
    // We'll approximate using WhatsAppMessage records if available.
    try {
        const messages = await (prisma as any).whatsAppMessage.findMany({
            where: {
                createdAt: { gte: since },
                conversation: { organizationId: orgId, ...(repId ? { assignedUserId: repId } : {}) }
            },
            orderBy: { createdAt: "asc" }
        });

        let totalWait = 0;
        let count = 0;

        for (let i = 0; i < messages.length - 1; i++) {
            const current = messages[i];
            const next = messages[i + 1];

            if (current.direction === "inbound" && next.direction === "outbound" && current.conversationId === next.conversationId) {
                const diff = (next.createdAt.getTime() - current.createdAt.getTime()) / (1000 * 60); // minutes
                totalWait += diff;
                count++;
            }
        }

        return count > 0 ? Math.round(totalWait / count) : 15; // Default 15m if no data
    } catch {
        return 15;
    }
}
