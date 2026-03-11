import { logger } from "@/lib/logger";

type ObservabilityLevel = "info" | "warn" | "error";

export type ObservabilityContext = {
    requestId?: string | null;
    tenantId?: string | null;
    module?: string;
    event?: string;
    timestamp?: string;
    [key: string]: unknown;
};

const SENSITIVE_KEYS = ["token", "secret", "password", "authorization", "apikey", "api_key"] as const;

function isSensitiveKey(key: string): boolean {
    const normalized = key.toLowerCase();
    return SENSITIVE_KEYS.some((candidate) => normalized.includes(candidate));
}

function sanitize(value: unknown, depth = 0): unknown {
    if (value === null || value === undefined) return null;
    if (depth >= 4) return "[TRUNCATED]";

    if (Array.isArray(value)) {
        return value.slice(0, 30).map((entry) => sanitize(entry, depth + 1));
    }

    if (typeof value === "object") {
        const source = value as Record<string, unknown>;
        const target: Record<string, unknown> = {};
        for (const [key, entry] of Object.entries(source)) {
            if (isSensitiveKey(key)) {
                target[key] = "[REDACTED]";
                continue;
            }
            target[key] = sanitize(entry, depth + 1);
        }
        return target;
    }

    if (typeof value === "string") {
        if (value.length > 1200) return `${value.slice(0, 1200)}...[TRUNCATED]`;
        return value;
    }

    if (typeof value === "number" || typeof value === "boolean") return value;
    return String(value);
}

function normalizedContext(context: ObservabilityContext): ObservabilityContext {
    const timestamp = context.timestamp ?? new Date().toISOString();
    return sanitize({ ...context, timestamp }) as ObservabilityContext;
}

function write(level: ObservabilityLevel, message: string, context: ObservabilityContext): void {
    const safe = normalizedContext(context);
    if (level === "error") {
        logger.error(message, safe);
        return;
    }
    if (level === "warn") {
        logger.warn(message, safe);
        return;
    }
    logger.info(message, safe);
}

export function logInfo(event: string, context: ObservabilityContext = {}): void {
    write("info", event, { ...context, event });
}

export function logWarn(event: string, context: ObservabilityContext = {}): void {
    write("warn", event, { ...context, event });
}

export function logError(event: string, context: ObservabilityContext = {}): void {
    write("error", event, { ...context, event });
}

export function logMetric(metricName: string, value: number, context: ObservabilityContext = {}): void {
    logInfo("metric_observed", {
        ...context,
        metric: metricName,
        value,
    });
}

