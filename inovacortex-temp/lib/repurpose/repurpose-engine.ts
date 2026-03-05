/**
 * lib/repurpose/repurpose-engine.ts
 * V21 Prompt 1/4: Repurpose Engine — 1 post → 5 content formats.
 *
 * Pipeline:
 *  1. Fetch MarketingPlan (must have contentJson.text)
 *  2. Build deterministic input payload
 *  3. Cache check (AgentCache, 7-day TTL)
 *  4. assertBudget(orgId, 1500)
 *  5. 1 × gpt-4o-mini call → 5-format JSON
 *  6. Save RepurposeArtifact (status=draft)
 *  7. setCached + trackUsage
 *  8. Log RepurposeRun (success | stub | failed)
 *
 * Formats:
 *   linkedin_v2  – variation of the source post
 *   carousel     – 7-slide Instagram carousel outline
 *   thread       – 8–12 tweet thread
 *   video        – 60–90s video script with scenes
 *   email        – newsletter 200–300 words
 */

import { assertBudget, trackUsage, BudgetExceededError } from "@/lib/agentops/budget";
import { makeCacheKey, getCached, setCached } from "@/lib/agentops/cache";
import { logger } from "@/lib/logger";
import {
    buildStubFormats,
    type RepurposeFormats,
    type LinkedInV2,
    type CarouselSlides,
    type TwitterThread,
    type VideoScript,
    type EmailNewsletter,
} from "./stub-formats";



export interface RepurposeResult {
    artifactId: string;
    formats: RepurposeFormats;
    fromCache: boolean;
    stub: boolean;
    tokensUsed: number;
    costUsd: number;
}

// ─── Cost estimation (gpt-4o-mini) ───────────────────────────────────────────

function estimateCost(inTok: number, outTok: number): number {
    return (inTok / 1_000_000) * 0.15 + (outTok / 1_000_000) * 0.60;
}

// ─── STUB generator (zero tokens, deterministic) ──────────────────────────────

export function buildStubFormats(plan: {
    topic: string;
    hook: string;
    cta: string;
    postType: string;
    platform: string;
}): RepurposeFormats {
    const t = plan.topic;
    const h = plan.hook;
    const c = plan.cta;

    const linkedin_v2: LinkedInV2 = {
        hook: `🔑 ${h}`,
        text: `Já abordei isso antes, mas vale reforçar:\n\n${t}\n\nO que muda quando você aplica isso:\n→ Mais resultados com menos esforço\n→ Processos mais previsíveis\n→ Time focado no que importa\n\n${c}`,
        cta: c,
    };

    const carousel: CarouselSlides = {
        title: t,
        slides: [
            `Slide 1: ${t}`,
            `Slide 2: O problema que isso resolve`,
            `Slide 3: Por que acontece`,
            `Slide 4: A solução em 3 passos`,
            `Slide 5: Exemplo prático`,
            `Slide 6: Resultados esperados`,
            `Slide 7: ${c}`,
        ],
        cta: c,
    };

    const thread: TwitterThread = {
        tweets: [
            `1/ ${h}`,
            `2/ O contexto: ${t}`,
            `3/ Por que isso importa para o seu negócio:`,
            `4/ A maioria das empresas ignora isso. O custo? Alto.`,
            `5/ 3 sinais de que você precisa mudar agora:`,
            `6/ → Processos repetitivos tomando horas do seu time`,
            `7/ → Clientes esperando resposta por horas`,
            `8/ → Erros humanos custando dinheiro`,
            `9/ A solução começa com automação inteligente.`,
            `10/ Não precisa ser complexo. Começa simples.`,
            `11/ ${c}`,
            `12/ RT se isso fez sentido para você 🔁`,
        ],
    };

    const video: VideoScript = {
        hook: h,
        scenes: [
            { sec: 0, fala: h, tela: "Texto animado na tela: gancho principal" },
            { sec: 8, fala: `Vou te mostrar o que é possível com ${t.toLowerCase()}.`, tela: "B-roll: tela de computador ou equipe" },
            { sec: 20, fala: "Primeiro, o problema comum:", tela: "Texto: 'Processos manuais = tempo perdido'" },
            { sec: 30, fala: "E aqui está como resolver:", tela: "Screen capture ou animação" },
            { sec: 45, fala: "O resultado para nossos clientes:", tela: "Gráficos de resultado" },
            { sec: 60, fala: c, tela: "CTA com link" },
        ],
        cta: c,
    };

    const email: EmailNewsletter = {
        subject: `📌 ${t}`,
        body: `Olá,\n\n${h}\n\nEsta semana quero falar sobre ${t.toLowerCase()}.\n\n` +
            `Muitas empresas que acompanhamos enfrentam o mesmo desafio: processos que consomem tempo do time sem gerar valor proporcional.\n\n` +
            `A boa notícia é que existe uma forma mais inteligente de trabalhar.\n\n` +
            `Aqui está o que funciona:\n` +
            `→ Mapear o processo que mais toma tempo\n` +
            `→ Identificar o que pode ser automatizado\n` +
            `→ Implementar gradualmente, com métricas\n\n` +
            `${c}\n\n` +
            `Até a próxima,\n` +
            `[Equipe InovaCortex]`,
    };

    return { linkedin_v2, carousel, thread, video, email };
}

