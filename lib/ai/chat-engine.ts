import { prisma } from "@/lib/prisma";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { getCached, setCached, makeCacheKey } from "@/lib/agentops/cache";
import { assertBudget, trackUsage } from "@/lib/agentops/budget";
import { logger } from "@/lib/logger";

export interface ChatAnswer {
    resumo: string;
    dados: Record<string, any>;
    acoes: string[];
    atalhos: string[];
    meta: {
        tokensUsed: number;
        costUsd: number;
        cachedHit: boolean;
        model: string;
    };
}

/**
 * lib/ai/chat-engine.ts
 * Advanced conversational core for AI Control Room.
 */
export const ChatEngine = {
    /**
     * Gathers multi-source context from the database for the LLM.
     */
    async buildContext(orgId: string, sessionId: string, role: "admin" | "ceo", currentMessage?: string) {
        const { buildRagContext } = await import("@/lib/memory/rag-context");

        const [
            messages,
            insights,
            leaks,
            events,
            proposals,
            org,
            ragContext
        ] = await Promise.all([
            (prisma as any).aIChatMessage.findMany({
                where: { sessionId },
                orderBy: { createdAt: "desc" },
                take: 20
            }),
            (prisma as any).strategicInsight.findMany({
                where: { organizationId: orgId, status: "active" },
                orderBy: { impactScore: "desc" },
                take: 10
            }),
            (prisma as any).profitLeak.findMany({
                where: { orgId, status: "open" },
                orderBy: { estimatedLossCents: "desc" },
                take: 5
            }),
            (prisma as any).systemEvent.findMany({
                where: { organizationId: orgId },
                orderBy: { createdAt: "desc" },
                take: 10
            }),
            prisma.proposal.findMany({
                where: { assessment: { organizationId: orgId } },
                orderBy: { createdAt: "desc" },
                take: 5,
                select: { id: true, status: true, customNotes: true, createdAt: true }
            }),
            prisma.organization.findUnique({
                where: { id: orgId },
                select: { name: true, plan: true }
            }) as Promise<any>,
            buildRagContext(orgId, currentMessage || "", sessionId)
        ]);

        // Attempt to fetch relevant benchmarks
        let benchmarks = null;
        if (org?.industry) {
            benchmarks = await (prisma as any).benchmarkSnapshot.findFirst({
                where: { segment: { industry: org.industry } },
                orderBy: { createdAt: "desc" }
            });
        }

        return {
            orgName: org?.name || "Empresa",
            industry: (org as any)?.industry || "Serviços",
            roleContext: role === "ceo" ? "Strategic Dashboard (High Level)" : "Admin Control (Operational)",
            history: messages.reverse(),
            insights: insights.map((i: any) => `${i.category}: ${i.title} (${i.description})`),
            leaks: leaks.map((l: any) => `${l.title} - Est. Loss: R$ ${l.estimatedLossCents / 100}`),
            recentEvents: events.map((e: any) => `${e.createdAt.toISOString()}: ${e.type}`),
            proposals: proposals.map((p: any) => `Proposal ${p.id.slice(0, 8)}: ${p.status}`),
            benchmarks: benchmarks?.metrics ? JSON.parse(benchmarks.metrics) : null,
            ragContext: ragContext.contextBlock,
            ragEvidence: ragContext.evidenceIds,
            ragChunks: ragContext.chunkCount
        };
    },

    /**
     * Orchestrates the chat completion with budget enforcement and caching.
     */
    async answerChat(
        orgId: string,
        sessionId: string,
        userId: string,
        role: "admin" | "ceo",
        message: string
    ): Promise<ChatAnswer> {
        // 1. Budget Hard-Stop
        await assertBudget(orgId, 1200);

        // 2. Context Gathering
        const context = await this.buildContext(orgId, sessionId, role);

        // 3. Advanced Caching (Hash includes message + context snapshots)
        const historyHash = context.history.map((m: any) => m.content).join("|");
        const snapshotHashes = `${context.insights.length}-${context.leaks.length}-${context.recentEvents?.length}`;
        const cacheKeySource = { historyHash, snapshotHashes, message, role };
        const cacheKey = makeCacheKey("ChatEngine", "gpt-4o-mini", cacheKeySource).keyHash;

        const hit = await getCached(orgId, cacheKey, 2 * 60 * 60 * 1000); // 2h TTL
        if (hit) {
            return {
                ...(hit.output as any),
                meta: { ...(hit.output as any).meta, cachedHit: true }
            };
        }

        // 4. LLM Execution
        const systemPrompt = `Você é o InovaCortex AI Control Room da empresa ${context.orgName}, o "Cérebro do CEO".
Seu objetivo é ser uma arma estratégica focada em 3 pilares críticos:
1. **Revenue Brain**: Como aumentar a receita AGORA? (Foco em conversão e upselling).
2. **Leak Detector**: Onde estamos perdendo dinheiro? (Foco em Profit Leaks e ineficiências).
3. **Action Engine**: O que fazer hoje? (Foco em priorização de tarefas e execuções críticas).

Escopo: ${context.roleContext}.
Instruções:
- Responda SEMPRE em JSON estruturado.
- NÃO invente dados. Use o contexto fornecido abaixo.
- Seja incisivo, executivo e focado em lucro e velocidade.
- Se os dados forem insuficientes para responder com precisão, responda: "dados insuficientes — sugiro executar /pipeline ou /revenue".
- Formato do JSON: { "resumo": "...", "dados": {...}, "acoes": [...], "atalhos": [...] }.

CONTEXTO ATUAL DA EMPRESA:
- Indústria: ${context.industry}
- Insights Estratégicos Ativos: ${JSON.stringify(context.insights)}
- Vazamentos de Lucro (Leaks): ${JSON.stringify(context.leaks)}
- Eventos Recentes: ${JSON.stringify(context.recentEvents)}
- Propostas Recentes: ${JSON.stringify(context.proposals)}
- Benchmarks de Mercado: ${JSON.stringify(context.benchmarks)}

${context.ragContext ? `EVIDENCE (internal — ${context.ragChunks} fontes):
${context.ragContext}` : ""}

Responda à solicitação de forma que o CEO possa tomar uma decisão de alto impacto imediatamente.
Quando usar evidências internas, cite a fonte no campo "dados" como: { "fonte": "[E1]", ... }`;

        const formattedHistory = context.history.map((m: any) => ({
            role: m.role.toLowerCase() as "user" | "assistant" | "system",
            content: m.content
        }));

        try {
            const { text, usage } = await generateText({
                model: openai("gpt-4o-mini"),
                system: systemPrompt,
                messages: [...formattedHistory, { role: "user", content: message }],
            });

            let structured;
            try {
                structured = JSON.parse(text);
            } catch (e) {
                // Fallback attempt if LLM didn't return pure JSON
                structured = {
                    resumo: text,
                    dados: {},
                    acoes: ["Verificar logs de sistema"],
                    atalhos: ["/help"]
                };
            }

            const totalTokensUsed = usage.totalTokens ?? 0;
            const costUsd = totalTokensUsed * 0.00000015; // Rough est for mini
            const result: ChatAnswer = {
                ...structured,
                meta: {
                    tokensUsed: totalTokensUsed,
                    costUsd,
                    cachedHit: false,
                    model: "gpt-4o-mini"
                }
            };

            // 5. Persist to DB Session (User & Assistant)
            await (prisma as any).aIChatMessage.createMany({
                data: [
                    {
                        sessionId,
                        organizationId: orgId,
                        role: "user",
                        content: message
                    },
                    {
                        sessionId,
                        organizationId: orgId,
                        role: "assistant",
                        content: JSON.stringify(result),
                        meta: result.meta
                    }
                ]
            });

            // 6. Track Usage in AgentOps
            await trackUsage(orgId, totalTokensUsed, costUsd);

            // 7. Store in Cache
            await setCached(orgId, cacheKey, {
                agentName: "ChatEngine",
                model: "gpt-4o-mini",
                inputObj: cacheKeySource,
                outputObj: result,
                tokensUsed: totalTokensUsed,
                costUsd
            });

            return result;

        } catch (error: any) {
            logger.error("ChatEngine Completion Error", { error: error.message });
            throw new Error("Chat core failure");
        }
    }
};
