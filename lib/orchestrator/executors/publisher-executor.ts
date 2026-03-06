/**
 * lib/orchestrator/executors/publisher-executor.ts
 * V20.1: Executor for action type "publish_marketing_plan".
 *
 * Handles a single ActionQueueItem for publishing one MarketingPlan entry.
 * Called by the orchestrator run-due loop.
 */

import { publishOne } from "@/lib/agents/publisher-agent";
import { logger } from "@/lib/logger";

export interface PublisherExecutorContext {
    orgId: string;
    marketingPlanId: string;
}

export async function executePublishMarketingPlan(
    ctx: PublisherExecutorContext,
): Promise<{ success: boolean; status: string; stub?: boolean }> {
    logger.info("[PublisherExecutor] Starting", { ...ctx });

    try {
        const result = await publishOne(ctx.marketingPlanId);

        logger.info("[PublisherExecutor] Done", {
            orgId: ctx.orgId,
            marketingPlanId: ctx.marketingPlanId,
            status: result.status,
            stub: result.stub,
        });

        return { success: true, status: result.status, stub: result.stub };

    } catch (err: any) {
        logger.error("[PublisherExecutor] Failed", {
            orgId: ctx.orgId,
            marketingPlanId: ctx.marketingPlanId,
            error: err?.message,
        });
        return { success: false, status: "failed" };
    }
}
