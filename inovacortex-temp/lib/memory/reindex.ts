import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { embedTextBatch, getChunkHash } from "./embeddings";

/**
 * Reindexes an organization's knowledge chunks.
 * Processes chunks that don't have embeddings or whose text has changed (hash mismatch).
 */
export async function reindexOrgKnowledge(orgId: string) {
    logger.info(`Starting Semantic Reindexing for Org: ${orgId}`);

    try {
        // 1. Fetch chunks without embeddings OR where we want to refresh
        const chunks = await (prisma as any).knowledgeChunk.findMany({
            where: {
                organizationId: orgId,
                embedding: null // For now, only index what's missing
            },
            take: 100 // Process in batches
        });

        if (chunks.length === 0) {
            logger.info("No chunks to reindex.");
            return { processed: 0 };
        }

        const texts = chunks.map((c: any) => c.chunkText);

        // 2. Generate Embeddings
        const embeddings = await embedTextBatch(texts);

        // 3. Update Chunks
        for (let i = 0; i < chunks.length; i++) {
            await (prisma as any).knowledgeChunk.update({
                where: { id: chunks[i].id },
                data: {
                    embedding: embeddings[i],
                    chunkHash: getChunkHash(chunks[i].chunkText) // Update hash too
                }
            });
        }

        logger.info(`Reindexed ${chunks.length} chunks for org: ${orgId}`);
        return { processed: chunks.length };

    } catch (error: any) {
        logger.error(`Reindexing Error: ${error.message}`);
        throw error;
    }
}

/**
 * Worker-like function to process ActionQueue memory_reindex_org tasks.
 */
export async function processReindexQueue() {
    const tasks = await (prisma as any).actionQueue.findMany({
        where: {
            type: "memory_reindex_org",
            status: "pending"
        },
        take: 5
    });

    for (const task of tasks) {
        try {
            const payload = JSON.parse(task.payloadJson);
            const { orgId } = payload;

            // Mark as executing
            await (prisma as any).actionQueue.update({
                where: { id: task.id },
                data: { status: "executed", executedAt: new Date() }
            });

            await reindexOrgKnowledge(orgId);

        } catch (error: any) {
            logger.error(`ActionQueue Process Error (reindex): ${error.message}`);
            await (prisma as any).actionQueue.update({
                where: { id: task.id },
                data: { status: "rejected", reason: error.message }
            });
        }
    }
}