// ─── LLM Prompt Builder ───────────────────────────────────────────────────────

function buildRepurposePrompt(plan: {
    topic: string;
    hook: string;
    cta: string;
    text: string;
    platform: string;
    postType: string;
}): string {
    return `Você é um expert em criação de conteúdo B2B high-ticket em português.

Transforme este post de ${plan.platform} em 5 formatos diferentes.

POST ORIGINAL:
Tópico: ${plan.topic}
Hook: ${plan.hook}
Texto: ${plan.text}
CTA: ${plan.cta}

REGRAS:
- tom consultivo, sem exageros
- focado em donos de empresa
- sem promessas absolutas
- respeite o contexto (B2B, automação/IA)
- Portuguese brasileiro

Responda APENAS com JSON válido, sem markdown, com exatamente esta estrutura:
{
  "linkedin_v2": {
    "hook": "<gancho diferente, máx 1 frase>",
    "text": "<variação do post, 150-250 palavras>",
    "cta": "<CTA simples>"
  },
  "carousel": {
    "title": "<título do carrossel>",
    "slides": ["<slide 1>","<slide 2>","<slide 3>","<slide 4>","<slide 5>","<slide 6>","<slide 7>"],
    "cta": "<slide final CTA>"
  },
  "thread": {
    "tweets": ["1/ <tweet>","2/ <tweet>","3/ <tweet>","4/ <tweet>","5/ <tweet>","6/ <tweet>","7/ <tweet>","8/ <tweet>","9/ <tweet>","10/ <tweet>","11/ <tweet>","12/ <tweet>"]
  },
  "video": {
    "hook": "<fala de abertura (0-5s)>",
    "scenes": [
      {"sec":0,"fala":"<fala>","tela":"<descrição visual>"},
      {"sec":10,"fala":"<fala>","tela":"<descrição visual>"},
      {"sec":20,"fala":"<fala>","tela":"<descrição visual>"},
      {"sec":35,"fala":"<fala>","tela":"<descrição visual>"},
      {"sec":50,"fala":"<fala>","tela":"<descrição visual>"},
      {"sec":65,"fala":"<fala>","tela":"<descrição visual>"}
    ],
    "cta": "<chamada final>"
  },
  "email": {
    "subject": "<assunto do e-mail>",
    "body": "<corpo do e-mail, 200-300 palavras>"
  }
}`;
}

// ─── Main Engine Function ─────────────────────────────────────────────────────

