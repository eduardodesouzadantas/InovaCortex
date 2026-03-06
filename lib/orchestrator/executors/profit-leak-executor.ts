/**
 * lib/orchestrator/executors/profit-leak-executor.ts
 * V22.1: Executor for action type "profit_leak_scan".
 */

import { runProfitLeakScan } from "@/lib/profit-leak/leak-engine";
import { logger } from "@/lib/logger";

export interface ProfitLeakExecutorContext {
    orgId: string;
}

export async function executeProfitLeakScan(
    ctx: ProfitLeakExecutorContext,
): Promise<{ success: boolean; leaksCreated?: number; leaksUpdated?: number; snapshot?: any }> {
    logger.info("[ProfitLeakExecutor] Starting scan", { orgId: ctx.orgId });

    try {
        const result = await runProfitLeakScan(ctx.orgId);

        // Audit event
        const { prisma } = await import("@/lib/prisma");
        await (prisma as any).auditEvent.create({
            data: {
                assessmentId: "system",
                organizationId: ctx.orgId,
                action: "profitLeakScanCompleted",
                details: JSON.stringify(result),
            },
        }).catch(() => null);

        logger.info("[ProfitLeakExecutor] Done", { orgId: ctx.orgId, ...result });
        return { success: true, ...result };

    } catch (err: any) {
        logger.error("[ProfitLeakExecutor] Failed", { orgId: ctx.orgId, error: err?.message });
        return { success: false };
    }
}
