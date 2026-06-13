import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";
import {
    invalidTenantInputResponse,
    resolveTenantRouteError,
    tenantContextErrorResponse,
    tenantNotFoundResponse,
} from "@/lib/auth/tenant-route";
import { writeAuditEvent } from "@/lib/audit";
import {
    deriveSizeBand,
    isValidMarketWindow,
    normalizeIndustry,
    normalizePlan,
    type MarketWindow,
} from "@/lib/market-intel/segment-utils";

type SegmentQuery = {
    industry: string;
    sizeBand: string;
    plan: string;
    timeWindow: MarketWindow;
};

async function findBestSegment(query: SegmentQuery) {
    const attempts = [
        { industry: query.industry, sizeBand: query.sizeBand, plan: query.plan, timeWindow: query.timeWindow },
        { industry: query.industry, sizeBand: query.sizeBand, plan: "all", timeWindow: query.timeWindow },
        { industry: query.industry, sizeBand: "all", plan: "all", timeWindow: query.timeWindow },
        { industry: "all", sizeBand: "all", plan: "all", timeWindow: query.timeWindow },
    ] as const;

    for (const attempt of attempts) {
        const segment = await prisma.benchmarkSegment.findFirst({
            where: {
                industry: { equals: attempt.industry, mode: "insensitive" },
                sizeBand: { equals: attempt.sizeBand, mode: "insensitive" },
                plan: { equals: attempt.plan, mode: "insensitive" },
                timeWindow: attempt.timeWindow,
            },
            include: { snapshots: true },
            orderBy: { periodEnd: "desc" }
        });
        if (segment) return segment;
    }

    return null;
}

/**
 * GET /api/org/[slug]/market-intel/snapshots?window=30d
 * Contract:
 * - 200 { ok: true, insufficientData: false, segment, snapshot }
 * - 200 { ok: true, insufficientData: true, segment: null, snapshot: null, message }
 */
async function GETHandler(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const { orgId } = await requireOrgContext(slug);
        const url = new URL(request.url);
        const windowRaw = (url.searchParams.get("window") || "30d").toLowerCase();

        if (!isValidMarketWindow(windowRaw)) {
            return invalidTenantInputResponse("Invalid window. Allowed values: 7d, 30d, 90d");
        }

        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { id: true, industry: true, maxUsers: true, plan: true }
        });
        if (!org) return tenantNotFoundResponse("Organization not found");

        const segmentQuery: SegmentQuery = {
            industry: normalizeIndustry(org.industry),
            sizeBand: deriveSizeBand(org.maxUsers),
            plan: normalizePlan(org.plan),
            timeWindow: windowRaw,
        };

        const targetSegment = await findBestSegment(segmentQuery);
        if (!targetSegment || !targetSegment.snapshots) {
            return NextResponse.json({
                ok: true,
                insufficientData: true,
                insufficient_data: true,
                message: "No K-anonymity benchmark bucket available for this segment yet.",
                segment: null,
                snapshot: null,
            });
        }

        let snapshot: Record<string, number> | null = null;
        try {
            snapshot = JSON.parse(targetSegment.snapshots.metrics);
        } catch {
            return resolveTenantRouteError(new Error("BENCHMARK_SNAPSHOT_INVALID"), "Benchmark snapshot is invalid");
        }

        await writeAuditEvent({
            organizationId: org.id,
            action: "benchmarkViewed",
            details: { segmentId: targetSegment.id, window: windowRaw },
            strict: true,
            context: { segmentId: targetSegment.id, window: windowRaw },
        });

        return NextResponse.json({
            ok: true,
            insufficientData: false,
            insufficient_data: false,
            segment: {
                orgCount: targetSegment.orgCount,
                industry: targetSegment.industry,
                sizeBand: targetSegment.sizeBand,
                plan: targetSegment.plan,
                periodEnd: targetSegment.periodEnd
            },
            snapshot,
        });
    } catch (e: unknown) {
        const authResponse = tenantContextErrorResponse(e);
        if (authResponse) return authResponse;

        console.error("Market Intel GET Error:", e);
        return resolveTenantRouteError(e, "Failed to fetch benchmarks");
    }
}

export const GET = withApiLogging("/api/org/[slug]/market-intel/snapshots", "GET", GETHandler);
