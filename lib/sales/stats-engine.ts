import { prisma } from "@/lib/prisma";

export interface RepStats {
    repId: string;
    name: string;
    role: string;
    month: string;
    totalLeads: number;
    wonDeals: number;
    lostDeals: number;
    winRate: number;
    showRate: number;
    avgTicketCents: number;
    totalRevenueCents: number;
    avgDaysToClose: number;
    targetCents: number;
    targetPct: number;
}

export interface LeaderboardEntry extends RepStats {
    rank: number;
    delta?: number;
}

type AssessmentSummary = {
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    proposals: Array<{ pricingEstimate: string }>;
};

type RepSummaryRow = {
    id: string;
    name: string;
    role: string;
    organizationId?: string;
    targets: Array<{ targetCents: number }>;
    assignments: Array<{
        assessment: AssessmentSummary | null;
    }>;
};

type MeetingOutcome = {
    outcome: string;
};

export function calcCommission(
    priceCents: number,
    rule: { type: string; value: number },
): number {
    if (priceCents <= 0) return 0;
    if (rule.type === "fixed") return rule.value;
    return Math.round((priceCents * rule.value) / 100_00);
}

function monthRange(month: string) {
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    return { start, end };
}

function estimateProposalValueCents(pricingEstimate: unknown): number {
    if (typeof pricingEstimate === "number" && Number.isFinite(pricingEstimate)) {
        return Math.round(pricingEstimate);
    }

    if (typeof pricingEstimate !== "string" || !pricingEstimate.trim()) {
        return 0;
    }

    const raw = pricingEstimate.trim();
    if (/^\d+(\.\d+)?$/.test(raw)) {
        return Math.round(Number(raw) * 100);
    }

    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const min = Number(parsed.minBRL ?? parsed.min ?? 0);
        const max = Number(parsed.maxBRL ?? parsed.max ?? min);
        const estimate = max > 0 ? (min + max) / 2 : min;
        return Number.isFinite(estimate) ? Math.round(estimate * 100) : 0;
    } catch {
        return 0;
    }
}

async function loadLatestMeetingOutcomeByAssessment(assessmentIds: string[]) {
    if (assessmentIds.length === 0) {
        return new Map<string, MeetingOutcome>();
    }

    const sessions = await (prisma as any).meetingSession.findMany({
        where: {
            assessmentId: { in: assessmentIds },
        },
        orderBy: [
            { assessmentId: "asc" },
            { startAt: "desc" },
        ],
        select: {
            assessmentId: true,
            performances: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { outcome: true },
            },
        },
    });

    const meetingByAssessment = new Map<string, MeetingOutcome>();
    for (const session of sessions) {
        if (!session.assessmentId || meetingByAssessment.has(session.assessmentId)) {
            continue;
        }

        const outcome = session.performances[0];
        if (outcome) {
            meetingByAssessment.set(session.assessmentId, { outcome: outcome.outcome });
        }
    }

    return meetingByAssessment;
}

function buildRepStats(row: RepSummaryRow, month: string, meetingByAssessment: Map<string, MeetingOutcome>): RepStats {
    let wonDeals = 0;
    let lostDeals = 0;
    let totalRevenueCents = 0;
    let meetingCount = 0;
    let showCount = 0;
    const closeDays: number[] = [];

    for (const assignment of row.assignments) {
        const assessment = assignment.assessment;
        if (!assessment) continue;

        const meeting = meetingByAssessment.get(assessment.id);
        if (meeting) {
            meetingCount += 1;
            if (meeting.outcome !== "no_show") {
                showCount += 1;
            }
        }

        if (assessment.status === "won") {
            wonDeals += 1;
            totalRevenueCents += estimateProposalValueCents(assessment.proposals[0]?.pricingEstimate);

            const created = assessment.createdAt.getTime();
            const closed = assessment.updatedAt.getTime();
            closeDays.push(Math.max(0, Math.round((closed - created) / 86_400_000)));
        } else if (assessment.status === "lost") {
            lostDeals += 1;
        }
    }

    const totalLeads = row.assignments.length;
    const targetCents = row.targets[0]?.targetCents ?? 0;

    return {
        repId: row.id,
        name: row.name,
        role: row.role,
        month,
        totalLeads,
        wonDeals,
        lostDeals,
        winRate: totalLeads > 0 ? Math.round((wonDeals / totalLeads) * 100) : 0,
        showRate: meetingCount > 0 ? Math.round((showCount / meetingCount) * 100) : 0,
        avgTicketCents: wonDeals > 0 ? Math.round(totalRevenueCents / wonDeals) : 0,
        totalRevenueCents,
        avgDaysToClose: closeDays.length > 0
            ? Math.round(closeDays.reduce((sum, days) => sum + days, 0) / closeDays.length)
            : 0,
        targetCents,
        targetPct: targetCents > 0 ? Math.round((totalRevenueCents / targetCents) * 100) : 0,
    };
}

