/**
 * lib/orchestrator/executors/outbound-executor.ts
 * V21: Executor for action type "outbound_send_next".
 *
 * BrainCycle picks sequences where nextAt <= now + !paused,
 * enqueues outbound_send_next, this executor runs sendNextOutboundStep.
 */

import { sendNextOutboundStep } from "@/lib/outbound/outbound-engine";
import { logger } from "@/lib/logger";

export interface OutboundExecutorContext {
    orgId: string;
    sequenceId: string;
}

export async function executeOutboundSendNext(
    ctx: OutboundExecutorContext,
): Promise<{ success: boolean; sent?: boolean; stage?: string; messageId?: string }> {
    logger.info("[OutboundExecutor] Starting", { ...ctx });

    try {
        const result = await sendNextOutboundStep(ctx.orgId, ctx.sequenceId);

        // Audit
        const { prisma } = await import("@/lib/prisma");

        // Find assessmentId for audit (best-effort)
        const seq = await (prisma as any).outboundSequence.findUnique({
            where: { id: ctx.sequenceId },
            select: { prospect: { select: { orgId: true } } },
        }).catch(() => null);

        if (result.sent) {
            await (prisma as any).auditEvent.create({
                data: {
                    assessmentId: "outbound",  // placeholder for non-assessment scope
                    organizationId: ctx.orgId,
                    action: "outboundStepSent",
                    details: JSON.stringify({
                        sequenceId: ctx.sequenceId,
                        stage: result.stage,
                        messageId: result.messageId,
                    }),
                },
            }).catch(() => null);
        }

        logger.info("[OutboundExecutor] Done", { ...ctx, ...result });
        return { success: true, ...result };

    } catch (err: any) {
        logger.error("[OutboundExecutor] Failed", { ...ctx, error: err?.message });
        return { success: false };
    }
}
