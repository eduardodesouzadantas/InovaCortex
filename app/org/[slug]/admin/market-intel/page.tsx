import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { deriveSizeBand, normalizeIndustry, normalizePlan } from "@/lib/market-intel/segment-utils";
import { MarketIntelClient } from "./market-intel-client";

export default async function AdminMarketIntelPage({ params }: { params: { slug: string } }) {
    let ctx;
    try {
        ctx = await requireOrgContext(params.slug);
        assertRole(ctx.role, "admin");
    } catch {
        redirect(`/org/${params.slug}/admin/login`);
    }

    const org = await prisma.organization.findUnique({
        where: { id: ctx.orgId },
        select: { id: true, industry: true, maxUsers: true, plan: true }
    });

    if (!org) return <div>Organizacao nao encontrada</div>;

    // Calculate baseline local metrics (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const proposals = await prisma.proposal.findMany({
        where: { organizationId: org.id, createdAt: { gte: thirtyDaysAgo } },
        select: { status: true, pricingEstimate: true, createdAt: true, updatedAt: true }
    });

    let localAcceptanceRate = 0;
    let localAvgDealSize = 0;
    let localPipelineVelocity = 0;

    if (proposals.length > 0) {
        const accepted = proposals.filter(p => p.status === "accepted");
        localAcceptanceRate = (accepted.length / proposals.length) * 100;

        if (accepted.length > 0) {
            localAvgDealSize = accepted.reduce((acc, p) => {
                try {
                    const pe = JSON.parse(p.pricingEstimate);
                    return acc + (pe.min || 0);
                } catch {
                    return acc;
                }
            }, 0) / accepted.length / 100;

            const velocitySum = accepted.reduce((acc, p) => {
                const days = Math.abs(p.updatedAt.getTime() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24);
                return acc + days;
            }, 0);
            localPipelineVelocity = velocitySum / accepted.length;
        }
    }

    const scheduledMeetings = await prisma.systemEvent.count({
        where: { organizationId: org.id, type: "meeting_scheduled", createdAt: { gte: thirtyDaysAgo } }
    });
    const noShows = await prisma.systemEvent.count({
        where: { organizationId: org.id, type: "meeting_no_show", createdAt: { gte: thirtyDaysAgo } }
    });

    let localMeetingShowRate = 0;
    if (scheduledMeetings > 0) {
        localMeetingShowRate = Math.max(0, ((scheduledMeetings - noShows) / scheduledMeetings) * 100);
    }

    const companyMetrics = {
        proposalAcceptanceRate: localAcceptanceRate,
        averageDealSize: localAvgDealSize,
        pipelineVelocityDays: localPipelineVelocity,
        meetingShowRate: localMeetingShowRate
    };

    return (
        <MarketIntelClient
            orgSlug={params.slug}
            companyMetrics={companyMetrics}
            orgData={{
                industry: normalizeIndustry(org.industry),
                sizeBand: deriveSizeBand(org.maxUsers),
                plan: normalizePlan(org.plan)
            }}
        />
    );
}
