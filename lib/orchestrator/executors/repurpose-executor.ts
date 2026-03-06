/**
 * lib/orchestrator/executors/repurpose-executor.ts
 * V21: Executor for action type "repurpose_marketing_plan".
 *
 * Triggered when MarketingPlan.status changes to "posted".
 * approvalRequired = true (artifact enters draft, awaits human review).
 */

import { repurposeFromPlan } from "@/lib/repurpose/repurpose-engine";
import { logger } from "@/lib/logger";

export interface RepurposeExecutorContext {
    orgId: string;
    marketingPlanId: string;
}

export async function executeRepurposeMarketingPlan(
    ctx: RepurposeExecutorContext,
): Promise<{ success: boolean; artifactId?: string; stub?: boolean }> {
    logger.info("[RepurposeExecutor] Starting", { ...ctx });

    try {
        const result = await repurposeFromPlan(ctx.orgId, ctx.marketingPlanId);
        logger.info("[RepurposeExecutor] Done", {
            ...ctx,
            artifactId: result.artifactId,
            stub: result.stub,
            tokensUsed: result.tokensUsed,
        });
        return { success: true, artifactId: result.artifactId, stub: result.stub };
    } catch (err: any) {
        logger.error("[RepurposeExecutor] Failed", { ...ctx, error: err?.message });
        return { success: false };
    }
}
