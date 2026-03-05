import { prisma } from "@/lib/prisma";

/**
 * lib/sales/stats-engine.ts — V35
 * Deterministic sales performance statistics:
 * leaderboard, per-rep stats, commission summaries.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RepStats {
    repId: string;
    name: string;
    role: string;
    month: string;
    totalLeads: number;
    wonDeals: number;
    lostDeals: number;
    winRate: number;         // 0-100
    showRate: number;        // 0-100
    avgTicketCents: number;
    totalRevenueCents: number;
    avgDaysToClose: number;
    targetCents: number;
    targetPct: number;       // 0-100+
}

export interface LeaderboardEntry extends RepStats {
    rank: number;
    delta?: number; // vs previous entry
}

// ─── Commission Calc (pure, testable) ────────────────────────────────────────

/**
 * Calculate commission for a deal value given a CommissionRule.
 * @param priceCents Deal value in cents
 * @param rule { type: "fixed"|"percent", value: cents or bps*100 }
 */
export function calcCommission(
    priceCents: number,
    rule: { type: string; value: number }
): number {
    if (priceCents <= 0) return 0;
    if (rule.type === "fixed") return rule.value;
    // percent: value is basis points × 100 (e.g. 1000 = 10%)
    return Math.round((priceCents * rule.value) / 100_00);
}

// ─── Per-Rep Stats ─────────────────────────────────────────────────────────

export async function getRepStats(repId: string, month: string): Promise<RepStats | null> {
    const rep = await (prisma as any).salesRep.findUnique({
        where: { id: repId },
        include: {
            targets: { where: { month } },
            assignments: {
                where: { status: { in: ["active", "closed"] } },
                include: {
                    assessment: {
                        include: {
                            meetingPerformances: { take: 1 },
                            proposals: { where: { status: "accepted" }, take: 1 }
                        }
                    }
                }
            }
        }
    });

    if (!rep) return null;

    const assignments = rep.assignments || [];
    const target = rep.targets?.[0];

    let wonDeals = 0, lostDeals = 0, totalRevenue = 0;
    let closeDays: number[] = [], meetingCount = 0, showCount = 0;

    for (const a of assignments) {
        const ass = a.assessment;
        if (!ass) continue;

        const mp = ass.meetingPerformances?.[0];
        if (mp) {
            meetingCount++;
            if (mp.outcome !== "no_show") showCount++;
        }

        if (ass.status === "won") {
            wonDeals++;
            const proposal = ass.proposals?.[0];
            totalRevenue += proposal?.totalCents || 0;

            const created = new Date(ass.createdAt).getTime();
            const closed = new Date(ass.updatedAt).getTime();
            closeDays.push(Math.round((closed - created) / 86400_000));
        } else if (ass.status === "lost") {
            lostDeals++;
        }
    }

    const totalLeads = assignments.length;
    const winRate = totalLeads > 0 ? Math.round((wonDeals / totalLeads) * 100) : 0;
    const showRate = meetingCount > 0 ? Math.round((showCount / meetingCount) * 100) : 0;
    const avgTicketCents = wonDeals > 0 ? Math.round(totalRevenue / wonDeals) : 0;
    const avgDaysToClose = closeDays.length > 0
        ? Math.round(closeDays.reduce((s, d) => s + d, 0) / closeDays.length) : 0;
    const targetCents = target?.targetCents || 0;
    const targetPct = targetCents > 0 ? Math.round((totalRevenue / targetCents) * 100) : 0;

    return {
        repId, name: rep.name, role: rep.role, month,
        totalLeads, wonDeals, lostDeals,
        winRate, showRate, avgTicketCents,
        totalRevenueCents: totalRevenue,
        avgDaysToClose, targetCents, targetPct,
    };
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export async function getLeaderboard(orgId: string, month: string): Promise<LeaderboardEntry[]> {
    const reps = await (prisma as any).salesRep.findMany({
        where: { organizationId: orgId, active: true },
        select: { id: true }
    });

    const stats = await Promise.all(
        reps.map((r: any) => getRepStats(r.id, month))
    );

    const valid = stats.filter(Boolean) as RepStats[];
    valid.sort((a, b) => b.totalRevenueCents - a.totalRevenueCents);

    return valid.map((s, i) => ({
        ...s,
        rank: i + 1,
        delta: i > 0 ? valid[i - 1].totalRevenueCents - s.totalRevenueCents : 0,
    }));
}

// ─── Commission Summary ───────────────────────────────────────────────────────

export async function getCommissionSummary(orgId: string, month: string) {
    const reps = await (prisma as any).salesRep.findMany({
        where: { organizationId: orgId, active: true },
        include: {
            payouts: {
                where: {
                    createdAt: {
                        gte: new Date(`${month}-01`),
                        lt: new Date(
                            new Date(`${month}-01`).setMonth(new Date(`${month}-01`).getMonth() + 1)
                        )
                    }
                }
            }
        }
    });

    return reps.map((r: any) => {
        const pending = r.payouts.filter((p: any) => p.status === "pending")
            .reduce((s: number, p: any) => s + p.amountCents, 0);
        const paid = r.payouts.filter((p: any) => p.status === "paid")
            .reduce((s: number, p: any) => s + p.amountCents, 0);
        return { repId: r.id, name: r.name, role: r.role, pendingCents: pending, paidCents: paid };
    });
}