export async function repurposeFromPlan(
    orgId: string,
    marketingPlanId: string,
): Promise<RepurposeResult> {
    const { prisma } = await import("@/lib/prisma");

    // ── Step 1: Fetch MarketingPlan ───────────────────────────────────────────

    const plan = await (prisma as any).marketingPlan.findUnique({
        where: { id: marketingPlanId },
    });

    if (!plan) throw new Error(`MarketingPlan not found: ${marketingPlanId}`);

    const contentParsed = (() => {
        try { return JSON.parse(plan.contentJson ?? "{}"); } catch { return {}; }
    })();

    const sourceText = contentParsed.text ?? plan.hook ?? plan.topic;

    // ── Step 2: Build deterministic input payload ─────────────────────────────

    const inputPayload = {
        topic: plan.topic,
        hook: plan.hook,
        cta: plan.cta,
        text: sourceText,
        platform: plan.platform,
        postType: plan.postType,
    };

    // ── Step 3: Cache check ───────────────────────────────────────────────────

    const model = "gpt-4o-mini";
    const { keyHash } = makeCacheKey("repurpose_engine", model, inputPayload);

    const cacheHit = await getCached(orgId, keyHash, 7 * 24 * 60 * 60 * 1000); // 7-day TTL
    if (cacheHit) {
        logger.info("[Repurpose] Cache hit", { orgId, marketingPlanId, keyHash });
        const cachedFormats = cacheHit.output as RepurposeFormats;

        // Still create/update artifact even from cache
        const artifact = await (prisma as any).repurposeArtifact.create({
            data: {
                orgId,
                sourceMarketingPlanId: marketingPlanId,
                formatsJson: JSON.stringify(cachedFormats),
                status: "draft",
            },
        });

        return {
            artifactId: artifact.id,
            formats: cachedFormats,
            fromCache: true,
            stub: false,
            tokensUsed: 0,
            costUsd: 0,
        };
    }

    // ── Step 4: Budget check ──────────────────────────────────────────────────

    const estimatedTokens = 1500;
    let budgetOk = true;

    try {
        await assertBudget(orgId, estimatedTokens);
    } catch (err) {
        if (err instanceof BudgetExceededError) {
            logger.warn("[Repurpose] Budget exceeded, using STUB", { orgId });
            budgetOk = false;
        } else { throw err; }
    }

    // ── Step 5: LLM call or STUB ──────────────────────────────────────────────

    const apiKey = process.env.OPENAI_API_KEY;
    let formats: RepurposeFormats;
    let tokensUsed = 0;
    let costUsd = 0;
    let isStub = !apiKey || !budgetOk;
    let runStatus: "success" | "stub" | "failed" = isStub ? "stub" : "success";
    let runError: string | undefined;

    if (!isStub) {
        try {
            const { generateText } = await import("ai");
            const { createOpenAI } = await import("@ai-sdk/openai");
            const openai = createOpenAI({ apiKey });

            const response = await generateText({
                model: openai(model),
                prompt: buildRepurposePrompt(inputPayload),
                temperature: 0.65,
            });

            const raw = (response.text ?? "")
                .replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

            const usage = (response.usage as any) ?? {};
            const inTok = usage.promptTokens ?? usage.inputTokens ?? 0;
            const outTok = usage.completionTokens ?? usage.outputTokens ?? 0;
            tokensUsed = inTok + outTok;
            costUsd = estimateCost(inTok, outTok);

            formats = JSON.parse(raw) as RepurposeFormats;
            runStatus = "success";

        } catch (err: any) {
            logger.error("[Repurpose] LLM failed, falling back to STUB", { orgId, error: err?.message });
            isStub = true;
            runStatus = "failed";
            runError = err?.message ?? "LLM error";
            formats = buildStubFormats(inputPayload);
        }
    } else {
        formats = buildStubFormats(inputPayload);
    }

    // ── Step 6: Save RepurposeArtifact ────────────────────────────────────────

    const artifact = await (prisma as any).repurposeArtifact.create({
        data: {
            orgId,
            sourceMarketingPlanId: marketingPlanId,
            formatsJson: JSON.stringify(formats),
            status: "draft",
        },
    });

    // ── Step 7: Cache + budget tracking ──────────────────────────────────────

    if (!isStub && tokensUsed > 0) {
        await setCached(orgId, keyHash, {
            agentName: "repurpose_engine",
            model,
            inputObj: inputPayload,
            outputObj: formats,
            tokensUsed,
            costUsd,
        }).catch(() => null);

        await trackUsage(orgId, tokensUsed, costUsd).catch(() => null);
    }

    // ── Step 8: Log RepurposeRun ──────────────────────────────────────────────

    await (prisma as any).repurposeRun.create({
        data: {
            orgId,
            sourceMarketingPlanId: marketingPlanId,
            tokensUsed,
            costUsd,
            status: runStatus,
            error: runError ?? null,
        },
    }).catch(() => null);

    logger.info("[Repurpose] Done", {
        orgId, marketingPlanId, artifactId: artifact.id, status: runStatus, tokensUsed,
    });

    return {
        artifactId: artifact.id,
        formats,
        fromCache: false,
        stub: isStub,
        tokensUsed,
        costUsd,
    };
}
