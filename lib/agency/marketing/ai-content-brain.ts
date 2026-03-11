import { generateTextCompletion } from "@/lib/ai/openai-client";
import { logger } from "@/lib/logger";

type ContentPillar = "educational" | "authority" | "case_study" | "engagement" | "offer";
type Platform = "instagram" | "linkedin" | "twitter_x" | "tiktok" | "youtube_shorts";

type AIContentInput = {
    organizationName: string;
    targetAudience: string;
    brandVoice: string;
    pillar: ContentPillar;
    platform: Platform;
    topic: string;
    requestId?: string;
};

export type AIContentOutput = {
    title: string;
    hook: string;
    body: string;
    cta: string;
    hashtags: string[];
    aiGenerated: true;
};

type CoreGeneratedContent = {
    title: string;
    hook: string;
    body: string;
    cta: string;
    hashtags: string[];
};

function sanitizeText(value: string, maxLength: number): string {
    const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
    if (cleaned.length <= maxLength) return cleaned;
    return cleaned.slice(0, maxLength).trim();
}

function sanitizeList(values: string[], maxItems: number): string[] {
    const normalized = values
        .map((item) => sanitizeText(item, 80))
        .filter((item) => item.length > 0);
    return normalized.slice(0, maxItems);
}

function normalizeHashtags(values: string[]): string[] {
    const normalized = values
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0)
        .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
        .map((tag) => tag.replace(/[^#a-z0-9_]/g, ""))
        .filter((tag) => tag.length > 1);

    const unique = Array.from(new Set(normalized)).slice(0, 8);
    if (!unique.includes("#inovacortex")) unique.push("#inovacortex");
    if (!unique.includes("#ai_generated")) unique.push("#ai_generated");
    return unique.slice(0, 8);
}

function tryParseJsonObject(text: string): Record<string, unknown> | null {
    const trimmed = text.trim();
    const direct = trimmed
        .replace(/^```json/i, "")
        .replace(/^```/i, "")
        .replace(/```$/, "")
        .trim();

    try {
        const parsed = JSON.parse(direct) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
        return null;
    } catch {
        return null;
    }
}

function fallbackContent(input: AIContentInput): CoreGeneratedContent {
    const platformLabel = input.platform.replace("_", " ");
    return {
        title: `${input.organizationName}: ${input.topic} for ${platformLabel}`,
        hook: `A practical ${input.pillar.replace("_", " ")} insight to accelerate growth.`,
        body: `Use this ${input.pillar.replace("_", " ")} angle to engage ${input.targetAudience} with a ${input.brandVoice} tone.`,
        cta: "Reply to schedule a growth planning call.",
        hashtags: ["#growth", "#marketing", "#inovacortex", "#ai_generated"],
    };
}

function buildPrompt(input: AIContentInput): string {
    return [
        "You are a senior B2B social copywriter.",
        "Generate one marketing content object in strict JSON only.",
        "Output keys: title, hook, body, cta, hashtags.",
        "hashtags must be an array of 4 to 8 hashtags.",
        "Do not include markdown or code fences.",
        `organizationName: ${sanitizeText(input.organizationName, 120)}`,
        `topic: ${sanitizeText(input.topic, 180)}`,
        `contentPillar: ${sanitizeText(input.pillar, 40)}`,
        `targetAudience: ${sanitizeText(input.targetAudience, 240)}`,
        `brandVoice: ${sanitizeText(input.brandVoice, 160)}`,
        `platform: ${sanitizeText(input.platform, 40)}`,
        "Platform rules:",
        "- instagram: short punchy hook and comment CTA.",
        "- linkedin: authority tone and richer body.",
        "- twitter_x: concise thread style.",
        "- tiktok: first-line hook and short script style.",
        "- youtube_shorts: short educational script.",
        "Language: Portuguese (Brazil).",
    ].join("\n");
}

function applyPlatformTuning(input: { platform: Platform; content: CoreGeneratedContent }): CoreGeneratedContent {
    const base = input.content;

    if (input.platform === "instagram") {
        const cta = base.cta.toLowerCase().includes("comente") ? base.cta : "Comente \"PLANO\" para receber o roteiro.";
        return { ...base, cta };
    }
    if (input.platform === "linkedin") {
        const body = base.body.length < 180 ? `${base.body} Traga um exemplo real da sua operacao e compare resultados.` : base.body;
        return { ...base, body };
    }
    if (input.platform === "twitter_x") {
        const hook = base.hook.endsWith(":") ? base.hook : `${base.hook}:`;
        return { ...base, hook };
    }
    if (input.platform === "tiktok") {
        const hook = base.hook.toLowerCase().includes("2 segundos")
            ? base.hook
            : `Primeiros 2 segundos: ${base.hook}`;
        return { ...base, hook };
    }
    return base;
}

async function generateCoreContent(input: AIContentInput): Promise<CoreGeneratedContent> {
    const prompt = buildPrompt(input);
    let completionText = "";
    try {
        const completion = await generateTextCompletion({
            prompt,
            requestId: input.requestId,
            temperature: 0.7,
            maxOutputTokens: 700,
            timeoutMs: 15_000,
            maxRetries: 2,
        });
        completionText = completion.text;
    } catch (error) {
        logger.warn("ai_content_generation_degraded", {
            requestId: input.requestId ?? null,
            organizationName: input.organizationName,
            platform: input.platform,
            pillar: input.pillar,
            reason: error instanceof Error ? error.message : String(error),
        });
        return fallbackContent(input);
    }

    const parsed = tryParseJsonObject(completionText);
    if (!parsed) {
        return fallbackContent(input);
    }

    const title = typeof parsed.title === "string" ? sanitizeText(parsed.title, 120) : "";
    const hook = typeof parsed.hook === "string" ? sanitizeText(parsed.hook, 180) : "";
    const body = typeof parsed.body === "string" ? sanitizeText(parsed.body, 1_000) : "";
    const cta = typeof parsed.cta === "string" ? sanitizeText(parsed.cta, 180) : "";
    const hashtags = Array.isArray(parsed.hashtags)
        ? sanitizeList(parsed.hashtags.filter((item): item is string => typeof item === "string"), 8)
        : [];

    if (!title || !hook || !body || !cta) {
        return fallbackContent(input);
    }

    return {
        title,
        hook,
        body,
        cta,
        hashtags,
    };
}

export async function generatePlatformAdaptation(input: AIContentInput & { content: CoreGeneratedContent }): Promise<CoreGeneratedContent> {
    return applyPlatformTuning({
        platform: input.platform,
        content: input.content,
    });
}

export async function generateAIContent(input: AIContentInput): Promise<AIContentOutput> {
    const base = await generateCoreContent(input);
    const adapted = await generatePlatformAdaptation({
        ...input,
        content: base,
    });

    return {
        title: adapted.title,
        hook: adapted.hook,
        body: adapted.body,
        cta: adapted.cta,
        hashtags: normalizeHashtags(adapted.hashtags),
        aiGenerated: true,
    };
}

export async function generatePostContent(input: AIContentInput): Promise<AIContentOutput> {
    return generateAIContent(input);
}

export async function generateHook(input: AIContentInput): Promise<string> {
    const result = await generateAIContent(input);
    return result.hook;
}

export async function generateCTA(input: AIContentInput): Promise<string> {
    const result = await generateAIContent(input);
    return result.cta;
}

export async function generateHashtags(input: AIContentInput): Promise<string[]> {
    const result = await generateAIContent(input);
    return result.hashtags;
}
