import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
    deriveSizeBand,
    isValidMarketWindow,
    MARKET_WINDOWS,
    normalizeIndustry,
    normalizePlan,
    type MarketWindow,
} from "@/lib/market-intel/segment-utils";

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

export interface WindowSnapshotStats {
    window: MarketWindow;
    segmentCount: number;
    snapshotCount: number;
    oldestPeriodStart: Date | null;
    latestPeriodEnd: Date | null;
}

export interface GenerateSnapshotsResult {
    window: MarketWindow;
    periodStart: Date;
    periodEnd: Date;
    segmentCount: number;
    snapshotCount: number;
    createdSegmentIds: string[];
}

export interface BackfillWindowResult {
    window: MarketWindow;
    before: WindowSnapshotStats;
    generated: GenerateSnapshotsResult;
    pruned: {
        segmentCount: number;
        snapshotCount: number;
    };
    after: WindowSnapshotStats;
}

export interface BackfillResult {
    startedAt: Date;
    finishedAt: Date;
    windows: BackfillWindowResult[];
}

function assertMarketWindow(window: string): asserts window is MarketWindow {
    if (!isValidMarketWindow(window)) {
        throw new Error(`INVALID_WINDOW:${window}`);
    }
}

function dedupeWindows(windows: MarketWindow[]): MarketWindow[] {
    return Array.from(new Set(windows));
}

async function getSegmentsByWindow(window: MarketWindow) {
    return prisma.benchmarkSegment.findMany({
        where: { timeWindow: window },
        select: { id: true, periodStart: true, periodEnd: true },
    });
}

export async function getWindowSnapshotStats(window: MarketWindow): Promise<WindowSnapshotStats> {
    const segments = await getSegmentsByWindow(window);
    const segmentIds = segments.map((s) => s.id);
    const snapshotCount = segmentIds.length > 0
        ? await prisma.benchmarkSnapshot.count({ where: { segmentId: { in: segmentIds } } })
        : 0;

    const oldestPeriodStart = segments.length > 0
        ? new Date(Math.min(...segments.map((s) => s.periodStart.getTime())))
        : null;
    const latestPeriodEnd = segments.length > 0
        ? new Date(Math.max(...segments.map((s) => s.periodEnd.getTime())))
        : null;

    return {
        window,
        segmentCount: segments.length,
        snapshotCount,
        oldestPeriodStart,
        latestPeriodEnd,
    };
}

export async function inspectBackfillImpact(
    windows: MarketWindow[] = MARKET_WINDOWS,
): Promise<WindowSnapshotStats[]> {
    const normalized = dedupeWindows(windows);
    return Promise.all(normalized.map((window) => getWindowSnapshotStats(window)));
}

/**
 * 1. Build initial Segments
 * Groups organizations into distinct buckets based on their dimensions.
 */
