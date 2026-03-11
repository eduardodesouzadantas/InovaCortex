import { AgentImplementation, OrchestratorContext } from "../types";
import { generateAndStoreDossierPdf } from "@/lib/pdf/dossier-service";
import { runQueuedCampaignJob } from "@/lib/whatsapp/engines/campaign-engine";
import { logger } from "@/lib/logger";

export const PdfAgent: AgentImplementation = {
    name: "PdfAgent",

    async run(payload: unknown, ctx: OrchestratorContext): Promise<{ success: boolean; data?: unknown; error?: string }> {
        const parsed = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
        const campaignId = typeof parsed.campaignId === "string" ? parsed.campaignId : undefined;
        const reportId = typeof parsed.reportId === "string" ? parsed.reportId : undefined;
        const slug = typeof parsed.slug === "string" ? parsed.slug : undefined;

        if (campaignId) {
            try {
                const result = await runQueuedCampaignJob({
                    campaignId,
                    batchLimit: typeof parsed.batchLimit === "number" ? parsed.batchLimit : undefined,
                    maxBatches: typeof parsed.maxBatches === "number" ? parsed.maxBatches : undefined,
                }, ctx.orgId);
                return { success: true, data: result };
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                logger.error("[PdfAgent] failed to execute campaign queue job", { error: message, campaignId, orgId: ctx.orgId });
                return { success: false, error: message };
            }
        }

        if (!reportId && !slug) {
            return { success: false, error: "Missing reportId or slug for PDF generation." };
        }

        try {
            const result = await generateAndStoreDossierPdf({
                reportId,
                slug,
                orgId: ctx.orgId,
            });

            return { success: true, data: result };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error("[PdfAgent] failed to generate dossier PDF", { error: message, reportId, slug, orgId: ctx.orgId });
            return { success: false, error: message };
        }
    },
};
