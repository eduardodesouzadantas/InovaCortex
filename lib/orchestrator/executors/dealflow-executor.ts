/**
 * lib/orchestrator/executors/dealflow-executor.ts
 * V21: Executor for action type "generate_deal_packet".
 *
 * Triggers:
 *  1. Assessment finishes and tier = hot → priority +20, approvalRequired=false
 *  2. Proposal status changes to "sent"  → priority +15
 *
 * Steps:
 *  - createDealPacket(orgId, assessmentId)
 *  - If META token configured: send WhatsApp link to lead
 *  - Record DealSignal whatsapp_sent (or stub)
 */

import { createDealPacket, classifyTier } from "@/lib/dealflow/dealflow-engine";
import { logger } from "@/lib/logger";

export interface DealflowExecutorContext {
    orgId: string;
    assessmentId: string;
    proposalId?: string;
}

export async function executeGenerateDealPacket(
    ctx: DealflowExecutorContext,
): Promise<{ success: boolean; dealPacketId?: string; execSlug?: string; tier?: string; stub?: boolean }> {
    logger.info("[DealflowExecutor] Starting", { ...ctx });

    try {
        const { prisma } = await import("@/lib/prisma");

        // Create the deal packet
        const { dealPacketId, execSlug, tier } = await createDealPacket(
            ctx.orgId, ctx.assessmentId, ctx.proposalId,
        );

        // Mark DealPacket as sent
        await (prisma as any).dealPacket.update({
            where: { id: dealPacketId },
            data: { status: "sent" },
        }).catch(() => null);

        // Determine if we should send WhatsApp
        const metaToken = process.env.META_WHATSAPP_TOKEN;
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://inovacortex.com.br";

        const assessment = await (prisma as any).assessment.findUnique({
            where: { id: ctx.assessmentId },
            select: { phone: true, name: true, company: true, whatsappConsent: true },
        }).catch(() => null);

        let waStub = true;

        if (metaToken && assessment?.phone && assessment?.whatsappConsent) {
            try {
                const message = `Olá, ${assessment.name.split(" ")[0]}! 👋\n\nPreparamos uma análise estratégica exclusiva para ${assessment.company}.\n\nVeja aqui: ${baseUrl}/deal/${execSlug}\n\n_Análise personalizada — válida por 48h._\n\nEquipe InovaCortex`;

                // Meta WhatsApp send (text message)
                const res = await fetch(
                    `https://graph.facebook.com/v18.0/${process.env.META_PHONE_NUMBER_ID}/messages`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${metaToken}`,
                        },
                        body: JSON.stringify({
                            messaging_product: "whatsapp",
                            to: assessment.phone.replace(/\D/g, ""),
                            type: "text",
                            text: { body: message },
                        }),
                    },
                );

                if (res.ok) {
                    waStub = false;
                    logger.info("[DealflowExecutor] WhatsApp sent", { dealPacketId, phone: assessment.phone });
                } else {
                    logger.warn("[DealflowExecutor] WhatsApp send failed", { status: res.status });
                }
            } catch (waErr: any) {
                logger.error("[DealflowExecutor] WhatsApp error", { error: waErr?.message });
            }
        }

        // Record DealSignal
        await (prisma as any).dealSignal.create({
            data: {
                orgId: ctx.orgId,
                assessmentId: ctx.assessmentId,
                dealPacketId,
                type: waStub ? "stub_sent" : "whatsapp_sent",
                metadataJson: JSON.stringify({ execSlug, stub: waStub }),
            },
        }).catch(() => null);

        logger.info("[DealflowExecutor] Done", { dealPacketId, execSlug, tier, waStub });
        return { success: true, dealPacketId, execSlug, tier, stub: waStub };

    } catch (err: any) {
        logger.error("[DealflowExecutor] Failed", { ...ctx, error: err?.message });
        return { success: false };
    }
}
