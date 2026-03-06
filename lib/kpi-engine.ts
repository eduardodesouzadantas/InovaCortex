/**
 * lib/kpi-engine.ts
 * V27: Live KPI Aggregation Engine
 * Calculates metrics deterministically for the CEO Command Center.
 */

import { prisma } from "@/lib/prisma";

export interface LiveKPIs {
    monthlyRevenueCents: number;
    pipelineValueCents: number;
    conversionRate: number;
    averageDealSizeCents: number;
    lostRevenueCents: number;
    proposalAcceptanceRate: number;
    activeWorkspaces: number;
}

export async function getLiveKPIs(orgId: string): Promise<LiveKPIs> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Monthly Revenue (paid billing records this month)
    const billingAgg = await (prisma as any).billingRecord.aggregate({
        _sum: { amountCents: true },
        _count: { id: true },
        where: {
            orgId,
            status: { in: ['paid', 'stub_paid'] },
            updatedAt: { gte: startOfMonth },
        },
    });

    const monthlyRevenueCents = billingAgg._sum.amountCents || 0;
    const closedCount = billingAgg._count.id || 0;
    const averageDealSizeCents = closedCount > 0 ? Math.floor(monthlyRevenueCents / closedCount) : 0;

    // 2. Pipeline Value (expected revenue from scheduled meetings)
    const pipelineAgg = await (prisma as any).meetingSession.aggregate({
        _sum: { expectedRevenue: true },
        where: {
            organizationId: orgId,
            status: 'scheduled',
        },
    });

    const pipelineValueCents = Math.floor((pipelineAgg._sum.expectedRevenue || 0) * 100);

    // 3. Conversion Metric & Acceptance Rate
    const propsAgg = await (prisma as any).proposal.groupBy({
        by: ['status'],
        where: { organizationId: orgId },
        _count: { id: true },
    });

    let totalProposals = 0;
    let acceptedProposals = 0;
    propsAgg.forEach((p: any) => {
        totalProposals += p._count.id;
        if (p.status === 'accepted') {
            acceptedProposals += p._count.id;
        }
    });

    const proposalAcceptanceRate = totalProposals > 0 ? (acceptedProposals / totalProposals) : 0;

    // 4. Lost Revenue (from open Profit Leaks)
    const leakAgg = await (prisma as any).profitLeak.aggregate({
        _sum: { estimatedLossCents: true },
        where: {
            orgId,
            status: 'open',
        },
    });
    const lostRevenueCents = leakAgg._sum.estimatedLossCents || 0;

    // 5. Active Workspaces Load
    const activeWorkspaces = await (prisma as any).clientWorkspace.count({
        where: {
            organizationId: orgId,
            status: { in: ['provisioning', 'active'] },
        },
    });

    // Rough funnel conversion: Assessmenets -> Paid
    const totalAssessments = await (prisma as any).assessment.count({
        where: { organizationId: orgId },
    });
    const conversionRate = totalAssessments > 0 ? (closedCount / totalAssessments) : 0;

    return {
        monthlyRevenueCents,
        pipelineValueCents,
        conversionRate,
        averageDealSizeCents,
        lostRevenueCents,
        proposalAcceptanceRate,
        activeWorkspaces,
    };
}
