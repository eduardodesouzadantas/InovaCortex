import { prisma } from "@/lib/prisma";
import { BenchmarksClient } from "./benchmarks-client";

export default async function AdminBenchmarksPage({ params }: { params: { slug: string } }) {
    const { slug } = await params;

    const org = await prisma.organization.findUnique({
        where: { slug }
    });

    if (!org) return <div>Org not found</div>;

    // Fetch the latest generated benchmarks for the org's industry Or 'all'
    const benchmarks = await prisma.benchmarkMetric.findMany({
        where: {
            industry: { in: ['general', 'all'] },
            period: "monthly"
        }
    });

    // We also need the org's current local metrics to compare against the benchmark
    // In a real scenario, this would be computed on the fly or fetched from a materialized view
    // Here we'll mock the company's vital metrics for demonstration in the V30 MVP UI

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const proposals = await prisma.proposal.findMany({
        where: { organizationId: org.id, createdAt: { gte: thirtyDaysAgo } },
        select: { status: true, pricingEstimate: true }
    });

    let localAcceptanceRate = 0;
    let localAvgDealSize = 0;

    if (proposals.length > 0) {
        const accepted = proposals.filter(p => p.status === 'accepted');
        localAcceptanceRate = (accepted.length / proposals.length) * 100;
        if (accepted.length > 0) {
            localAvgDealSize = accepted.reduce((acc, p) => {
                try {
                    const pe = JSON.parse(p.pricingEstimate);
                    return acc + (pe.min || 0);
                } catch { return acc; }
            }, 0) / accepted.length / 100;
        }
    }

    const companyMetrics = {
        proposal_acceptance: localAcceptanceRate,
        average_deal_size: localAvgDealSize,
        pipeline_velocity: 14.5, // Mock local value
        meeting_show_rate: 65    // Mock local value
    };

    return (
        <BenchmarksClient
            orgSlug={slug}
            benchmarks={benchmarks}
            companyMetrics={companyMetrics}
            industry={org.industry || 'General'}
        />
    );
}
