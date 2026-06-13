import { prisma } from "@/lib/prisma";
import { subDays } from "date-fns";

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

type ReplyAggregate = {
    totalMinutes: number;
    count: number;
};

type RepIdentity = {
    id: string;
    name: string;
    role: string;
};

function resolveWindowStart(window: WindowKey) {
    const days = window === "7d" ? 7 : window === "30d" ? 30 : 90;
    return {
        days,
        since: subDays(new Date(), days),
    };
}

function parseProposalValueCents(pricingEstimate: unknown): number {
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

function averageMinutes(aggregate: ReplyAggregate | undefined, fallback = 15): number {
    if (!aggregate || aggregate.count <= 0) {
        return fallback;
    }

    return Math.round(aggregate.totalMinutes / aggregate.count);
}

function assignLeakOwnership(
    leaks: Array<{ estimatedLossCents: number; evidenceJson: string }>,
    ownedIdsByRep: Map<string, Set<string>>,
) {
    const leaksByRep = new Map<string, number>();
    if (ownedIdsByRep.size === 0 || leaks.length === 0) {
        return leaksByRep;
    }

    for (const leak of leaks) {
        let sampleIds: string[] = [];

        try {
            const evidence = JSON.parse(leak.evidenceJson) as Record<string, unknown>;
            sampleIds = Array.isArray(evidence.sampleIds)
                ? evidence.sampleIds.filter((value): value is string => typeof value === "string")
                : [];
        } catch {
            sampleIds = [];
        }

        if (sampleIds.length === 0) {
            continue;
        }

        const matchingRepIds: string[] = [];
        for (const [repId, ownedIds] of ownedIdsByRep.entries()) {
            if (sampleIds.some((sampleId) => ownedIds.has(sampleId))) {
                matchingRepIds.push(repId);
            }
        }

        if (matchingRepIds.length === 0) {
            continue;
        }

        const sharedAmount = Math.round(leak.estimatedLossCents / matchingRepIds.length);
        for (const repId of matchingRepIds) {
            leaksByRep.set(repId, (leaksByRep.get(repId) ?? 0) + sharedAmount);
        }
    }

    return leaksByRep;
}

function calculateReplyAggregates<T extends { conversationId: string; direction: string; createdAt: Date }>(
    messages: T[],
    resolveBucket: (message: T) => string | null,
) {
    const aggregates = new Map<string, ReplyAggregate>();
    const stateByConversation = new Map<string, { pendingInboundAt: Date | null; bucket: string | null }>();

    for (const message of messages) {
        const bucket = resolveBucket(message);
        const state = stateByConversation.get(message.conversationId) ?? {
            pendingInboundAt: null,
            bucket,
        };

        if (!state.bucket && bucket) {
            state.bucket = bucket;
        }

        if (message.direction === "inbound") {
            state.pendingInboundAt = message.createdAt;
            stateByConversation.set(message.conversationId, state);
            continue;
        }

        if (message.direction === "outbound" && state.pendingInboundAt && state.bucket) {
            const minutes = Math.max(
                1,
                Math.round((message.createdAt.getTime() - state.pendingInboundAt.getTime()) / 60_000),
            );

            const aggregate = aggregates.get(state.bucket) ?? { totalMinutes: 0, count: 0 };
            aggregate.totalMinutes += minutes;
            aggregate.count += 1;
            aggregates.set(state.bucket, aggregate);
            state.pendingInboundAt = null;
        }

        stateByConversation.set(message.conversationId, state);
    }

    return aggregates;
}

async function computeOrgReplyAggregate(orgId: string, since: Date) {
    const messages = await (prisma as any).whatsAppMessage.findMany({
        where: {
            organizationId: orgId,
            createdAt: { gte: since },
        },
        select: {
            conversationId: true,
            direction: true,
            createdAt: true,
        },
        orderBy: [
            { conversationId: "asc" },
            { createdAt: "asc" },
        ],
    });

    return calculateReplyAggregates(
        messages,
        () => orgId,
    ).get(orgId);
}

async function computeRepReplyAggregates(orgId: string, since: Date, repIds: string[]) {
    if (repIds.length === 0) {
        return new Map<string, ReplyAggregate>();
    }

    const messages = await (prisma as any).whatsAppMessage.findMany({
        where: {
            organizationId: orgId,
            createdAt: { gte: since },
            conversation: {
                assignedUserId: { in: repIds },
            },
        },
        select: {
            conversationId: true,
            direction: true,
            createdAt: true,
            conversation: {
                select: {
                    assignedUserId: true,
                },
            },
        },
        orderBy: [
            { conversationId: "asc" },
            { createdAt: "asc" },
        ],
    });

    return calculateReplyAggregates(
        messages,
        (message: (typeof messages)[number]) => message.conversation.assignedUserId ?? null,
    );
}

function buildRepPerformance(
    orgMetrics: PerformanceMetrics,
    rep: RepIdentity,
    wins: number,
    revenueCents: number,
    avgReplyTimeMinutes: number,
    leaksOwnedCents: number,
): RepPerformance {
    const score = (wins * 5)
        + (orgMetrics.meetingShowRate * 0.03)
        + (orgMetrics.proposalAcceptanceRate * 0.03)
        - (avgReplyTimeMinutes / 30)
        - (leaksOwnedCents / 1_000_000);

    return {
        ...orgMetrics,
        repId: rep.id,
        name: rep.name,
        role: rep.role,
        revenueCents,
        wins,
        avgReplyTimeMinutes,
        leaksOwnedCents,
        score: Math.max(0, Math.round(score * 10) / 10),
    };
}

export async function computeOrgKPIs(orgId: string, window: WindowKey): Promise<PerformanceMetrics> {
    const { days, since } = resolveWindowStart(window);

    const [
        wonMeetings,
        openProposals,
        proposalsInWindow,
        meetingsInWindow,
        openLeaks,
        replyAggregate,
    ] = await Promise.all([
        (prisma as any).meetingPerformance.findMany({
            where: {
                organizationId: orgId,
                outcome: "won",
                session: {
                    startAt: { gte: since },
                },
            },
            select: { closedValue: true },
        }),
        (prisma as any).proposal.findMany({
            where: {
                organizationId: orgId,
                status: "draft",
            },
            select: { pricingEstimate: true },
        }),
        (prisma as any).proposal.findMany({
            where: {
                organizationId: orgId,
                createdAt: { gte: since },
            },
            select: {
                status: true,
            },
        }),
        (prisma as any).meetingSession.findMany({
            where: {
                organizationId: orgId,
                startAt: { gte: since },
            },
            select: { status: true },
        }),
        (prisma as any).profitLeak.findMany({
            where: {
                orgId,
                status: "open",
            },
            select: {
                estimatedLossCents: true,
            },
        }),
        computeOrgReplyAggregate(orgId, since),
    ]);

    const revenueCents = wonMeetings.reduce(
        (sum: number, meeting: { closedValue: number }) => sum + Math.round(meeting.closedValue ?? 0),
        0,
    );
    const mrrCents = Math.round(revenueCents / (days / 30));
    const pipelineCents = openProposals.reduce(
        (sum: number, proposal: { pricingEstimate: string }) => sum + parseProposalValueCents(proposal.pricingEstimate),
        0,
    );
    const acceptedProposals = proposalsInWindow.filter((proposal: { status: string }) => proposal.status === "accepted").length;
    const completedMeetings = meetingsInWindow.filter((meeting: { status: string }) => meeting.status === "completed").length;
    const leaksOpenCents = openLeaks.reduce(
        (sum: number, leak: { estimatedLossCents: number }) => sum + (leak.estimatedLossCents ?? 0),
        0,
    );

    return {
        revenueCents,
        mrrCents,
        pipelineCents,
        proposalsSent: proposalsInWindow.length,
        proposalAcceptanceRate: proposalsInWindow.length > 0
            ? (acceptedProposals / proposalsInWindow.length) * 100
            : 0,
        meetingsBooked: meetingsInWindow.length,
        meetingShowRate: meetingsInWindow.length > 0
            ? (completedMeetings / meetingsInWindow.length) * 100
            : 0,
        avgReplyTimeMinutes: averageMinutes(replyAggregate),
        leaksOpenCents,
        pipelineVelocityDays: 12,
    };
}

export async function computeRepKPIs(orgId: string, repId: string, window: WindowKey): Promise<RepPerformance> {
    const { since } = resolveWindowStart(window);

    const rep = await (prisma as any).salesRep.findUnique({
        where: { id: repId },
        select: {
            id: true,
            name: true,
            role: true,
        },
    });
    if (!rep) {
        throw new Error("Rep not found");
    }

    const assignments = await (prisma as any).salesAssignment.findMany({
        where: { organizationId: orgId, salesRepId: repId },
        select: {
            entityType: true,
            entityId: true,
        },
    });

    const leadIds = assignments
        .filter((assignment: { entityType: string }) => assignment.entityType === "lead")
        .map((assignment: { entityId: string }) => assignment.entityId);
    const proposalIds = assignments
        .filter((assignment: { entityType: string }) => assignment.entityType === "proposal")
        .map((assignment: { entityId: string }) => assignment.entityId);

    const [repMeetings, orgMetrics, replyAggregates, openLeaks] = await Promise.all([
        leadIds.length > 0
            ? (prisma as any).meetingPerformance.findMany({
                where: {
                    organizationId: orgId,
                    outcome: "won",
                    session: {
                        startAt: { gte: since },
                        assessmentId: { in: leadIds },
                    },
                },
                select: { closedValue: true },
            })
            : Promise.resolve([]),
        computeOrgKPIs(orgId, window),
        computeRepReplyAggregates(orgId, since, [repId]),
        (prisma as any).profitLeak.findMany({
            where: {
                orgId,
                status: "open",
            },
            select: {
                estimatedLossCents: true,
                evidenceJson: true,
            },
        }),
    ]);

    const ownedIds = new Set([...leadIds, ...proposalIds]);
    const ownedLeakCents = assignLeakOwnership(openLeaks, new Map([[repId, ownedIds]])).get(repId) ?? 0;
    const revenueCents = repMeetings.reduce(
        (sum: number, meeting: { closedValue: number }) => sum + Math.round(meeting.closedValue ?? 0),
        0,
    );

    return buildRepPerformance(
        orgMetrics,
        rep,
        repMeetings.length,
        revenueCents,
        averageMinutes(replyAggregates.get(repId)),
        ownedLeakCents,
    );
}

export async function buildLeaderboards(orgId: string, window: WindowKey) {
    const { since } = resolveWindowStart(window);

    const reps = await (prisma as any).salesRep.findMany({
        where: { organizationId: orgId, active: true },
        select: {
            id: true,
            name: true,
            role: true,
        },
        orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    const repIds = reps.map((rep: RepIdentity) => rep.id);
    if (repIds.length === 0) {
        return [];
    }

    const [orgMetrics, assignments, replyAggregates, openLeaks] = await Promise.all([
        computeOrgKPIs(orgId, window),
        (prisma as any).salesAssignment.findMany({
            where: {
                organizationId: orgId,
                salesRepId: { in: repIds },
            },
            select: {
                salesRepId: true,
                entityType: true,
                entityId: true,
            },
        }),
        computeRepReplyAggregates(orgId, since, repIds),
        (prisma as any).profitLeak.findMany({
            where: {
                orgId,
                status: "open",
            },
            select: {
                estimatedLossCents: true,
                evidenceJson: true,
            },
        }),
    ]);

    const leadIdsByRep = new Map<string, string[]>();
    const ownedIdsByRep = new Map<string, Set<string>>();
    for (const repId of repIds) {
        leadIdsByRep.set(repId, []);
        ownedIdsByRep.set(repId, new Set<string>());
    }

    for (const assignment of assignments) {
        const ownedIds = ownedIdsByRep.get(assignment.salesRepId) ?? new Set<string>();
        ownedIds.add(assignment.entityId);
        ownedIdsByRep.set(assignment.salesRepId, ownedIds);

        if (assignment.entityType === "lead") {
            const leadIds = leadIdsByRep.get(assignment.salesRepId) ?? [];
            leadIds.push(assignment.entityId);
            leadIdsByRep.set(assignment.salesRepId, leadIds);
        }
    }

    const allLeadIds = [...new Set(Array.from(leadIdsByRep.values()).flat())];
    const repMeetings = allLeadIds.length > 0
        ? await (prisma as any).meetingPerformance.findMany({
            where: {
                organizationId: orgId,
                outcome: "won",
                session: {
                    startAt: { gte: since },
                    assessmentId: { in: allLeadIds },
                },
            },
            select: {
                closedValue: true,
                session: {
                    select: {
                        assessmentId: true,
                    },
                },
            },
        })
        : [];

    const repPerformanceById = new Map<string, { wins: number; revenueCents: number }>();
    const leadOwnerById = new Map<string, string>();
    for (const [repId, leadIds] of leadIdsByRep.entries()) {
        repPerformanceById.set(repId, { wins: 0, revenueCents: 0 });
        for (const leadId of leadIds) {
            leadOwnerById.set(leadId, repId);
        }
    }

    for (const meeting of repMeetings) {
        const assessmentId = meeting.session?.assessmentId;
        if (!assessmentId) {
            continue;
        }

        const repId = leadOwnerById.get(assessmentId);
        if (!repId) {
            continue;
        }

        const totals = repPerformanceById.get(repId) ?? { wins: 0, revenueCents: 0 };
        totals.wins += 1;
        totals.revenueCents += Math.round(meeting.closedValue ?? 0);
        repPerformanceById.set(repId, totals);
    }

    const ownedLeakCentsByRep = assignLeakOwnership(openLeaks, ownedIdsByRep);

    const leaderboard = reps.map((rep: RepIdentity) => {
        const repTotals = repPerformanceById.get(rep.id) ?? { wins: 0, revenueCents: 0 };
        return buildRepPerformance(
            orgMetrics,
            rep,
            repTotals.wins,
            repTotals.revenueCents,
            averageMinutes(replyAggregates.get(rep.id)),
            ownedLeakCentsByRep.get(rep.id) ?? 0,
        );
    });

    return leaderboard.sort((left: RepPerformance, right: RepPerformance) => right.score - left.score);
}

export async function upsertPerformanceSnapshot(orgId: string, window: WindowKey) {
    const [orgStats, leaderboards] = await Promise.all([
        computeOrgKPIs(orgId, window),
        buildLeaderboards(orgId, window),
    ]);

    return (prisma as any).performanceSnapshot.create({
        data: {
            organizationId: orgId,
            window,
            statsJson: JSON.stringify({
                org: orgStats,
                leaderboards,
            }),
        },
    });
}
