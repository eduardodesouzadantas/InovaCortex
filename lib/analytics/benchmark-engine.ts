/**
 * lib/analytics/benchmark-engine.ts
 * 
 * V30 Market Intelligence Engine
 * 
 * Aggregates anonymized metrics across organizations to generate 
 * industry benchmarks. Ensures privacy through sample size minimums.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const MIN_SAMPLE_SIZE = 3;

/**
 * Sweeps all organizations, computes their internal KPIs, and aggregates them into global benchmarks.
 * Typically run weekly via Cron.
 */
export async function generateIndustryBenchmarks() {
    logger.info("Running Market Intelligence Benchmark Aggregation...");

    // 1. Group active organizations by industry (Defaulting to general since industry isn't strongly typed on org yet)
    const orgs = await prisma.organization.findMany({
        select: { id: true }
    });

    const industryGroups = orgs.reduce((acc, org) => {
        const slug = "general";
        if (!acc[slug]) acc[slug] = [];
        acc[slug].push(org.id);
        return acc;
    }, {} as Record<string, string[]>);

    // We also want a global "all industries" metric
    industryGroups["all"] = orgs.map(o => o.id);

    const newBenchmarks = [];

    // 2. Perform aggregation per industry
    for (const [industry, orgIds] of Object.entries(industryGroups)) {
        if (orgIds.length < MIN_SAMPLE_SIZE && industry !== "general") {
            logger.info(`Skipping industry '${industry}' due to low sample size (${orgIds.length} < ${MIN_SAMPLE_SIZE})`);
            continue;
        }

        // A. Proposal Acceptance Rate
        const proposalStats = await aggregateProposalMetrics(orgIds);
        if (proposalStats.sampleSize >= MIN_SAMPLE_SIZE) {
            newBenchmarks.push({
                industry,
                metric: "proposal_acceptance",
                value: proposalStats.acceptanceRate,
                sampleSize: proposalStats.sampleSize,
                period: "monthly"
            });

            newBenchmarks.push({
                industry,
                metric: "average_deal_size",
                value: proposalStats.avgDealSize,
                sampleSize: proposalStats.sampleSize,
                period: "monthly"
            });

            newBenchmarks.push({
                industry,
                metric: "pipeline_velocity",
                value: proposalStats.velocityDays,
                sampleSize: proposalStats.sampleSize,
                period: "monthly"
            });
        }

        // B. Meeting Show Rate (proxy via system events)
        const meetingStats = await aggregateMeetingMetrics(orgIds);
        if (meetingStats.sampleSize >= MIN_SAMPLE_SIZE) {
            newBenchmarks.push({
                industry,
                metric: "meeting_show_rate",
                value: meetingStats.showRate,
                sampleSize: meetingStats.sampleSize,
                period: "monthly"
            });
        }
    }

    // 3. Upsert into database (Neutralized because BenchmarkMetric is missing from the Prisma schema)
    for (const b of newBenchmarks) {
        // TODO: Re-enable when BenchmarkMetric is added to the database.
        logger.info(`Mock upserted benchmark ${b.metric} for ${b.industry}: ${b.value}`);
    }

    logger.info(`Market Intelligence Engineering completed. Upserted ${newBenchmarks.length} benchmark metrics.`);
    return newBenchmarks;
}

// --- Helper Aggregators ---

async function aggregateProposalMetrics(orgIds: string[]) {
    // We need to calculate the average of averages to avoid one massive org skewing the benchmark.
    let sumRates = 0;
    let sumDealSize = 0;
    let sumVelocity = 0;
    let validOrgs = 0;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    for (const orgId of orgIds) {
        const proposals = await prisma.proposal.findMany({
            where: { organizationId: orgId, createdAt: { gte: thirtyDaysAgo } },
            select: { status: true, pricingEstimate: true, updatedAt: true, createdAt: true }
        });

        if (proposals.length === 0) continue;

        const accepted = proposals.filter(p => p.status === 'accepted');
        const rate = (accepted.length / proposals.length) * 100;

        // Deal size in decimal format
        let avgDeal = 0;
        let avgVelocity = 0;

        if (accepted.length > 0) {
            avgDeal = accepted.reduce((acc, p) => {
                try {
                    const pe = JSON.parse(p.pricingEstimate);
                    return acc + (pe.min || 0);
                } catch { return acc; }
            }, 0) / accepted.length / 100;

            const velocitySum = accepted.reduce((acc, p) => {
                if (!p.updatedAt) return acc;
                const days = Math.abs(p.updatedAt.getTime() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24);
                return acc + days;
            }, 0);
            avgVelocity = velocitySum / accepted.length;
        }

        sumRates += rate;
        sumDealSize += avgDeal;
        sumVelocity += avgVelocity;
        validOrgs++;
    }

    return {
        acceptanceRate: validOrgs > 0 ? sumRates / validOrgs : 0,
        avgDealSize: validOrgs > 0 ? sumDealSize / validOrgs : 0,
        velocityDays: validOrgs > 0 ? sumVelocity / validOrgs : 0,
        sampleSize: validOrgs
    };
}


async function aggregateMeetingMetrics(orgIds: string[]) {
    // Placeholder logic proxying system events for meeting shows vs no-shows
    let sumRates = 0;
    let validOrgs = 0;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    for (const orgId of orgIds) {
        const scheduled = await prisma.systemEvent.count({
            where: { organizationId: orgId, type: 'meeting_scheduled', createdAt: { gte: thirtyDaysAgo } }
        });

        const noShows = await prisma.systemEvent.count({
            where: { organizationId: orgId, type: 'meeting_no_show', createdAt: { gte: thirtyDaysAgo } }
        });

        if (scheduled > 0) {
            const showRate = Math.max(0, ((scheduled - noShows) / scheduled) * 100);
            sumRates += showRate;
            validOrgs++;
        }
    }

    return {
        showRate: validOrgs > 0 ? sumRates / validOrgs : 0,
        sampleSize: validOrgs
    };
}
