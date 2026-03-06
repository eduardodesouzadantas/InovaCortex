import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";
import { getCached, setCached, makeCacheKey } from "@/lib/agentops/cache";
import { logger } from "@/lib/logger";

/**
 * GET /api/org/[slug]/executive/intelligence
 * Consolidated data from the 3 CEO Weapon engines.
 * Admin/Owner only. Cache: 60s.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;

        // 1. Auth & RBAC
        const session = await getSession();
        if (!session || session.orgSlug !== slug) {
            return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        }

        if (!hasRole(session.role, "admin")) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }

        const org = await prisma.organization.findUnique({
            where: { slug },
            select: { id: true }
        });
        if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

        // 2. Cache Check (60s TTL)
        const cacheKey = makeCacheKey("ExecutiveIntelligence", "all", { orgId: org.id }).keyHash;
        const hit = await getCached(org.id, cacheKey, 60 * 1000);
        if (hit) {
            return NextResponse.json({
                ...hit.output as any,
                meta: { cached: true, timestamp: hit.createdAt }
            });
        }

        // 3. Parallel Engine Calls
        const [
            { computeRevenueOpportunities },
            { scanRevenueLeaks },
            { generateDailyActions }
        ] = await Promise.all([
            import("@/lib/analytics/revenue-brain"),
            import("@/lib/analytics/leak-detector"),
            import("@/lib/analytics/action-engine")
        ]);

        const [revenueBrain, leakDetector, actionEngine] = await Promise.all([
            computeRevenueOpportunities(org.id),
            scanRevenueLeaks(org.id),
            generateDailyActions(org.id)
        ]);

        const result = {
            revenueBrain,
            leakDetector,
            actionEngine
        };

        // 4. Set Cache
        await setCached(org.id, cacheKey, {
            agentName: "ExecutiveIntelligence",
            model: "deterministic",
            inputObj: { orgId: org.id },
            outputObj: result
        });

        return NextResponse.json({
            ...result,
            meta: { cached: false, timestamp: new Date().toISOString() }
        });

    } catch (error: any) {
        logger.error("Executive Intelligence API Error", { error: error.message });
        return NextResponse.json({ error: "Consolidated intelligence failed" }, { status: 500 });
    }
}
