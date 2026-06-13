import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { assertAIEngineAvailable, isAIUnavailableError, toAIUnavailableError } from "@/lib/http/route-errors";

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_RETRIES = 2;
const MAX_PROMPT_LENGTH = 12_000;

export class OpenAIClientError extends Error {
    code: string;
    retryable: boolean;

    constructor(code: string, message: string, retryable = false) {
        super(message);
        this.name = "OpenAIClientError";
        this.code = code;
        this.retryable = retryable;
    }
}

type GenerateTextCompletionInput = {
    prompt: string;
    requestId?: string;
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    timeoutMs?: number;
    maxRetries?: number;
};

export type TextCompletionResult = {
    text: string;
    model: string;
    usage: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
};

function sanitizePrompt(prompt: string): string {
    const normalized = prompt.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ").trim();
    if (normalized.length <= MAX_PROMPT_LENGTH) return normalized;
    return normalized.slice(0, MAX_PROMPT_LENGTH);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function mapClientError(error: unknown): OpenAIClientError {
    if (error instanceof OpenAIClientError) {
        return error;
    }

    const message = error instanceof Error ? error.message : String(error);
    const normalized = message.toLowerCase();

    if (normalized.includes("timed out") || normalized.includes("timeout") || normalized.includes("abort")) {
        return new OpenAIClientError("OPENAI_TIMEOUT", "OpenAI request timed out", true);
    }
    if (normalized.includes("rate limit") || normalized.includes("429")) {
        return new OpenAIClientError("OPENAI_RATE_LIMIT", "OpenAI rate limit reached", true);
    }
    if (normalized.includes("5xx") || normalized.includes("503") || normalized.includes("502")) {
        return new OpenAIClientError("OPENAI_UPSTREAM_ERROR", "OpenAI upstream error", true);
    }
    return new OpenAIClientError("OPENAI_REQUEST_FAILED", "OpenAI request failed", false);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | null = null;
    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timeoutHandle = setTimeout(() => {
                    reject(new OpenAIClientError("OPENAI_TIMEOUT", "OpenAI request timed out", true));
                }, timeoutMs);
            }),
        ]);
    } finally {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
        }
    }
}

export async function generateTextCompletion(input: GenerateTextCompletionInput): Promise<TextCompletionResult> {
    assertAIEngineAvailable();
    const apiKey = process.env.OPENAI_API_KEY as string;

    const model = input.model ?? DEFAULT_MODEL;
    const temperature = typeof input.temperature === "number" ? input.temperature : 0.6;
    const timeoutMs = typeof input.timeoutMs === "number" ? input.timeoutMs : DEFAULT_TIMEOUT_MS;
    const maxRetries = typeof input.maxRetries === "number" ? input.maxRetries : DEFAULT_MAX_RETRIES;
    const prompt = sanitizePrompt(input.prompt);
    const openai = createOpenAI({ apiKey });

    let attempt = 0;
    while (attempt <= maxRetries) {
        try {
            const response = await withTimeout(
                generateText({
                    model: openai(model),
                    prompt,
                    temperature,
                    ...(typeof input.maxOutputTokens === "number" ? { maxOutputTokens: input.maxOutputTokens } : {}),
                }),
                timeoutMs,
            );

            const usage = (response.usage ?? {}) as {
                inputTokens?: number;
                outputTokens?: number;
                promptTokens?: number;
                completionTokens?: number;
            };

            const inputTokens = usage.inputTokens ?? usage.promptTokens ?? 0;
            const outputTokens = usage.outputTokens ?? usage.completionTokens ?? 0;

            return {
                text: response.text?.trim() ?? "",
                model,
                usage: {
                    inputTokens,
                    outputTokens,
                    totalTokens: inputTokens + outputTokens,
                },
            };
        } catch (error) {
            const mapped = mapClientError(error);
            if (isAIUnavailableError(mapped)) {
                throw toAIUnavailableError(mapped);
            }
            const shouldRetry = mapped.retryable && attempt < maxRetries;
            if (!shouldRetry) {
                throw mapped;
            }

            const backoffMs = attempt === 0 ? 350 : 900;
            await sleep(backoffMs);
            attempt += 1;
        }
    }

    throw new OpenAIClientError("OPENAI_REQUEST_FAILED", "OpenAI request failed", false);
}