export function buildSegments(orgs: OrgData[], window: MarketWindow): SegmentCandidate[] {
    const buckets: Record<string, SegmentCandidate> = {};

    for (const org of orgs) {
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
 */
export function enforceKAnonymity(segments: SegmentCandidate[], threshold: number = K_ANONYMITY_THRESHOLD): SegmentCandidate[] {
    const validSegments: SegmentCandidate[] = [];
    const collapsedBuckets: Record<string, SegmentCandidate> = {};

    for (const segment of segments) {
        if (segment.orgs.length >= threshold) {
            validSegments.push(segment);
            continue;
        }

        const collapsedPlanKey = `${segment.industry}-${segment.sizeBand}-all`;
        if (!collapsedBuckets[collapsedPlanKey]) {
            collapsedBuckets[collapsedPlanKey] = {
                industry: segment.industry,
                sizeBand: segment.sizeBand,
                plan: "all",
                orgs: []
            };
        }

        for (const orgId of segment.orgs) {
            if (!collapsedBuckets[collapsedPlanKey].orgs.includes(orgId)) {
                collapsedBuckets[collapsedPlanKey].orgs.push(orgId);
            }
        }
    }

    for (const segment of Object.values(collapsedBuckets)) {
        if (segment.orgs.length >= threshold) {
            validSegments.push(segment);
            continue;
        }

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

    const finalSegments: SegmentCandidate[] = [...validSegments];
    const industryOnlyBuckets = Object.values(collapsedBuckets).filter((s) => s.sizeBand === "all" && s.plan === "all");
    for (const segment of industryOnlyBuckets) {
        if (segment.orgs.length >= threshold) {
            const exists = finalSegments.find((s) => s.industry === segment.industry && s.sizeBand === "all" && s.plan === "all");
            if (!exists) {
                finalSegments.push(segment);
            }
        }
    }

    const allOrgs = segments.flatMap((s) => s.orgs);
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
export async function computeMetricsForSegment(segment: SegmentCandidate, window: MarketWindow) {
    const days = parseInt(window.replace("d", ""), 10);
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    let sumAcceptanceRate = 0;
    let sumVelocityDays = 0;
    let sumDealSize = 0;
    let validProposalOrgs = 0;

    let sumShowRates = 0;
    let validMeetingOrgs = 0;

    for (const orgId of segment.orgs) {
        const proposals = await prisma.proposal.findMany({
            where: { organizationId: orgId, createdAt: { gte: startDate } },
            select: { status: true, pricingEstimate: true, createdAt: true, updatedAt: true }
        });

        if (proposals.length > 0) {
            const accepted = proposals.filter((p) => p.status === "accepted");
            const rate = (accepted.length / proposals.length) * 100;

            let avgDeal = 0;
            let avgVelocity = 0;

            if (accepted.length > 0) {
                avgDeal = accepted.reduce((acc, p) => {
                    try {
                        const pe = JSON.parse(p.pricingEstimate);
                        return acc + (pe.min || 0);
                    } catch {
                        return acc;
                    }
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

        const scheduled = await prisma.systemEvent.count({
            where: { organizationId: orgId, type: "meeting_scheduled", createdAt: { gte: startDate } }
        });
        const noShows = await prisma.systemEvent.count({
            where: { organizationId: orgId, type: "meeting_no_show", createdAt: { gte: startDate } }
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
 * 4. Generate snapshots for a window.
 */
export async function generateSnapshots(window: MarketWindow = "30d"): Promise<GenerateSnapshotsResult> {
    assertMarketWindow(window);
    logger.info(`Starting Market Intelligence Aggregation Engine (Window: ${window})`);

    const orgsRaw = await prisma.organization.findMany({
        select: { id: true, industry: true, maxUsers: true, plan: true }
    });

    const orgs: OrgData[] = orgsRaw.map((o) => ({
        id: o.id,
        industry: normalizeIndustry(o.industry),
        sizeBand: deriveSizeBand(o.maxUsers),
        plan: normalizePlan(o.plan)
    }));

    const rawSegments = buildSegments(orgs, window);
    const validSegments = enforceKAnonymity(rawSegments);

    logger.info(`Valid K-Anonymity segments generated: ${validSegments.length}`);

    const periodEnd = new Date();
    const days = parseInt(window.replace("d", ""), 10);
    const periodStart = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    const createdSegmentIds: string[] = [];

    for (const seg of validSegments) {
        const metrics = await computeMetricsForSegment(seg, window);
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
        createdSegmentIds.push(dbSegment.id);

        await prisma.benchmarkSnapshot.create({
            data: {
                segmentId: dbSegment.id,
                metrics: JSON.stringify(metrics)
            }
        });
    }

    logger.info(`Market Intelligence run complete.`, {
        window,
        segments: createdSegmentIds.length,
    });

    return {
        window,
        periodStart,
        periodEnd,
        segmentCount: createdSegmentIds.length,
        snapshotCount: createdSegmentIds.length,
        createdSegmentIds,
    };
}

async function pruneWindowExcept(window: MarketWindow, keepSegmentIds: string[]) {
    const oldSegments = await prisma.benchmarkSegment.findMany({
        where: keepSegmentIds.length > 0
            ? { timeWindow: window, id: { notIn: keepSegmentIds } }
            : { timeWindow: window },
        select: { id: true }
    });
    const oldIds = oldSegments.map((s) => s.id);
    if (oldIds.length === 0) {
        return { segmentCount: 0, snapshotCount: 0 };
    }

    const deletedSnapshots = await prisma.benchmarkSnapshot.deleteMany({
        where: { segmentId: { in: oldIds } }
    });
    const deletedSegments = await prisma.benchmarkSegment.deleteMany({
        where: { id: { in: oldIds } }
    });

    return {
        segmentCount: deletedSegments.count,
        snapshotCount: deletedSnapshots.count,
    };
}

/**
 * Safe backfill strategy:
 * 1) Generate a fresh window with the current segmentation logic.
 * 2) Prune all previous records for that window.
 */
export async function backfillWindow(window: MarketWindow): Promise<BackfillWindowResult> {
    assertMarketWindow(window);
    const before = await getWindowSnapshotStats(window);
    const generated = await generateSnapshots(window);
    const pruned = await pruneWindowExcept(window, generated.createdSegmentIds);
    const after = await getWindowSnapshotStats(window);

    return { window, before, generated, pruned, after };
}

export async function backfillSnapshots(
    windows: MarketWindow[] = MARKET_WINDOWS,
): Promise<BackfillResult> {
    const normalized = dedupeWindows(windows);
    normalized.forEach((window) => assertMarketWindow(window));

    const startedAt = new Date();
    const results: BackfillWindowResult[] = [];
    for (const window of normalized) {
        results.push(await backfillWindow(window));
    }
    const finishedAt = new Date();

    return {
        startedAt,
        finishedAt,
        windows: results,
    };
}