async function loadRepRows(input: {
    month: string;
    repId?: string;
    orgId?: string;
    activeOnly?: boolean;
}) {
    const reps = await (prisma as any).salesRep.findMany({
        where: {
            ...(input.repId ? { id: input.repId } : {}),
            ...(input.orgId ? { organizationId: input.orgId } : {}),
            ...(input.activeOnly ? { active: true } : {}),
        },
        select: {
            id: true,
            name: true,
            role: true,
            organizationId: true,
            targets: {
                where: { month: input.month },
                take: 1,
                select: { targetCents: true },
            },
            assignments: {
                where: { status: { in: ["active", "closed"] } },
                select: {
                    assessment: {
                        select: {
                            id: true,
                            status: true,
                            createdAt: true,
                            updatedAt: true,
                            proposals: {
                                where: { status: "accepted" },
                                orderBy: { updatedAt: "desc" },
                                take: 1,
                                select: { pricingEstimate: true },
                            },
                        },
                    },
                },
            },
        },
        orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    const assessmentIds: string[] = reps.flatMap((rep: RepSummaryRow) =>
        rep.assignments
            .map((assignment) => assignment.assessment?.id)
            .filter((assessmentId): assessmentId is string => Boolean(assessmentId)),
    );

    const meetingByAssessment = await loadLatestMeetingOutcomeByAssessment([...new Set(assessmentIds)]);

    return reps.map((rep: RepSummaryRow) => buildRepStats(rep, input.month, meetingByAssessment));
}

export async function getRepStats(repId: string, month: string): Promise<RepStats | null> {
    const stats = await loadRepRows({ repId, month });
    return stats[0] ?? null;
}

export async function getLeaderboard(orgId: string, month: string): Promise<LeaderboardEntry[]> {
    const stats = await loadRepRows({ orgId, month, activeOnly: true });
    stats.sort((left: RepStats, right: RepStats) => right.totalRevenueCents - left.totalRevenueCents);

    return stats.map((entry: RepStats, index: number) => ({
        ...entry,
        rank: index + 1,
        delta: index > 0 ? stats[index - 1].totalRevenueCents - entry.totalRevenueCents : 0,
    }));
}

export async function getCommissionSummary(orgId: string, month: string) {
    const { start, end } = monthRange(month);

    const [reps, payouts] = await Promise.all([
        (prisma as any).salesRep.findMany({
            where: { organizationId: orgId, active: true },
            select: {
                id: true,
                name: true,
                role: true,
            },
            orderBy: [{ role: "asc" }, { name: "asc" }],
        }),
        (prisma as any).commissionPayout.groupBy({
            by: ["salesRepId", "status"],
            where: {
                createdAt: {
                    gte: start,
                    lt: end,
                },
                salesRep: {
                    organizationId: orgId,
                    active: true,
                },
                status: { in: ["pending", "paid"] },
            },
            _sum: { amountCents: true },
        }),
    ]);

    const totalsByRep = new Map<string, { pendingCents: number; paidCents: number }>();
    for (const payout of payouts) {
        const current = totalsByRep.get(payout.salesRepId) ?? { pendingCents: 0, paidCents: 0 };
        if (payout.status === "paid") {
            current.paidCents = payout._sum.amountCents ?? 0;
        } else if (payout.status === "pending") {
            current.pendingCents = payout._sum.amountCents ?? 0;
        }
        totalsByRep.set(payout.salesRepId, current);
    }

    return reps.map((rep: { id: string; name: string; role: string }) => {
        const totals = totalsByRep.get(rep.id) ?? { pendingCents: 0, paidCents: 0 };
        return {
            repId: rep.id,
            name: rep.name,
            role: rep.role,
            pendingCents: totals.pendingCents,
            paidCents: totals.paidCents,
        };
    });
}
