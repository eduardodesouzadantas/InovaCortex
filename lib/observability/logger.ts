import { ZodError } from "zod";

import { isApiRouteError } from "@/lib/http/route-errors";
import { getRequestContext } from "@/lib/observability/request-context";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
    requestId?: string | null;
    organizationId?: string | null;
    organizationSlug?: string | null;
    orgId?: string | null;
    tenantId?: string | null;
    userId?: string | null;
    route?: string | null;
    method?: string | null;
    operation?: string | null;
    correlationId?: string | null;
    entityId?: string | null;
    latencyMs?: number | null;
    [key: string]: unknown;
}

const LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
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

function getMinLevel(): LogLevel {
    if (process.env.DEBUG_MODE === "true") return "debug";
    return "info";
}

function normalizeContext(context?: LogContext): LogContext {
    const requestContext = getRequestContext();
    const merged = {
        ...requestContext,
        ...(context ?? {}),
    } as LogContext;

    if (!merged.organizationId && merged.orgId) {
        merged.organizationId = String(merged.orgId);
    }

    if (!merged.organizationId && merged.tenantId) {
        merged.organizationId = String(merged.tenantId);
    }

    if (!merged.requestId && typeof requestContext.requestId === "string") {
        merged.requestId = requestContext.requestId;
    }

    return sanitize(merged) as LogContext;
}

function write(level: LogLevel, message: string, context?: LogContext): void {
    if (LEVELS[level] < LEVELS[getMinLevel()]) return;

    const normalized = normalizeContext(context);
    const entry = {
        ts: new Date().toISOString(),
        level,
        message,
        service: "inovacortex",
        env: process.env.NODE_ENV ?? "development",
        ...(normalized.requestId ? { requestId: normalized.requestId } : {}),
        ...(normalized.organizationId ? { organizationId: normalized.organizationId } : {}),
        ...(normalized.organizationSlug ? { organizationSlug: normalized.organizationSlug } : {}),
        ...(normalized.userId ? { userId: normalized.userId } : {}),
        ...(normalized.route ? { route: normalized.route } : {}),
        ...(normalized.method ? { method: normalized.method } : {}),
        ...(normalized.operation ? { operation: normalized.operation } : {}),
        ...(normalized.correlationId ? { correlationId: normalized.correlationId } : {}),
        ...(normalized.entityId ? { entityId: normalized.entityId } : {}),
        ...(normalized.latencyMs ? { latencyMs: normalized.latencyMs } : {}),
        ctx: normalized,
    };

    const output = JSON.stringify(entry);

    if (level === "error") {
        console.error(output);
    } else if (level === "warn") {
        console.warn(output);
    } else {
        console.log(output);
    }
}

export function log(level: LogLevel, message: string, context?: LogContext): void {
    write(level, message, context);
}

export const logger = {
    debug: (msg: string, ctx?: LogContext) => write("debug", msg, ctx),
    info: (msg: string, ctx?: LogContext) => write("info", msg, ctx),
    warn: (msg: string, ctx?: LogContext) => write("warn", msg, ctx),
    error: (msg: string, ctx?: LogContext) => write("error", msg, ctx),
    timed: async <T>(label: string, fn: () => Promise<T>, ctx?: LogContext): Promise<T> => {
        const start = Date.now();
        try {
            const result = await fn();
            write("info", label, { ...ctx, latencyMs: Date.now() - start });
            return result;
        } catch (err) {
            write("error", `${label} failed`, { ...ctx, latencyMs: Date.now() - start, error: String(err) });
            throw err;
        }
    },
};

function resolveStatusFromError(error: unknown): number {
    if (error instanceof Response) return error.status || 500;
    if (isApiRouteError(error)) return error.status;
    if (error instanceof ZodError) return 422;
    if (error && typeof error === "object" && "status" in error) {
        const status = (error as { status?: unknown }).status;
        if (typeof status === "number") return status;
    }

    const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
    if (message.includes("unauthenticated") || message.includes("unauthorized")) return 401;
    if (message.includes("forbidden")) return 403;
    if (message.includes("not found") || message.includes("org_not_found") || message.includes("p2025")) return 404;
    if (message.includes("validation") || message.includes("unprocessable") || message.includes("invalid_payload") || message.includes("zod")) return 422;
    if (message.includes("conflict") || message.includes("already exists") || message.includes("duplicate")) return 409;
    if (message.includes("rate limit") || message.includes("too many requests")) return 429;
    if (message.includes("timeout") || message.includes("timed out")) return 504;
    return 500;
}

export function inferErrorStatus(error: unknown): number {
    return resolveStatusFromError(error);
}
