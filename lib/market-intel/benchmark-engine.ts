import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const K_ANONYMITY_THRESHOLD = 8;

export interface OrgData {
    id: string;
    industry: string;
    sizeBand: string;
    plan: string;
}

export interface SegmentCandidate {
    industry: string;
    sizeBand: string;
    plan: string;
    orgs: string[];
}

/**
 * 1. Build initial Segments
 * Groups organizations into distinct buckets based on their dimensions.
 */
export function buildSegments(orgs: OrgData[], window: "7d" | "30d" | "90d"): SegmentCandidate[] {
    const buckets: Record<string, SegmentCandidate> = {};

    for (const org of orgs) {
        // Industry + SizeBand + Plan combination
        const key = `${org.industry}-${org.sizeBand}-${org.plan}`;
        if (!buckets[key]) {
            buckets[key] = {
                industry: org.industry,
                sizeBand: org.sizeBand,
                plan: org.plan,
                orgs: []
            };
        }
        buckets[key].orgs.push(org.id);
    }

    return Object.values(buckets);
}

/**
 * 2. Enforce K-Anonymity (Bucket Collapse)
 * Removes dimensions (Plan, then SizeBand) until the segment hits the K threshold.
 * If dropping all dimensions still fails K, the segment is discarded.
 */
export function enforceKAnonymity(segments: SegmentCandidate[], threshold: number = K_ANONYMITY_THRESHOLD): SegmentCandidate[] {
    const validSegments: SegmentCandidate[] = [];
    const collapsedBuckets: Record<string, SegmentCandidate> = {};

    for (const segment of segments) {
        if (segment.orgs.length >= threshold) {
            validSegments.push(segment);
            continue;
        }

        // Try collapsing Plan first: "clinics-small-ALL"
        const collapsedPlanKey = `${segment.industry}-${segment.sizeBand}-all`;
        if (!collapsedBuckets[collapsedPlanKey]) {
            collapsedBuckets[collapsedPlanKey] = {
                industry: segment.industry,
                sizeBand: segment.sizeBand,
                plan: "all",
                orgs: []
            };
        }

        // Merge orgs to prevent duplicates if already pushed
        for (const orgId of segment.orgs) {
            if (!collapsedBuckets[collapsedPlanKey].orgs.includes(orgId)) {
                collapsedBuckets[collapsedPlanKey].orgs.push(orgId);
            }
        }
    }

    // Secondary pass on collapsed Plan buckets
    for (const segment of Object.values(collapsedBuckets)) {
        if (segment.orgs.length >= threshold) {
            validSegments.push(segment);
            continue;
        }

        // Collapse SizeBand next: "clinics-ALL-ALL"
        const collapsedSizeKey = `${segment.industry}-all-all`;
        if (!collapsedBuckets[collapsedSizeKey]) {
            collapsedBuckets[collapsedSizeKey] = {
                industry: segment.industry,
                sizeBand: "all",
                plan: "all",
                orgs: []
            };
        }
        for (const orgId of segment.orgs) {
            if (!collapsedBuckets[collapsedSizeKey].orgs.includes(orgId)) {
                collapsedBuckets[collapsedSizeKey].orgs.push(orgId);
            }
        }
    }

    // Tertiary check for industry-only segments
    const finalSegments: SegmentCandidate[] = [...validSegments];
    const industryOnlyBuckets = Object.values(collapsedBuckets).filter(s => s.sizeBand === 'all' && s.plan === 'all');
    for (const segment of industryOnlyBuckets) {
        if (segment.orgs.length >= threshold) {
            // Prevent duplicate global industry inclusion if we already have it
            const exists = finalSegments.find(s => s.industry === segment.industry && s.sizeBand === 'all' && s.plan === 'all');
            if (!exists) {
                finalSegments.push(segment);
            }
        }
    }

    // One giant "Global All" fallback bucket just to safely contain raw medians if everything fails (optional)
    const allOrgs = segments.flatMap(s => s.orgs);
    const uniqueAllOrgs = Array.from(new Set(allOrgs));
    if (uniqueAllOrgs.length >= threshold) {
        finalSegments.push({
            industry: "all",
            sizeBand: "all",
            plan: "all",
            orgs: uniqueAllOrgs
        });
    }

    return finalSegments;
}

