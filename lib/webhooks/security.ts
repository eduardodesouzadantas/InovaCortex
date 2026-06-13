import crypto from "crypto";
import { logger } from "@/lib/logger";

type WebhookProvider = "stripe" | "meta" | "whatsapp" | "calendly";
type SafeLogLevel = "info" | "warn" | "error";

function safeEqualStrings(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, "utf8");
    const rightBuffer = Buffer.from(right, "utf8");
    if (leftBuffer.length !== rightBuffer.length) return false;
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function safeEqualHex(left: string, right: string): boolean {
    try {
        const leftBuffer = Buffer.from(left, "hex");
        const rightBuffer = Buffer.from(right, "hex");
        if (leftBuffer.length === 0 || rightBuffer.length === 0) return false;
        if (leftBuffer.length !== rightBuffer.length) return false;
        return crypto.timingSafeEqual(leftBuffer, rightBuffer);
    } catch {
        return false;
    }
}

function logWebhook(
    level: SafeLogLevel,
    provider: WebhookProvider,
    message: string,
    context: Record<string, unknown>,
) {
    logger[level](`[Webhook:${provider}] ${message}`, context);
}

export function parseWebhookJson<T>(rawBody: string): T | null {
    try {
        return JSON.parse(rawBody) as T;
    } catch {
        return null;
    }
}

export function verifyMetaSignature(rawBody: string, signature: string | null, appSecret: string): boolean {
    if (!signature?.startsWith("sha256=")) return false;

    const expected = crypto
        .createHmac("sha256", appSecret)
        .update(rawBody, "utf8")
        .digest("hex");

    return safeEqualHex(signature.slice("sha256=".length), expected);
}

export function verifyCalendlySignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
    if (!signatureHeader) return false;

    const parts = Object.fromEntries(
        signatureHeader.split(",").map((part) => {
            const [key, value] = part.split("=", 2);
            return [key?.trim() ?? "", value?.trim() ?? ""];
        }),
    );

    const timestamp = parts.t;
    const providedSignature = parts.v1;
    if (!timestamp || !providedSignature) return false;

    const expected = crypto
        .createHmac("sha256", secret)
        .update(`${timestamp}.${rawBody}`, "utf8")
        .digest("hex");

    return safeEqualHex(providedSignature, expected);
}

export async function verifyStripeEvent(rawBody: string, signature: string | null, secretKey: string, webhookSecret: string) {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });
    return stripe.webhooks.constructEvent(rawBody, signature ?? "", webhookSecret);
}

export function extractWebhookEventMeta(provider: WebhookProvider, payload: unknown) {
    if (!payload || typeof payload !== "object") {
        return { provider, eventType: "unknown", eventId: null };
    }

    const body = payload as Record<string, unknown>;

    if (provider === "stripe") {
        return {
            provider,
            eventType: typeof body.type === "string" ? body.type : "unknown",
            eventId: typeof body.id === "string" ? body.id : null,
        };
    }

    if (provider === "calendly") {
        const payloadBody = body.payload && typeof body.payload === "object"
            ? body.payload as Record<string, unknown>
            : null;
        return {
            provider,
            eventType: typeof body.event === "string" ? body.event : "unknown",
            eventId: typeof payloadBody?.invitee === "string"
                ? payloadBody.invitee
                : typeof payloadBody?.event === "string"
                    ? payloadBody.event
                    : null,
        };
    }

    const entry = Array.isArray(body.entry) ? body.entry[0] as Record<string, unknown> | undefined : undefined;
    const change = entry && Array.isArray(entry.changes) ? entry.changes[0] as Record<string, unknown> | undefined : undefined;
    const value = change?.value && typeof change.value === "object" ? change.value as Record<string, unknown> : null;
    const status = value && Array.isArray(value.statuses) ? value.statuses[0] as Record<string, unknown> | undefined : undefined;
    const message = value && Array.isArray(value.messages) ? value.messages[0] as Record<string, unknown> | undefined : undefined;

    return {
        provider,
        eventType: typeof change?.field === "string"
            ? change.field
            : (status ? "status_update" : message ? "message" : "unknown"),
        eventId: typeof status?.id === "string"
            ? status.id
            : typeof message?.id === "string"
                ? message.id
                : null,
    };
}

export function logWebhookReceived(provider: WebhookProvider, payload: unknown, context: Record<string, unknown> = {}) {
    const meta = extractWebhookEventMeta(provider, payload);
    logWebhook("info", provider, "received", { ...meta, ...context });
}

export function logWebhookRejected(provider: WebhookProvider, reason: string, context: Record<string, unknown> = {}) {
    logWebhook("warn", provider, "rejected", { reason, ...context });
}

export function logWebhookFailure(provider: WebhookProvider, error: unknown, context: Record<string, unknown> = {}) {
    const message = error instanceof Error ? error.message : String(error);
    logWebhook("error", provider, "failed", { error: message, ...context });
}

export function logWebhookProcessed(provider: WebhookProvider, payload: unknown, context: Record<string, unknown> = {}) {
    const meta = extractWebhookEventMeta(provider, payload);
    logWebhook("info", provider, "processed", { ...meta, ...context });
}

export function resolveCalendlyWebhookSecret(): string | null {
    return (process.env.CALENDLY_WEBHOOK_SECRET ?? process.env.WEBHOOK_SECRET_CALENDLY ?? "").trim() || null;
}

export function hasExpectedWebhookSecret(secret: string | null, expected: string | null): boolean {
    if (!secret || !expected) return false;
    return safeEqualStrings(secret, expected);
}
