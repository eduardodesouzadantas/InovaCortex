import { retrieve, RetrievedChunk } from "./retrieve";
import { logger } from "@/lib/logger";

const MAX_TOKENS = 1500;
const AVG_CHARS_PER_TOKEN = 4;
const MAX_CHARS = MAX_TOKENS * AVG_CHARS_PER_TOKEN; // ~6000 chars

export interface RagContext {
    contextBlock: string;        // Formatted string to inject into prompt
    evidenceIds: string[];       // List of chunkIds used
    chunkCount: number;
    truncated: boolean;
}

/**
 * RAG Context Builder (V33)
 * Retrieves top chunks, compacts them within ~1500 tokens,
 * and returns a structured context block + evidence list.
 */
export async function buildRagContext(
    orgId: string,
    query: string,
    sessionId?: string
): Promise<RagContext> {
    // 1. Retrieve top-K relevant chunks
    const chunks = await retrieve(orgId, query, 8, sessionId);

    if (chunks.length === 0) {
        return {
            contextBlock: "",
            evidenceIds: [],
            chunkCount: 0,
            truncated: false
        };
    }

    // 2. Compact to MAX_TOKENS
    const sections: string[] = [];
    const evidenceIds: string[] = [];
    let totalChars = 0;
    let truncated = false;

    for (const chunk of chunks) {
        const section = formatChunk(chunk);
        if (totalChars + section.length > MAX_CHARS) {
            truncated = true;
            break;
        }
        sections.push(section);
        evidenceIds.push(chunk.chunkId);
        totalChars += section.length;
    }

    // 3. Assemble context block
    const evidenceList = evidenceIds.map((id, i) => `[E${i + 1}] ${id}`).join("\n");

    const contextBlock = `
### BASE DE CONHECIMENTO ESTRATÉGICO (RAG):
${sections.join("\n\n")}

### EVIDÊNCIAS UTILIZADAS:
${evidenceList}
${truncated ? "\n⚠️ Contexto truncado por limite de tokens. Dados mais relevantes foram priorizados." : ""}
`.trim();

    return {
        contextBlock,
        evidenceIds,
        chunkCount: sections.length,
        truncated
    };
}

function formatChunk(chunk: RetrievedChunk): string {
    const relevance = Math.round(chunk.score * 100);
    return [
        `--- [${chunk.sourceType.toUpperCase()} | ${chunk.title} | Relevância: ${relevance}%]`,
        chunk.chunkText.trim()
    ].join("\n");
}
