import type { AIChatMemoryItem } from "@prisma/client";
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

export const MemoryEngine = {
    async saveMemory(input: MemoryInput) {
        try {
            const memory = await prisma.aIChatMemoryItem.create({
                data: {
                    organizationId: input.orgId,
                    type: input.type,
                    text: input.text,
                    sourceRef: input.sourceRef,
                    confidence: input.confidence ?? 5,
                },
            });

            logger.info("Memory saved", { id: memory.id, type: input.type });
            return memory;
        } catch (error: unknown) {
            logger.error("Failed to save memory", {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    },

    async searchMemories(
        orgId: string,
        query?: string,
        types?: MemoryType[],
        limit = 5,
    ): Promise<AIChatMemoryItem[]> {
        try {
            return await prisma.aIChatMemoryItem.findMany({
                where: {
                    organizationId: orgId,
                    ...(types && types.length > 0 ? { type: { in: types } } : {}),
                    ...(query ? { text: { contains: query, mode: "insensitive" } } : {}),
                },
                orderBy: { createdAt: "desc" },
                take: limit,
            });
        } catch (error: unknown) {
            logger.error("Failed to search memories", {
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    },

    async buildMemoryContext(orgId: string, query?: string) {
        const [notes, objections, playbooks] = await Promise.all([
            this.searchMemories(orgId, query, ["client_note"], 3),
            this.searchMemories(orgId, query, ["objection"], 3),
            this.searchMemories(orgId, query, ["playbook"], 2),
        ]);

        let context = "\n### MEMORIA ESTRATEGICA (Contexto Historico):\n";

        if (notes.length > 0) {
            context += `- NOTAS DE CLIENTES:\n${notes.map((memory) => `  * ${memory.text}`).join("\n")}\n`;
        }
        if (objections.length > 0) {
            context += `- OBJECOES COMUNS:\n${objections.map((memory) => `  * ${memory.text}`).join("\n")}\n`;
        }
        if (playbooks.length > 0) {
            context += `- PLAYBOOKS VIGENTES:\n${playbooks.map((memory) => `  * ${memory.text}`).join("\n")}\n`;
        }

        if (!notes.length && !objections.length && !playbooks.length) {
            return "";
        }

        return context;
    },
};
