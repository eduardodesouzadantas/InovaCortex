import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";
import { createHash } from "crypto";
import { logger } from "@/lib/logger";

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDINGS_MODEL || "text-embedding-3-small";

/**
 * Semantic Embeddings Engine (V33)
 * Handles vector generation with caching and stub fallback.
 */
export async function embedTextBatch(texts: string[], orgId?: string): Promise<number[][]> {
    if (!texts.length) return [];

    const results: number[][] = new Array(texts.length).fill(null);
    const pendingIndices: number[] = [];
    const pendingTexts: string[] = [];

    // 1. Check local DB cache for each text hash
    const { prisma } = await import("@/lib/prisma");

    for (let i = 0; i < texts.length; i++) {
        const hash = getChunkHash(texts[i]);
        const cached = await (prisma as any).knowledgeChunk.findFirst({
            where: {
                chunkHash: hash,
                embedding: { not: null }
            },
            select: { embedding: true }
        });

        if (cached?.embedding) {
            results[i] = cached.embedding as number[];
        } else {
            pendingIndices.push(i);
            pendingTexts.push(texts[i]);
        }
    }

    if (pendingTexts.length === 0) return results;

    // 2. Batch call provider for missing ones
    let newEmbeddings: number[][] = [];
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey || apiKey === "sk-stub") {
        logger.warn("OpenAI API Key missing, using Stub Embeddings (LITE MODE)");
        newEmbeddings = pendingTexts.map(text => generateStubEmbedding(text));
    } else {
        try {
            const { embeddings } = await embedMany({
                model: openai.embedding(EMBEDDING_MODEL),
                values: pendingTexts,
            });
            newEmbeddings = embeddings;
        } catch (error: any) {
            logger.error(`Embedding generation failed: ${error.message}. Falling back to stub.`);
            newEmbeddings = pendingTexts.map(text => generateStubEmbedding(text));
        }
    }

    // 3. Merge results
    for (let i = 0; i < pendingIndices.length; i++) {
        results[pendingIndices[i]] = newEmbeddings[i];
    }

    return results;
}

/**
 * Generates a deterministic "fake" embedding vector based on string hash.
 * Used for local testing or when API keys are missing.
 * Returns a 1536-dimensional vector (standard for OpenAI).
 */
function generateStubEmbedding(text: string): number[] {
    const hash = createHash("sha256").update(text).digest();
    const vector: number[] = new Array(1536).fill(0);

    // Fill vector with deterministic "noise" from hash
    for (let i = 0; i < 1536; i++) {
        const byte = hash[i % hash.length];
        vector[i] = (byte / 255) * 2 - 1; // Normalized between -1 and 1
    }

    return vector;
}

/**
 * Computes a hash for caching purposes.
 */
export function getChunkHash(text: string): string {
    return createHash("sha256").update(text).digest("hex");
}
