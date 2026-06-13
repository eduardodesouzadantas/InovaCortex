import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { embedTextBatch, getChunkHash } from "./embeddings";

export async function reindexOrgKnowledge(orgId: string) {
    logger.info(`Starting Semantic Reindexing for Org: ${orgId}`);

    try {
        const chunks = await prisma.knowledgeChunk.findMany({
            where: {
                organizationId: orgId,
                embedding: null,
            },
            select: {
                id: true,
                chunkText: true,
            },
            take: 100,
        });

        if (!chunks.length) {
            logger.info("No chunks to reindex.");
            return { processed: 0 };
        }

        const embeddings = await embedTextBatch(chunks.map((chunk) => chunk.chunkText), orgId);

        for (let index = 0; index < chunks.length; index += 1) {
            await prisma.knowledgeChunk.update({
                where: { id: chunks[index].id },
                data: {
                    embedding: JSON.stringify(embeddings[index]),
                    chunkHash: getChunkHash(chunks[index].chunkText),
                },
            });
        }

        logger.info(`Reindexed ${chunks.length} chunks for org: ${orgId}`);
        return { processed: chunks.length };
    } catch (error: unknown) {
        logger.error("Reindexing Error", {
            orgId,
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}

type ReindexTaskPayload = {
    orgId?: string;
};

function parseReindexTaskPayload(payloadJson: string): ReindexTaskPayload {
    try {
        const parsed = JSON.parse(payloadJson) as unknown;
        return typeof parsed === "object" && parsed !== null ? parsed as ReindexTaskPayload : {};
    } catch {
        return {};
    }
}

export async function processReindexQueue() {
    const tasks = await prisma.actionQueue.findMany({
        where: {
            type: "memory_reindex_org",
            status: "pending",
        },
        select: {
            id: true,
            payloadJson: true,
        },
        take: 5,
    });

    for (const task of tasks) {
        try {
            const payload = parseReindexTaskPayload(task.payloadJson);
            if (!payload.orgId) {
                throw new Error("Missing orgId in memory_reindex_org payload");
            }

            await prisma.actionQueue.update({
                where: { id: task.id },
                data: { status: "executed", executedAt: new Date() },
            });

            await reindexOrgKnowledge(payload.orgId);
        } catch (error: unknown) {
            const reason = error instanceof Error ? error.message : String(error);
            logger.error("ActionQueue Process Error (reindex)", {
                taskId: task.id,
                reason,
            });
            await prisma.actionQueue.update({
                where: { id: task.id },
                data: { status: "rejected", reason },
            });
        }
    }
}
