/**
 * lib/agents/content-generator-agent.ts
 * V20.1 Prompt 3/4: Batch Content Generator Agent.
 *
 * Generates social-media post content for up to 7 MarketingPlan entries
 * in a SINGLE LLM call — minimising token spend.
 *
 * Pipeline:
 *  1. Fetch MarketingPlan rows where contentJson IS NULL (next N days)
 *  2. Build deterministic batch payload
 *  3. Check AgentCache (skip LLM if hit)
 *  4. assertBudget(orgId, estimatedTokens)
 *  5. Single LLM call → JSON array [{day, content, hashtags, shortTitle}]
 *  6. Persist contentJson on each MarketingPlan row
 *  7. setCached(...)
 *  8. trackUsage(...)
 *
 * STUB mode: When OPENAI_API_KEY is absent, returns template-based content
 * and marks BillingRecord as stub (does not crash the app).
 *
 * Export: generateContentBatch(orgId, days?) → ContentBatchResult[]
 */

import { registerAgent } from "@/lib/agentops/registry";
import { assertBudget, trackUsage, BudgetExceededError } from "@/lib/agentops/budget";
import { makeCacheKey, getCached, setCached } from "@/lib/agentops/cache";
import { logger } from "@/lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContentBatchResult {
    day: number;
    platform: string;
    postType: string;
    topic: string;
    text: string;
    hashtags: string[];
    shortTitle: string;
    fromCache?: boolean;
    stub?: boolean;
}

export interface ContentJson {
    text: string;
    hashtags: string[];
    shortTitle: string;
}

// ─── Cost Estimation (gpt-4o-mini pricing) ───────────────────────────────────
// Input: $0.15/1M | Output: $0.60/1M

function estimateCost(promptTokens: number, completionTokens: number): number {
    return (promptTokens / 1_000_000) * 0.15 + (completionTokens / 1_000_000) * 0.60;
}

// ─── STUB Content Generator ───────────────────────────────────────────────────

function stubContent(entry: {
    day: number; platform: string; postType: string; topic: string; hook: string; cta: string;
}): ContentJson {
    const hashtagMap: Record<string, string[]> = {
        authority: ["#automação", "#IA", "#liderança", "#escalabilidade"],
        case: ["#case", "#sucesso", "#automação", "#resultados"],
        insight: ["#dicas", "#automação", "#produtividade", "#IA"],
        demonstration: ["#demo", "#IA", "#tecnologia", "#automação"],
        offer: ["#vagas", "#consultoria", "#IA", "#transformação"],
        myth_break: ["#mitos", "#verdade", "#automação", "#IA"],
    };

    const tags = hashtagMap[entry.postType] ?? ["#IA", "#automação"];
    const platformNote = entry.platform === "linkedin"
        ? "Compartilhe com sua rede."
        : "Curta e salve este post.";

    return {
        text: `${entry.hook}\n\n${entry.topic}\n\n${entry.cta}\n\n${platformNote}`,
        hashtags: tags,
        shortTitle: entry.topic.slice(0, 60),
    };
}

// ─── LLM Prompt Builder ───────────────────────────────────────────────────────

function buildBatchPrompt(
    entries: Array<{ day: number; platform: string; postType: string; topic: string; hook: string; cta: string }>
): string {
    return `Você é um copywriter especialista em marketing B2B high-ticket.

Gere posts curtos e objetivos para redes sociais.

REGRAS:
- linguagem clara e direta
- evitar exageros e promessas absolutas
- foco em donos de empresa
- CTA simples e concreto
- máximo 120 palavras por post
- inclua 3-5 hashtags relevantes em português
- shortTitle: título curto do post (máx 60 chars)
- adapte o tom para a plataforma (LinkedIn = mais formal; Instagram = mais direto)

Você receberá um JSON com as entradas abaixo. Responda APENAS com um array JSON válido, sem markdown, sem código extra.

Formato de saída:
[
  {
    "day": <number>,
    "text": "<post completo em português, máx 120 palavras>",
    "hashtags": ["#tag1", "#tag2", "#tag3"],
    "shortTitle": "<título curto>"
  }
]

Entradas:
${JSON.stringify(entries, null, 2)}`;
}

// ─── Main Agent Function ──────────────────────────────────────────────────────

