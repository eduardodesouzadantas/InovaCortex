import { AgentImplementation, OrchestratorContext } from "../types";
import { reindexOrgKnowledge } from "@/lib/memory/reindex";
import { logger } from "@/lib/logger";

/**
 * MemoryAgent (V33)
 * Handles long-running background tasks for the Semantic Layer.
 */
export const MemoryAgent: AgentImplementation = {
    name: "MemoryAgent",

    async run(payload: any, ctx: { orgId: string }): Promise<{ success: boolean; data?: any; error?: string }> {
        const { orgId } = ctx;
        logger.info(`MemoryAgent starting reindex for Org: ${orgId}`);

        try {
            const result = await reindexOrgKnowledge(orgId);

            return {
                success: true,
                data: {
                    processedChunks: result.processed,
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error: any) {
            logger.error(`MemoryAgent failed for Org: ${orgId}`, { error: error.message });
            return {
                success: false,
                error: error.message
            };
        }
    }
};