/**
 * 3. Compute Aggregated Metrics
 */
export async function computeMetricsForSegment(segment: SegmentCandidate, window: "7d" | "30d" | "90d") {
    const days = parseInt(window.replace('d', ''));
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    let sumAcceptanceRate = 0;
    let sumVelocityDays = 0;
    let sumDealSize = 0;
    let validProposalOrgs = 0;

    let sumShowRates = 0;
    let validMeetingOrgs = 0;

    for (const orgId of segment.orgs) {
        // --- PROPOSAL METRICS ---
        const proposals = await prisma.proposal.findMany({
            where: { organizationId: orgId, createdAt: { gte: startDate } },
            select: { status: true, pricingEstimate: true, createdAt: true, updatedAt: true }
        });

        if (proposals.length > 0) {
            const accepted = proposals.filter(p => p.status === 'accepted');
            const rate = (accepted.length / proposals.length) * 100;

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
                    const daysDiff = Math.abs(p.updatedAt.getTime() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24);
                    return acc + daysDiff;
                }, 0);
                avgVelocity = velocitySum / accepted.length;
            }

            sumAcceptanceRate += rate;
            sumDealSize += avgDeal;
            sumVelocityDays += avgVelocity;
            validProposalOrgs++;
        }

        // --- MEETING METRICS ---
        const scheduled = await prisma.systemEvent.count({
            where: { organizationId: orgId, type: 'meeting_scheduled', createdAt: { gte: startDate } }
        });
        const noShows = await prisma.systemEvent.count({
            where: { organizationId: orgId, type: 'meeting_no_show', createdAt: { gte: startDate } }
        });

        if (scheduled > 0) {
            const showRate = Math.max(0, ((scheduled - noShows) / scheduled) * 100);
            sumShowRates += showRate;
            validMeetingOrgs++;
        }
    }

    return {
        proposalAcceptanceRate: validProposalOrgs > 0 ? sumAcceptanceRate / validProposalOrgs : 0,
        pipelineVelocityDays: validProposalOrgs > 0 ? sumVelocityDays / validProposalOrgs : 0,
        averageDealSize: validProposalOrgs > 0 ? sumDealSize / validProposalOrgs : 0,
        meetingShowRate: validMeetingOrgs > 0 ? sumShowRates / validMeetingOrgs : 0,
    };
}

/**
 * 4. Generate Snapshots
 * Sweeps db, builds segments, filters by K-Anonymity, calculates metrics and upserts.
 */
export async function generateSnapshots(window: "7d" | "30d" | "90d" = "30d") {
    logger.info(`Starting Market Intelligence Aggregation Engine (Window: ${window})`);

    const orgsRaw = await prisma.organization.findMany({
        select: { id: true, plan: true }
    });

    // Map DB organization to abstract OrgData.
    // If industry and sizeBand don't exist yet on the schema, mock them for the POC. 
    const orgs: OrgData[] = orgsRaw.map(o => ({
        id: o.id,
        industry: (o as any).industry || "general",
        sizeBand: (o as any).sizeBand || "small",
        plan: o.plan || "free"
    }));

    const rawSegments = buildSegments(orgs, window);
    const validSegments = enforceKAnonymity(rawSegments);

    logger.info(`Valid K-Anonymity segments generated: ${validSegments.length}`);

    const periodEnd = new Date();
    const days = parseInt(window.replace('d', ''));
    const periodStart = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    for (const seg of validSegments) {
        const metrics = await computeMetricsForSegment(seg, window);

        // Save Segment Metadata
        const dbSegment = await prisma.benchmarkSegment.create({
            data: {
                orgCount: seg.orgs.length,
                industry: seg.industry,
                sizeBand: seg.sizeBand,
                plan: seg.plan,
                timeWindow: window,
                periodStart,
                periodEnd
            }
        });

        // Save Snapshot
        await prisma.benchmarkSnapshot.create({
            data: {
                segmentId: dbSegment.id,
                metrics: JSON.stringify(metrics)
            }
        });
    }

    logger.info(`Market Intelligence run complete.`);
}
