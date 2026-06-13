/**
 * lib/content-engine.ts
 * R2: Content Engine — AI-powered content generation from real platform data.
 *
 * All content uses real numbers from assessment/ROI/proposal snapshots.
 * Language is consultive, authority-driven, and closes with a CTA for diagnosis.
 *
 * Functions:
 *   generateLinkedInPost()
 *   generateInstagramPost()
 *   generateCaseBreakdown()
 *   generateAuthorityThread()
 *   generateVideoScript()
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { assertAIEngineAvailable, isAIUnavailableError, toAIUnavailableError } from "@/lib/http/route-errors";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContentType =
    | "linkedin"
    | "instagram"
    | "case_breakdown"
    | "authority_thread"
    | "video_script";

export interface ContentInput {
    assessmentId?: string;
    proposalId?: string;
    orgId: string;
    userId?: string;
    overridePrompt?: string; // Optional custom directive
}

export interface GeneratedContent {
    title: string;
    body: string;
    hook?: string;
    cta: string;
    hashtags?: string[];
    metadata: Record<string, unknown>;
    sourceInsight: string;
    roiSnapshot?: Record<string, unknown>;
}

export type ContentEngineErrorCode =
    | "OPENAI_API_KEY_MISSING"
    | "CONTENT_MODEL_GENERATION_FAILED";

export class ContentEngineError extends Error {
    code: ContentEngineErrorCode;

    constructor(code: ContentEngineErrorCode, message: string) {
        super(message);
        this.name = "ContentEngineError";
        this.code = code;
    }
}

// ─── Shared System Prompt ─────────────────────────────────────────────────────

const BRAND_VOICE = `
Você é o ghostwriter da InovaCortex, empresa brasileira de automação e IA para negócios B2B.

REGRAS ABSOLUTAS:
- Nunca use buzzwords vazias: "revolucionário", "inovador", "disruptivo", "transformacional"
- Nunca minta nem exagere. Use apenas dados reais fornecidos
- Linguagem direta, consultiva e de autoridade — como um sócio de consultoria, não um vendedor
- Sempre termine com CTA para "/avaliacao" ou "diagnóstico gratuito"
- Posicionamento high-ticket: o cliente ideal tem entre R$1M-15M de faturamento
- Foco em impacto financeiro mensurável: redução de custo, aumento de receita, velocidade de execução
- Português brasileiro, sem gírias, sem informalidade excessiva
- Máximo de clareza: uma frase = uma ideia
`.trim();

// ─── Data Loader ──────────────────────────────────────────────────────────────

async function loadInsightData(input: ContentInput): Promise<{
    assessment?: any;
    roi?: any;
    proposal?: any;
}> {
    const [assessment, roi, proposal] = await Promise.all([
        input.assessmentId
            ? (prisma as any).assessment.findUnique({ where: { id: input.assessmentId } })
            : Promise.resolve(null),
        input.assessmentId
            ? (prisma as any).roiProjection.findUnique({ where: { assessmentId: input.assessmentId } })
            : Promise.resolve(null),
        input.proposalId
            ? (prisma as any).proposal.findUnique({ where: { id: input.proposalId } })
            : Promise.resolve(null),
    ]);
    return { assessment, roi, proposal };
}

function buildDataContext(data: { assessment?: any; roi?: any; proposal?: any }): string {
    const lines: string[] = [];

    if (data.assessment) {
        const a = data.assessment;
        lines.push(`EMPRESA: ${a.company ?? "empresa do setor"}`);
        lines.push(`SETOR: ${a.sector ?? "não informado"}`);
        lines.push(`PORTE: ${a.teamSize ?? "?"} funcionários, volume ${a.volumeDay ?? "?"} operações/dia`);
        lines.push(`SCORE DE MATURIDADE: ${a.scoreTotal ?? "?"}/100 (${a.classification ?? ""})`);
        if (a.painPoints) lines.push(`PRINCIPAIS DORES: ${a.painPoints}`);
    }

    if (data.roi) {
        const r = data.roi;
        lines.push(`ROI PROJETADO:`);
        lines.push(`  - Economia operacional: R$ ${Math.round(r.operationalSavingsEstimate ?? 0).toLocaleString("pt-BR")}/ano`);
        lines.push(`  - Aumento de receita: R$ ${Math.round(r.revenueIncreaseEstimate ?? 0).toLocaleString("pt-BR")}/ano`);
        lines.push(`  - Horas recuperadas: ${Math.round(r.monthlyHoursRecovered ?? 0)}h/mês`);
        lines.push(`  - Payback estimado: ${r.estimatedPaybackMonths ?? "?"} meses`);
        lines.push(`  - Confiança: ${r.confidenceLevel ?? "Média"}`);
    }

    if (data.proposal) {
        try {
            const modules = JSON.parse(data.proposal.modules);
            lines.push(`MÓDULOS CONTRATADOS: ${Array.isArray(modules) ? modules.map((m: any) => m.name ?? m).join(", ") : "-"}`);
        } catch { /* ignore */ }
    }

    return lines.length > 0
        ? `\n\nDADOS REAIS DO CASO:\n${lines.join("\n")}`
        : "\n\nUSE CENÁRIO REALISTA: empresa de 20-80 funcionários, setor de serviços/saúde/imobiliário, faturamento R$ 3-10M/ano.";
}

