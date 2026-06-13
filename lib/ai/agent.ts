/**
 * lib/ai/agent.ts  (replaces lib/ai-agent.ts)
 *
 * Hardened AI agent for generating pre-sales artifacts.
 * Features:
 *   - Zod-validated structured output via generateObject
 *   - Retry once on invalid schema
 *   - Rate limit: max 5 generations per Assessment + 30s cooldown
 *   - AIInvocation logging (tokens, cost, latency, status)
 */

import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { failedDependencyError } from "@/lib/http/route-errors";

// ─── Output Schema (Zod) ────────────────────────────────────────────────────

export const PreSalesSchema = z.object({
    executiveSummary: z.string().min(100, "Resumo executivo muito curto"),
    diagnosticQuestions: z
        .array(z.string().min(10))
        .min(5)
        .max(10),
    architectureProposal: z.object({
        modules: z.array(
            z.object({
                title: z.string(),
                description: z.string(),
            })
        ).min(2),
        integrations: z.array(z.string()).min(1),
        roadmap: z.array(
            z.object({
                week: z.string(),
                action: z.string(),
            })
        ).min(2),
    }),
});

export type PreSalesResult = z.infer<typeof PreSalesSchema>;

// ─── Rate Limit Config ───────────────────────────────────────────────────────

const MAX_GENERATIONS = 5;         // per assessment lifetime
const COOLDOWN_SECONDS = 30;       // between generations

function buildStubPreSalesResult(context: AssessmentContext): PreSalesResult {
    return {
        executiveSummary: [
            `${context.company} (${context.segment}) apresenta potencial claro de ganho operacional imediato.`,
            `Sem OPENAI_API_KEY configurada, o sistema operou em modo degradado e gerou este rascunho seguro para continuidade comercial.`,
            `Priorize validação de dores críticas (${context.pains.slice(0, 3).join(", ") || "operações e vendas"}),`,
            `confirmação de baseline de volume (${context.volumeDay}) e definição de metas para os próximos 30 dias.`,
        ].join(" "),
        diagnosticQuestions: [
            "Qual gargalo operacional hoje mais impacta receita e tempo da equipe?",
            "Quais canais concentram o maior volume e a maior taxa de perda de oportunidades?",
            "Quais integrações atuais são obrigatórias para ativar o plano sem retrabalho?",
            "Qual KPI executivo será usado para medir sucesso nas primeiras 4 semanas?",
            "Qual janela de implantação e quais responsáveis internos estão alocados?",
        ],
        architectureProposal: {
            modules: [
                {
                    title: "Sales Command Layer",
                    description: "Camada para priorizar oportunidades, risco de perda e próximos passos comerciais.",
                },
                {
                    title: "Operational Automation Layer",
                    description: "Orquestração de tarefas repetitivas e execução de playbooks em canais ativos.",
                },
            ],
            integrations: context.stack.length > 0 ? context.stack.slice(0, 4) : ["CRM", "WhatsApp Business API"],
            roadmap: [
                { week: "Semana 1", action: "Baseline de métricas, mapeamento de gargalos e plano de ativação." },
                { week: "Semana 2", action: "Integrações críticas e validação de dados operacionais." },
                { week: "Semana 3", action: "Ativação de automações prioritárias e ajustes de funil." },
                { week: "Semana 4", action: "Revisão executiva de impacto e plano de escala." },
            ],
        },
    };
}

// ─── Cost Estimation (gpt-4o-mini pricing, per 1M tokens) ───────────────────
// Input: $0.15/1M | Output: $0.60/1M
function estimateCost(inputTokens: number, outputTokens: number): number {
    return (inputTokens / 1_000_000) * 0.15 + (outputTokens / 1_000_000) * 0.60;
}

// ─── Main Function ───────────────────────────────────────────────────────────

export interface AssessmentContext {
    name: string;
    company: string;
    role: string;
    segment: string;
    teamSize: string;
    volumeDay: string;
    channels: string[];
    stack: string[];
    pains: string[];
    urgency: string;
    goal: string;
    scoreTotal: number;
    classification: string;
    recommendedMissions: string[];
}

