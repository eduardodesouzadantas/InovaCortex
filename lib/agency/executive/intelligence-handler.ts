import { getCached, makeCacheKey, setCached } from "@/lib/agentops/cache";

export async function buildExecutiveIntelligence(orgId: string): Promise<Record<string, unknown>> {
    const cacheKey = makeCacheKey("ExecutiveIntelligence", "all", { orgId }).keyHash;
    const hit = await getCached(orgId, cacheKey, 60 * 1000);
    if (hit) {
        return {
            ...(hit.output as Record<string, unknown>),
            meta: { cached: true, timestamp: hit.createdAt },
        };
    }

    const [{ computeRevenueOpportunities }, { scanRevenueLeaks }, { generateDailyActions }] = await Promise.all([
        import("@/lib/analytics/revenue-brain"),
        import("@/lib/analytics/leak-detector"),
        import("@/lib/analytics/action-engine"),
    ]);

    const [revenueBrain, leakDetector, actionEngine] = await Promise.all([
        computeRevenueOpportunities(orgId),
        scanRevenueLeaks(orgId),
        generateDailyActions(orgId),
    ]);

    const result = { revenueBrain, leakDetector, actionEngine };

    await setCached(orgId, cacheKey, {
        agentName: "ExecutiveIntelligence",
        model: "deterministic",
        inputObj: { orgId },
        outputObj: result,
    });

    return {
        ...result,
        meta: { cached: false, timestamp: new Date().toISOString() },
    };
}