// ─── Generator Core ───────────────────────────────────────────────────────────

async function generate(
    type: ContentType,
    prompt: string,
    input: ContentInput,
    data: { assessment?: any; roi?: any; proposal?: any },
): Promise<GeneratedContent & { raw: string }> {
    assertAIEngineAvailable();

    const fullPrompt = `${BRAND_VOICE}\n${buildDataContext(data)}\n\n---\n\n${prompt}`;

    let text = "";
    try {
        const response = await generateText({
            model: openai("gpt-4o-mini"),
            prompt: fullPrompt,
            maxOutputTokens: 1200,
        });
        text = response.text;
    } catch (error) {
        logger.error("Content engine: OpenAI generation failed", {
            type,
            orgId: input.orgId,
            error: error instanceof Error ? error.message : String(error),
        });
        if (isAIUnavailableError(error)) {
            throw toAIUnavailableError(error);
        }
        throw new ContentEngineError(
            "CONTENT_MODEL_GENERATION_FAILED",
            "OpenAI content generation failed.",
        );
    }

    // Parse structured output from the AI
    // AI is instructed to return JSON in each generator function
    try {
        const parsed = JSON.parse(text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
        return { ...parsed, raw: text };
    } catch {
        // Fallback: treat entire response as body
        logger.warn("Content engine: JSON parse failed, using raw text", { type });
        return {
            title: `Conteúdo ${type} - ${new Date().toLocaleDateString("pt-BR")}`,
            body: text,
            hook: undefined,
            cta: "Faça seu diagnóstico em inovacortex.com.br/avaliacao",
            hashtags: [],
            metadata: {},
            sourceInsight: text.slice(0, 150),
            raw: text,
        };
    }
}

// ─── Save to Database ─────────────────────────────────────────────────────────

async function saveContentArtifact(
    type: ContentType,
    content: GeneratedContent,
    input: ContentInput,
    roi?: any,
): Promise<any> {
    return (prisma as any).contentArtifact.create({
        data: {
            organizationId: input.orgId,
            assessmentId: input.assessmentId ?? null,
            proposalId: input.proposalId ?? null,
            type,
            version: 1,
            status: "draft",
            title: content.title,
            body: content.body,
            hook: content.hook ?? null,
            cta: content.cta,
            hashtags: content.hashtags ? JSON.stringify(content.hashtags) : null,
            metadata: JSON.stringify(content.metadata),
            sourceInsight: content.sourceInsight,
            roiSnapshot: roi ? JSON.stringify({
                operationalSavingsEstimate: roi.operationalSavingsEstimate,
                revenueIncreaseEstimate: roi.revenueIncreaseEstimate,
                monthlyHoursRecovered: roi.monthlyHoursRecovered,
                estimatedPaybackMonths: roi.estimatedPaybackMonths,
                confidenceLevel: roi.confidenceLevel,
            }) : null,
        }
    });
}

// ─── Public Generation Functions ─────────────────────────────────────────────

/**
 * Generate a LinkedIn post (800-1200 chars) with hook, data-backed insight, and CTA.
 */
export async function generateLinkedInPost(input: ContentInput): Promise<any> {
    const data = await loadInsightData(input);
    const content = await generate("linkedin", `
Gere um post para LinkedIn.

FORMATO requerido: JSON
{
  "title": "título interno curto para identificação",
  "hook": "primeira linha impactante (máx. 15 palavras) que faz o usuário clicar em 'ver mais'",
  "body": "corpo do post completo (500–900 caracteres) incluindo o hook. Dados reais, narrativa clara, conclusão de impacto.",
  "cta": "chamada final para /avaliacao (1 linha)",
  "hashtags": ["array", "de", "5 a 8 hashtags", "sem #"],
  "sourceInsight": "em uma frase: qual é o insight principal deste post",
  "metadata": { "chars": 0, "format": "linkedin" }
}

ESTRUTURA IDEAL:
1. Hook: situação que o gestor reconhece (dor ou resultado)
2. Desenvolvimento: dado real + o que causou + o que resolveu
3. Lição: universal, aplicável
4. CTA: próximo passo concreto
`, input, data);

    const artifact = await saveContentArtifact("linkedin", content, input, data.roi);
    logger.info("LinkedIn post generated", { artifactId: artifact.id, orgId: input.orgId });
    return artifact;
}

/**
 * Generate an Instagram caption (shorter, punchier, emoji-ready).
 */
export async function generateInstagramPost(input: ContentInput): Promise<any> {
    const data = await loadInsightData(input);
    const content = await generate("instagram", `
Gere uma legenda para Instagram.

FORMATO requerido: JSON
{
  "title": "título interno curto",
  "hook": "primeira linha — máx. 10 palavras, sem emoji no início",
  "body": "legenda completa com emojis estratégicos (não em excesso). 200–400 chars. Dado real, resultado, CTA.",
  "cta": "linha final com link na bio ou /avaliacao",
  "hashtags": ["15 a 25 hashtags", "mix de nicho", "volume médio e alto"],
  "sourceInsight": "insight principal em uma frase",
  "metadata": { "chars": 0, "format": "instagram" }
}

TOM: direto, confiante, consultivo. Não usar "incríveis", "surpreendente", "transformador".
`, input, data);

    const artifact = await saveContentArtifact("instagram", content, input, data.roi);
    logger.info("Instagram post generated", { artifactId: artifact.id, orgId: input.orgId });
    return artifact;
}

/**
 * Generate a full case breakdown document (for blog, newsletter, or sales deck).
 */
export async function generateCaseBreakdown(input: ContentInput): Promise<any> {
    const data = await loadInsightData(input);
    const content = await generate("case_breakdown", `
Gere um case breakdown estruturado.

FORMATO requerido: JSON
{
  "title": "Título do case (ex: 'Como [empresa/setor] reduziu R$18mil/mês em operação manual')",
  "hook": "subtítulo / lead sentence",
  "body": "case breakdown completo em markdown com seções:\\n## Contexto\\n## Diagnóstico\\n## O que foi implementado\\n## Resultado (use números reais ou estimados)\\n## Lição para outros gestores",
  "cta": "CTA final para diagnóstico",
  "hashtags": [],
  "sourceInsight": "resumo do caso em 1 frase",
  "metadata": { "format": "case_breakdown", "wordCount": 0 }
}

REGRAS:
- Nunca mencione o nome da empresa real (use: 'empresa de serviços médicos', 'distribuidora regional', etc.)
- Use os números do ROI fornecido como base
- Foque em antes/depois mensurável
`, input, data);

    const artifact = await saveContentArtifact("case_breakdown", content, input, data.roi);
    logger.info("Case breakdown generated", { artifactId: artifact.id, orgId: input.orgId });
    return artifact;
}

/**
 * Generate an authority thread (Twitter/X format: 8-12 numbered posts).
 */
export async function generateAuthorityThread(input: ContentInput): Promise<any> {
    const data = await loadInsightData(input);
    const content = await generate("authority_thread", `
Gere um thread de autoridade para Twitter/X (8 a 12 tweets numerados).

FORMATO requerido: JSON
{
  "title": "título interno do thread",
  "hook": "Tweet 1 — gancho forte que promete o valor do thread inteiro",
  "body": "Thread completo formatado como:\\n1/ [gancho]\\n2/ [desenvolvimento]\\n...\\n12/ [CTA]\\nCada tweet: máx. 280 caracteres. Use dados reais.",
  "cta": "último tweet: CTA para /avaliacao",
  "hashtags": ["3 hashtags para o último tweet"],
  "sourceInsight": "tema central do thread",
  "metadata": { "tweetCount": 0, "format": "twitter_thread" }
}

TEMA SUGERIDO: erro comum de gestores + como corrigir com dados reais de automação
`, input, data);

    const artifact = await saveContentArtifact("authority_thread", content, input, data.roi);
    logger.info("Authority thread generated", { artifactId: artifact.id, orgId: input.orgId });
    return artifact;
}

/**
 * Generate a video script (2-3 minutes, for Reels/YouTube Shorts/LinkedIn video).
 */
export async function generateVideoScript(input: ContentInput): Promise<any> {
    const data = await loadInsightData(input);
    const content = await generate("video_script", `
Gere um roteiro de vídeo (2-3 minutos, Reels ou LinkedIn Video).

FORMATO requerido: JSON
{
  "title": "título do vídeo",
  "hook": "primeiros 5 segundos — frase ou pergunta que segura o espectador",
  "body": "roteiro completo com marcações:\\n[0:00-0:05] HOOK\\n[0:05-0:30] CONTEXTO\\n[0:30-1:30] CONTEÚDO PRINCIPAL (use dados reais)\\n[1:30-2:00] PROVA / RESULTADO\\n[2:00-2:30] CHAMADA PARA AÇÃO\\n\\nIncluir indicações de [FALA], [TEXTO NA TELA], [B-ROLL sugerido]",
  "cta": "CTA verbal no final do vídeo",
  "hashtags": ["5 hashtags para descripção"],
  "sourceInsight": "mensagem central do vídeo",
  "metadata": { "durationMin": 2.5, "format": "video_script", "platform": "reels_linkedin" }
}
`, input, data);

    const artifact = await saveContentArtifact("video_script", content, input, data.roi);
    logger.info("Video script generated", { artifactId: artifact.id, orgId: input.orgId });
    return artifact;
}

// ─── Status Transitions ───────────────────────────────────────────────────────

export const CONTENT_STATUS_FLOW = ["draft", "reviewed", "approved", "scheduled", "posted"] as const;
export type ContentStatus = typeof CONTENT_STATUS_FLOW[number];

export async function updateContentStatus(
    artifactId: string,
    newStatus: ContentStatus,
    userId?: string,
): Promise<any> {
    const now = new Date();
    const data: any = { status: newStatus, updatedAt: now };

    if (newStatus === "reviewed") { data.reviewedBy = userId; data.reviewedAt = now; }
    if (newStatus === "approved") { data.approvedBy = userId; data.approvedAt = now; }
    if (newStatus === "posted") { data.postedAt = now; }

    return (prisma as any).contentArtifact.update({
        where: { id: artifactId },
        data,
    });
}
