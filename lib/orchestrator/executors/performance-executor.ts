
import { AgentImplementation, OrchestratorContext } from "../types";
import { upsertPerformanceSnapshot, WindowKey } from "@/lib/performance/stats-engine";
import { detectUnderperformance, detectSLABreaches, detectOwnerLeaks, detectStaleDeals } from "@/lib/performance/alert-engine";
import { logger } from "@/lib/logger";

/**
 * PerformanceAgent (V39)
 * Handles background KPI recalculation and proactive alert monitoring.
 */
export const PerformanceAgent: AgentImplementation = {
    name: "PerformanceAgent",

    async run(payload: any, ctx: OrchestratorContext): Promise<{ success: boolean; data?: any; error?: string }> {
        const { orgId } = ctx;
        const window = (payload.window as WindowKey) || "30d";

        logger.info(`PerformanceAgent starting for Org: ${orgId} (Window: ${window})`);

        try {
            // 1. Recalculate and Save Snapshots
            await upsertPerformanceSnapshot(orgId, window);

            // 2. Run Alert Sweep
            await Promise.all([
                detectUnderperformance(orgId, window),
                detectSLABreaches(orgId),
                detectOwnerLeaks(orgId),
                detectStaleDeals(orgId)
            ]);

            return {
                success: true,
                data: {
                    orgId,
                    window,
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error: any) {
            logger.error(`PerformanceAgent failed for Org: ${orgId}`, { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }
};
