import crypto from "crypto";

const WEBHOOK_SIGNATURE_VERSION = "v1";
const WEBHOOK_ERROR_MAX_LENGTH = 240;

function safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, "utf8");
    const rightBuffer = Buffer.from(right, "utf8");
    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function generateWebhookSecret(prefix = "whsec"): string {
    const normalizedPrefix = prefix.trim() || "whsec";
    return `${normalizedPrefix}_${crypto.randomBytes(32).toString("hex")}`;
}

export function signWebhookPayload(secret: string, timestamp: string, payload: string): string {
    const signature = crypto
        .createHmac("sha256", secret)
        .update(`${timestamp}.${payload}`, "utf8")
        .digest("hex");

    return `${WEBHOOK_SIGNATURE_VERSION}=${signature}`;
}

export function verifyWebhookPayloadSignature(secret: string, timestamp: string, payload: string, signatureHeader: string | null): boolean {
    if (!signatureHeader) {
        return false;
    }

    const [version, signature] = signatureHeader.split("=", 2);
    if (version !== WEBHOOK_SIGNATURE_VERSION || !signature) {
        return false;
    }

    const expected = signWebhookPayload(secret, timestamp, payload).slice(`${WEBHOOK_SIGNATURE_VERSION}=`.length);
    return safeEqual(signature, expected);
}

export function isTransientWebhookDeliveryFailure(statusCode: number): boolean {
    return statusCode === 408
        || statusCode === 425
        || statusCode === 429
        || (statusCode >= 500 && statusCode < 600);
}

export function sanitizeWebhookFailureMessage(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error);
    const sanitized = raw
        .replace(/Bearer\s+[A-Za-z0-9\-._~+/=]+/gi, "Bearer [redacted]")
        .replace(/(access_token|refresh_token|token|secret)=([^&\s]+)/gi, "$1=[redacted]")
        .replace(/[\r\n]+/g, " ")
        .trim();

    if (!sanitized) {
        return "WEBHOOK_DELIVERY_FAILED";
    }

    return sanitized.slice(0, WEBHOOK_ERROR_MAX_LENGTH);
}