export async function generateContentBatch(
    orgId: string,
    days: number = 7,
): Promise<ContentBatchResult[]> {
    const { prisma } = await import("@/lib/prisma");

    // ── Step 1: Fetch pending MarketingPlan rows ─────────────────────────────

    const pending = await (prisma as any).marketingPlan.findMany({
        where: {
            orgId,
            contentJson: null,
        },
        orderBy: { day: "asc" },
        take: days,
    });

    if (pending.length === 0) {
        logger.info("ContentBatch: no pending entries", { orgId, days });
        return [];
    }

    // ── Step 2: Build batch input payload ────────────────────────────────────

    const batchInput = pending.map((p: any) => ({
        day: p.day,
        platform: p.platform,
        postType: p.postType,
        topic: p.topic,
        hook: p.hook,
        cta: p.cta,
    }));

    // ── Step 3: Cache lookup ─────────────────────────────────────────────────

    const model = "gpt-4o-mini";
    const { keyHash } = makeCacheKey("content_batch", model, batchInput);

    const cacheHit = await getCached(orgId, keyHash, 24 * 60 * 60 * 1000); // 24h TTL
    if (cacheHit) {
        logger.info("ContentBatch: cache hit", { orgId, keyHash, days: pending.length });
        const cached = cacheHit.output as ContentBatchResult[];
        return cached.map(e => ({ ...e, fromCache: true }));
    }

    // ── Step 4: Budget check ─────────────────────────────────────────────────

    const estimatedTokens = 1200;

    let budgetOk = true;
    try {
        await assertBudget(orgId, estimatedTokens);
    } catch (err) {
        if (err instanceof BudgetExceededError) {
            logger.warn("ContentBatch: budget exceeded, using STUB", { orgId });
            budgetOk = false;
        } else {
            throw err;
        }
    }

    // ── Step 5: LLM call (or STUB if no key / budget) ────────────────────────

    const apiKey = process.env.OPENAI_API_KEY;
    let results: ContentBatchResult[] = [];
    let tokensUsed = 0;
    let costUsd = 0;
    let isStub = false;

    if (!apiKey || !budgetOk) {
        // STUB mode — deterministic templates, zero cost
        isStub = true;
        results = batchInput.map((entry: any) => {
            const content = stubContent(entry);
            return {
                day: entry.day,
                platform: entry.platform,
                postType: entry.postType,
                topic: entry.topic,
                text: content.text,
                hashtags: content.hashtags,
                shortTitle: content.shortTitle,
                stub: true,
            };
        });
        logger.info("ContentBatch: STUB mode", { orgId, reason: !apiKey ? "no_api_key" : "budget_exceeded" });
    } else {
        // Real LLM call
        const { generateText } = await import("ai");
        const { createOpenAI } = await import("@ai-sdk/openai");

        const openai = createOpenAI({ apiKey });
        const prompt = buildBatchPrompt(batchInput);

        let rawText = "";
        const startMs = Date.now();

        try {
            const response = await generateText({
                model: openai(model),
                prompt,
                temperature: 0.6,
            });

            rawText = response.text ?? "";
            // AI SDK usage field names vary by version — use safe access
            const usage = (response.usage as any) ?? {};
            const inTok = usage.promptTokens ?? usage.inputTokens ?? 0;
            const outTok = usage.completionTokens ?? usage.outputTokens ?? 0;
            tokensUsed = inTok + outTok;
            costUsd = estimateCost(inTok, outTok);


        } catch (err: any) {
            logger.error("ContentBatch: LLM call failed, fallback to STUB", { orgId, error: err?.message });
            isStub = true;
        }

        const latencyMs = Date.now() - startMs;
        logger.info("ContentBatch: LLM response", { orgId, tokensUsed, costUsd, latencyMs, stub: isStub });

        if (!isStub) {
            // Parse LLM JSON response
            let parsed: Array<{ day: number; text: string; hashtags: string[]; shortTitle: string }> = [];
            try {
                // Strip any markdown code fences the model may have added
                const json = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
                parsed = JSON.parse(json);
            } catch {
                logger.error("ContentBatch: failed to parse LLM JSON, falling back to STUB", { orgId });
                isStub = true;
            }

            if (!isStub) {
                // Merge LLM output with original entry metadata
                results = batchInput.map((entry: any) => {
                    const llmEntry = parsed.find((p) => p.day === entry.day);
                    if (llmEntry) {
                        return {
                            day: entry.day,
                            platform: entry.platform,
                            postType: entry.postType,
                            topic: entry.topic,
                            text: llmEntry.text ?? "",
                            hashtags: Array.isArray(llmEntry.hashtags) ? llmEntry.hashtags : [],
                            shortTitle: llmEntry.shortTitle ?? entry.topic.slice(0, 60),
                        };
                    }
                    // LLM didn't generate this day — use STUB
                    const content = stubContent(entry);
                    return {
                        day: entry.day, platform: entry.platform, postType: entry.postType,
                        topic: entry.topic, text: content.text, hashtags: content.hashtags,
                        shortTitle: content.shortTitle, stub: true,
                    };
                });
            }
        }

        if (isStub) {
            results = batchInput.map((entry: any) => {
                const content = stubContent(entry);
                return {
                    day: entry.day, platform: entry.platform, postType: entry.postType,
                    topic: entry.topic, text: content.text, hashtags: content.hashtags,
                    shortTitle: content.shortTitle, stub: true,
                };
            });
        }
    }

    // ── Step 6: Persist contentJson on each row ──────────────────────────────

    await Promise.all(results.map(r =>
        (prisma as any).marketingPlan.updateMany({
            where: { orgId, day: r.day },
            data: {
                contentJson: JSON.stringify({
                    text: r.text,
                    hashtags: r.hashtags,
                    shortTitle: r.shortTitle,
                } satisfies ContentJson),
            },
        }).catch((err: any) => logger.warn("ContentBatch: persist failed for day", { day: r.day, error: err?.message }))
    ));

    // ── Step 7: Cache result ─────────────────────────────────────────────────

    if (!isStub && tokensUsed > 0) {
        await setCached(orgId, keyHash, {
            agentName: "content_generator_batch",
            model,
            inputObj: batchInput,
            outputObj: results,
            tokensUsed,
            costUsd,
        });
    }

    // ── Step 8: Track budget usage ───────────────────────────────────────────

    if (!isStub && tokensUsed > 0) {
        await trackUsage(orgId, tokensUsed, costUsd);
    }

    return results;
}

// ─── Agent Registration ───────────────────────────────────────────────────────

registerAgent(
    "content_generator_batch",
    async (input: { orgId: string; days?: number }) =>
        generateContentBatch(input.orgId, input.days ?? 7),
    {
        model: "gpt-4o-mini",
        maxTokens: 1500,
        temperature: 0.6,
        cacheEnabled: true,
        fallbackToTemplate: true,
    },
);
