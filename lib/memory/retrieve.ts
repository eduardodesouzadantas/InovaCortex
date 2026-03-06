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

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}

/**
 * Retrieval Engine (V33)
 * Steps:
 *   1. Embed the query.
 *   2. Fetch all chunks with embeddings for the org.
 *   3. Rank by cosine similarity.
 *   4. Return top-K chunks with metadata.
 */
export async function retrieve(
    orgId: string,
    query: string,
    topK = 8,
    sessionId?: string
): Promise<RetrievedChunk[]> {
    try {
        // 1. Embed the query
        const [queryVector] = await embedTextBatch([query]);

        // 2. Fetch all chunks with embeddings for this org
        const chunks = await (prisma as any).knowledgeChunk.findMany({
            where: {
                organizationId: orgId,
                embedding: { not: null }
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
                        sourceId: true
                    }
                }
            },
            take: 2000 // Guard: max chunks to rank
        });

        if (chunks.length === 0) {
            logger.warn(`No indexed chunks found for org: ${orgId}. Run /api/admin/memory/reindex first.`);
            return [];
        }

        // 3. Score each chunk by cosine similarity
        const scored = chunks.map((chunk: any) => ({
            chunkId: chunk.id,
            documentId: chunk.documentId,
            sourceType: chunk.document?.sourceType || "unknown",
            sourceId: chunk.document?.sourceId || null,
            title: chunk.document?.title || "Sem título",
            chunkText: chunk.chunkText,
            score: cosineSimilarity(queryVector, chunk.embedding as number[])
        }));

        // 4. Sort by score descending and take topK
        const results = scored
            .sort((a: any, b: any) => b.score - a.score)
            .slice(0, topK)
            .filter((r: any) => r.score > 0.1); // Minimum relevance threshold

        // 5. Log retrieval to RetrievalLog
        await (prisma as any).retrievalLog.create({
            data: {
                organizationId: orgId,
                sessionId: sessionId || null,
                queryText: query,
                topK,
                resultsJson: results.map((r: any) => ({
                    chunkId: r.chunkId,
                    documentId: r.documentId,
                    score: r.score
                }))
            }
        });

        return results;

    } catch (error: any) {
        logger.error(`Retrieval Engine Error: ${error.message}`);
        return [];
    }
}
