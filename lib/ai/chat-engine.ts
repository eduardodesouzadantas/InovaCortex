import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { getCached, setCached, makeCacheKey } from "@/lib/agentops/cache";
import { assertBudget, trackUsage } from "@/lib/agentops/budget";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { assertAIEngineAvailable, isAIUnavailableError, toAIUnavailableError } from "@/lib/http/route-errors";

type ChatHistoryEntry = {
    role: string;
    content: string;
};

type ChatAnswerData = Record<string, unknown>;

type CachedChatAnswer = {
    resumo: string;
    dados: ChatAnswerData;
    acoes: string[];
    atalhos: string[];
    meta: {
        tokensUsed: number;
        costUsd: number;
        cachedHit: boolean;
        model: string;
    };
};

type ChatContext = {
    orgName: string;
    industry: string;
    roleContext: string;
    history: ChatHistoryEntry[];
    insights: string[];
    leaks: string[];
    recentEvents: string[];
    proposals: string[];
    benchmarks: unknown;
    ragContext: string;
    ragEvidence: string[];
    ragChunks: number;
};

export interface ChatAnswer {
    resumo: string;
    dados: ChatAnswerData;
    acoes: string[];
    atalhos: string[];
    meta: {
        tokensUsed: number;
        costUsd: number;
        cachedHit: boolean;
        model: string;
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function parseJsonRecord(raw: string | null | undefined): ChatAnswerData {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw) as unknown;
        return isRecord(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function isChatAnswer(value: unknown): value is CachedChatAnswer {
    return isRecord(value)
        && typeof value.resumo === "string"
        && Array.isArray(value.acoes)
        && Array.isArray(value.atalhos)
        && isRecord(value.meta)
        && typeof value.meta.model === "string";
}

function normalizeStructuredResponse(raw: unknown): Pick<ChatAnswer, "resumo" | "dados" | "acoes" | "atalhos"> {
    if (!isRecord(raw)) {
        return {
            resumo: String(raw ?? ""),
            dados: {},
            acoes: ["Verificar logs de sistema"],
            atalhos: ["/help"],
        };
    }

    return {
        resumo: typeof raw.resumo === "string" ? raw.resumo : "",
        dados: isRecord(raw.dados) ? raw.dados : {},
        acoes: Array.isArray(raw.acoes) ? raw.acoes.filter((item): item is string => typeof item === "string") : [],
        atalhos: Array.isArray(raw.atalhos) ? raw.atalhos.filter((item): item is string => typeof item === "string") : [],
    };
}

export const ChatEngine = {
    async buildContext(orgId: string, sessionId: string, role: "admin" | "ceo", currentMessage?: string): Promise<ChatContext> {
        const { buildRagContext } = await import("@/lib/memory/rag-context");

        const [
            messages,
            insights,
            leaks,
            events,
            proposals,
            org,
            ragContext,
        ] = await Promise.all([
            prisma.aIChatMessage.findMany({
                where: { sessionId, organizationId: orgId },
                orderBy: { createdAt: "desc" },
                take: 20,
                select: { role: true, content: true },
            }),
            prisma.strategicInsight.findMany({
                where: { organizationId: orgId, status: "active" },
                orderBy: { impactScore: "desc" },
                take: 10,
                select: { category: true, title: true, description: true },
            }),
            prisma.profitLeak.findMany({
                where: { orgId, status: "open" },
                orderBy: { estimatedLossCents: "desc" },
                take: 5,
                select: { title: true, estimatedLossCents: true },
            }),
            prisma.systemEvent.findMany({
                where: { organizationId: orgId },
                orderBy: { createdAt: "desc" },
                take: 10,
                select: { createdAt: true, type: true },
            }),
            prisma.proposal.findMany({
                where: { assessment: { organizationId: orgId } },
                orderBy: { createdAt: "desc" },
                take: 5,
                select: { id: true, status: true, customNotes: true, createdAt: true },
            }),
            prisma.organization.findUnique({
                where: { id: orgId },
                select: { name: true, plan: true, industry: true },
            }),
            buildRagContext(orgId, currentMessage ?? "", sessionId),
        ]);

        const benchmarks = org?.industry
            ? await prisma.benchmarkSnapshot.findFirst({
                where: { segment: { industry: org.industry } },
                orderBy: { createdAt: "desc" },
                select: { metrics: true },
            })
            : null;

        return {
            orgName: org?.name ?? "Empresa",
            industry: org?.industry ?? "Servicos",
            roleContext: role === "ceo" ? "Strategic Dashboard (High Level)" : "Admin Control (Operational)",
            history: [...messages].reverse(),
            insights: insights.map((item) => `${item.category}: ${item.title} (${item.description})`),
            leaks: leaks.map((item) => `${item.title} - Est. Loss: R$ ${item.estimatedLossCents / 100}`),
            recentEvents: events.map((item) => `${item.createdAt.toISOString()}: ${item.type}`),
            proposals: proposals.map((item) => `Proposal ${item.id.slice(0, 8)}: ${item.status}`),
            benchmarks: parseJsonRecord(benchmarks?.metrics),
            ragContext: ragContext.contextBlock,
            ragEvidence: ragContext.evidenceIds,
            ragChunks: ragContext.chunkCount,
        };
    },

    async answerChat(
        orgId: string,
        sessionId: string,
        userId: string,
        role: "admin" | "ceo",
        message: string,
    ): Promise<ChatAnswer> {
        assertAIEngineAvailable();
        await assertBudget(orgId, 1200);

        const context = await this.buildContext(orgId, sessionId, role, message);
        const historyHash = context.history.map((item) => item.content).join("|");
        const snapshotHashes = `${context.insights.length}-${context.leaks.length}-${context.recentEvents.length}`;
        const cacheKeySource = { historyHash, snapshotHashes, message, role };
        const cacheKey = makeCacheKey("ChatEngine", "gpt-4o-mini", cacheKeySource).keyHash;

        const hit = await getCached(orgId, cacheKey, 2 * 60 * 60 * 1000);
        if (isChatAnswer(hit?.output)) {
            return {
                ...hit.output,
                meta: {
                    ...hit.output.meta,
                    cachedHit: true,
                },
            };
        }

        const systemPrompt = `Voce e o InovaCortex AI Control Room da empresa ${context.orgName}, o "Cerebro do CEO".
Seu objetivo e ser uma arma estrategica focada em 3 pilares criticos:
1. Revenue Brain: Como aumentar a receita agora?
2. Leak Detector: Onde estamos perdendo dinheiro?
3. Action Engine: O que fazer hoje?

Escopo: ${context.roleContext}.
Instrucoes:
- Responda sempre em JSON estruturado.
- Nao invente dados. Use o contexto fornecido abaixo.
- Seja incisivo, executivo e focado em lucro e velocidade.
- Se os dados forem insuficientes, responda: "dados insuficientes - sugiro executar /pipeline ou /revenue".
- Formato do JSON: { "resumo": "...", "dados": {...}, "acoes": [...], "atalhos": [...] }.

CONTEXTO ATUAL DA EMPRESA:
- Industria: ${context.industry}
- Insights Estrategicos Ativos: ${JSON.stringify(context.insights)}
- Vazamentos de Lucro: ${JSON.stringify(context.leaks)}
- Eventos Recentes: ${JSON.stringify(context.recentEvents)}
- Propostas Recentes: ${JSON.stringify(context.proposals)}
- Benchmarks de Mercado: ${JSON.stringify(context.benchmarks)}

${context.ragContext ? `EVIDENCE (internal - ${context.ragChunks} fontes):\n${context.ragContext}` : ""}

Quando usar evidencias internas, cite a fonte no campo "dados" como: { "fonte": "[E1]", ... }`;

        const formattedHistory = context.history.map((item) => ({
            role: item.role.toLowerCase() as "user" | "assistant" | "system",
            content: item.content,
        }));

        try {
            const { text, usage } = await generateText({
                model: openai("gpt-4o-mini"),
                system: systemPrompt,
                messages: [...formattedHistory, { role: "user", content: message }],
            });

            let structured: Pick<ChatAnswer, "resumo" | "dados" | "acoes" | "atalhos">;
            try {
                structured = normalizeStructuredResponse(JSON.parse(text) as unknown);
            } catch {
                structured = normalizeStructuredResponse(text);
            }

            const totalTokensUsed = usage.totalTokens ?? 0;
            const costUsd = totalTokensUsed * 0.00000015;
            const result: ChatAnswer = {
                ...structured,
                meta: {
                    tokensUsed: totalTokensUsed,
                    costUsd,
                    cachedHit: false,
                    model: "gpt-4o-mini",
                },
            };

            await prisma.aIChatMessage.createMany({
                data: [
                    {
                        sessionId,
                        organizationId: orgId,
                        role: "user",
                        content: message,
                    },
                    {
                        sessionId,
                        organizationId: orgId,
                        role: "assistant",
                        content: JSON.stringify(result),
                        meta: JSON.stringify(result.meta),
                    },
                ],
            });

            await trackUsage(orgId, totalTokensUsed, costUsd);
            await setCached(orgId, cacheKey, {
                agentName: "ChatEngine",
                model: "gpt-4o-mini",
                inputObj: cacheKeySource,
                outputObj: result,
                tokensUsed: totalTokensUsed,
                costUsd,
            });

            return result;
        } catch (error: unknown) {
            logger.error("ChatEngine Completion Error", {
                error: error instanceof Error ? error.message : String(error),
            });
            if (isAIUnavailableError(error)) {
                throw toAIUnavailableError(error);
            }
            throw new Error("Chat core failure");
        }
    },
};
