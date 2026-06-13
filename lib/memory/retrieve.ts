import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { embedTextBatch } from "./embeddings";

export interface RetrievedChunk {
    chunkId: string;
    documentId: string;
    sourceType: string;
    sourceId: string | null;
    title: string;
    chunkText: string;
    score: number;
}

type ChunkWithDocument = Awaited<ReturnType<typeof prisma.knowledgeChunk.findMany>>[number] & {
    document: {
        title: string;
        sourceType: string;
        sourceId: string | null;
    } | null;
};

function parseEmbedding(raw: string | null): number[] | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed) && parsed.every((value) => typeof value === "number")) {
            return parsed;
        }
    } catch {
        return null;
    }
    return null;
}

function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let index = 0; index < a.length; index += 1) {
        dot += a[index] * b[index];
        normA += a[index] * a[index];
        normB += b[index] * b[index];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dot / denominator;
}

export async function retrieve(
    orgId: string,
    query: string,
    topK = 8,
    sessionId?: string,
): Promise<RetrievedChunk[]> {
    try {
        const [queryVector] = await embedTextBatch([query], orgId);

        const chunks = await prisma.knowledgeChunk.findMany({
            where: {
                organizationId: orgId,
                embedding: { not: null },
            },
            select: {
                id: true,
                chunkText: true,
                embedding: true,
                documentId: true,
                document: {
                    select: {
                        title: true,
                        sourceType: true,
                        sourceId: true,
                    },
                },
            },
            take: 2000,
        }) as ChunkWithDocument[];

        if (!chunks.length) {
            logger.warn(`No indexed chunks found for org: ${orgId}. Run /api/admin/memory/reindex first.`);
            return [];
        }

        const scored = chunks.flatMap((chunk) => {
            const embedding = parseEmbedding(chunk.embedding);
            if (!embedding) return [];

            return [{
                chunkId: chunk.id,
                documentId: chunk.documentId,
                sourceType: chunk.document?.sourceType ?? "unknown",
                sourceId: chunk.document?.sourceId ?? null,
                title: chunk.document?.title ?? "Sem titulo",
                chunkText: chunk.chunkText,
                score: cosineSimilarity(queryVector, embedding),
            }];
        });

        const results = scored
            .sort((left, right) => right.score - left.score)
            .slice(0, topK)
            .filter((item) => item.score > 0.1);

        await prisma.retrievalLog.create({
            data: {
                organizationId: orgId,
                sessionId: sessionId ?? null,
                queryText: query,
                topK,
                resultsJson: JSON.stringify(results.map((item) => ({
                    chunkId: item.chunkId,
                    documentId: item.documentId,
                    score: item.score,
                }))),
            },
        });

        return results;
    } catch (error: unknown) {
        logger.error("Retrieval Engine Error", {
            orgId,
            error: error instanceof Error ? error.message : String(error),
        });
        return [];
    }
}