export async function generatePreSalesArtifacts(
    assessmentId: string,
    context: AssessmentContext
): Promise<PreSalesResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        logger.warn("OPENAI_API_KEY not configured for pre-sales generation", {
            assessmentId,
            mode: "failed_dependency",
        });
        throw failedDependencyError();
    }

    // ─── Rate Limit Check ─────────────────────────────────────────────────

    const allInvocations = await (prisma as any).aIInvocation.findMany({
        where: { assessmentId, status: "success" },
        orderBy: { createdAt: "desc" },
    });

    if (allInvocations.length >= MAX_GENERATIONS) {
        logger.warn("Rate limit: max generations reached", { assessmentId, count: allInvocations.length });
        throw new Error(
            `Limite de ${MAX_GENERATIONS} gerações por lead atingido. Contate o suporte para aumentar o limite.`
        );
    }

    if (allInvocations.length > 0) {
        const lastMs = new Date(allInvocations[0].createdAt).getTime();
        const elapsedSec = (Date.now() - lastMs) / 1000;
        if (elapsedSec < COOLDOWN_SECONDS) {
            const remaining = Math.ceil(COOLDOWN_SECONDS - elapsedSec);
            throw new Error(`Aguarde ${remaining}s antes de gerar novamente (cooldown de ${COOLDOWN_SECONDS}s).`);
        }
    }

    // ─── AI Invocation ─────────────────────────────────────────────────────

    const openai = createOpenAI({ apiKey });
    const model = "gpt-4o-mini";
    const startMs = Date.now();
    let status: string = "success";
    let errorMessage: string | undefined;
    let inputTokens = 0;
    let outputTokens = 0;
    let result: PreSalesResult | null = null;

    const prompt = buildPrompt(context);

    // Attempt 1 (+ 1 retry on invalid output)
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const response = await generateObject({
                model: openai(model),
                schema: PreSalesSchema,
                prompt,
                temperature: 0.7,
            });

            inputTokens = response.usage?.inputTokens ?? 0;
            outputTokens = response.usage?.outputTokens ?? 0;
            result = response.object;
            status = "success";
            break;
        } catch (err: any) {
            logger.warn(`AI generation attempt ${attempt} failed`, { assessmentId, error: err?.message });
            if (attempt === 2) {
                status = "invalid_output";
                errorMessage = err?.message ?? "Unknown error";
            }
        }
    }

    const latencyMs = Date.now() - startMs;

    // ─── Log Invocation ───────────────────────────────────────────────────

    await (prisma as any).aIInvocation.create({
        data: {
            assessmentId,
            model,
            promptTokens: inputTokens,
            completionTokens: outputTokens,
            estimatedCostUsd: estimateCost(inputTokens, outputTokens),
            latencyMs,
            status,
            errorMessage: errorMessage ?? null,
        },
    });

    if (!result) {
        throw new Error(`Falha ao gerar artefatos estruturados após 2 tentativas: ${errorMessage}`);
    }

    logger.info("Pre-sales artifacts generated", {
        assessmentId,
        tokens: inputTokens + outputTokens,
        latencyMs,
        cost: estimateCost(inputTokens, outputTokens),
    });

    return result;
}

// ─── Prompt Builder ──────────────────────────────────────────────────────────

function buildPrompt(ctx: AssessmentContext): string {
    return `Você é um Arquiteto de IA B2B sênior da InovaCortex, especializado em vendas consultivas. 
Baseado nos dados do lead abaixo, gere 3 artefatos de pré-venda detalhados e personalizados.

# Dados do Lead
- Empresa: ${ctx.company} | Cargo: ${ctx.role} | Segmento: ${ctx.segment}
- Equipe: ${ctx.teamSize} | Volume/dia: ${ctx.volumeDay}
- Canais: ${ctx.channels.join(", ")}
- Stack atual: ${ctx.stack.join(", ")}
- Principais dores: ${ctx.pains.join(", ")}
- Urgência: ${ctx.urgency} | Objetivo: ${ctx.goal}
- Score InovaCortex: ${ctx.scoreTotal}/100 (${ctx.classification})
- Missões recomendadas: ${ctx.recommendedMissions.join(", ")}

# Regras de saída
- executiveSummary: texto consultivo profissional de 150-400 palavras
- diagnosticQuestions: 5-7 perguntas objetivas para call de descoberta
- architectureProposal.modules: 3-5 módulos/agentes de IA específicos para este lead
- architectureProposal.integrations: sistemas concretos a integrar (ex: HubSpot, WhatsApp Business API)
- architectureProposal.roadmap: 4-6 sprints semanais com ações claras`;
}
