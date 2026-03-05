/**
 * lib/orchestrator/executors/proof-executor.ts
 * V21: Executor for action type "generate_proof_pack".
 *
 * Triggered when ClientWorkspace status changes to "completed" (go-live).
 * approvalRequired = true (ProofAssets enter draft, await human review).
 */

import { generateProofPack, recalcProofStats } from "@/lib/authority/proof-engine";
import { logger } from "@/lib/logger";

export interface ProofExecutorContext {
    orgId: string;
    workspaceId: string;
    anonLevel?: "full" | "sector_only" | "size_only" | "none";
}

export async function executeGenerateProofPack(
    ctx: ProofExecutorContext,
): Promise<{ success: boolean; assetIds?: string[]; stub?: boolean }> {
    logger.info("[ProofExecutor] Starting", { orgId: ctx.orgId, workspaceId: ctx.workspaceId });

    try {
        const { assetIds, stub } = await generateProofPack(
            ctx.orgId,
            ctx.workspaceId,
            ctx.anonLevel ?? "full",
        );

        // Recalc stats after new proof pack
        await recalcProofStats(ctx.orgId);

        logger.info("[ProofExecutor] Done", { ...ctx, assetIds, stub });
        return { success: true, assetIds, stub };

    } catch (err: any) {
        logger.error("[ProofExecutor] Failed", { ...ctx, error: err?.message });
        return { success: false };
    }
}
