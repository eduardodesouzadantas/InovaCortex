import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export type MemoryType = "deal" | "objection" | "win_reason" | "loss_reason" | "client_note" | "playbook";

export interface MemoryInput {
    orgId: string;
    type: MemoryType;
    text: string;
    sourceRef?: string;
    confidence?: number;
}

/**
 * Memory Engine (V33)
 * Persists and retrieves strategic memories for RAG-like context.
 */
export const MemoryEngine = {
    /**
     * Save a new memory fragment.
     */
    async saveMemory(input: MemoryInput) {
        try {
            const memory = await (prisma as any).aIChatMemoryItem.create({
                data: {
                    organizationId: input.orgId,
                    type: input.type,
                    text: input.text,
                    sourceRef: input.sourceRef,
                    confidence: input.confidence ?? 5
                }
            });
            logger.info("Memory saved", { id: memory.id, type: input.type });
            return memory;
        } catch (error: any) {
            logger.error("Failed to save memory", { error: error.message });
            throw error;
        }
    },

    /**
     * Search relevant memories (Semantic Lite).
     */
    async searchMemories(orgId: string, query?: string, types?: MemoryType[], limit = 5) {
        try {
            const memories = await (prisma as any).aIChatMemoryItem.findMany({
                where: {
                    organizationId: orgId,
                    ...(types && types.length > 0 ? { type: { in: types } } : {}),
                    ...(query ? { text: { contains: query, mode: 'insensitive' } } : {})
                },
                orderBy: { createdAt: "desc" },
                take: limit
            });
            return memories;
        } catch (error: any) {
            logger.error("Failed to search memories", { error: error.message });
            return [];
        }
    },

    /**
     * Build an injectable context string from memories.
     */
    async buildMemoryContext(orgId: string, query?: string) {
        // We fetch top 3 client notes, top 3 objections, top 3 playbooks
        const [notes, objections, playbooks] = await Promise.all([
            this.searchMemories(orgId, query, ["client_note"], 3),
            this.searchMemories(orgId, query, ["objection"], 3),
            this.searchMemories(orgId, query, ["playbook"], 2)
        ]);

        let context = "\n### MEMÓRIA ESTRATÉGICA (Contexto Histórico):\n";

        if (notes.length > 0) {
            context += "- NOTAS DE CLIENTES:\n" + notes.map((m: any) => `  * ${m.text}`).join("\n") + "\n";
        }
        if (objections.length > 0) {
            context += "- OBJEÇÕES COMUNS:\n" + objections.map((m: any) => `  * ${m.text}`).join("\n") + "\n";
        }
        if (playbooks.length > 0) {
            context += "- PLAYBOOKS VIGENTES:\n" + playbooks.map((m: any) => `  * ${m.text}`).join("\n") + "\n";
        }

        if (notes.length === 0 && objections.length === 0 && playbooks.length === 0) {
            return ""; // No relevant memory found
        }

        return context;
    }
};
