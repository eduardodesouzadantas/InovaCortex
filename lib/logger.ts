/**
 * lib/logger.ts (V11 Enhanced)
 * Structured logger with orgId, userId, route, latencyMs context fields.
 * Integrates with Sentry for error-level logs.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
    orgId?: string;
    userId?: string;
    entityId?: string;
    route?: string;
    latencyMs?: number;
    [key: string]: unknown;
}

const LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

function getMinLevel(): LogLevel {
    if (process.env.DEBUG_MODE === "true") return "debug";
    return "info";
}

export function log(
    level: LogLevel,
    message: string,
    context?: LogContext
): void {
    const minLevel = getMinLevel();
    if (LEVELS[level] < LEVELS[minLevel]) return;

    const entry = {
        ts: new Date().toISOString(),
        level,
        message,
        service: "inovacortex",
        env: process.env.NODE_ENV ?? "development",
        ...(context ? { ctx: context } : {}),
    };

    const output = JSON.stringify(entry);

    // V11: Send errors to Sentry if available
    if (level === "error") {
        console.error(output);
        // Lazy Sentry import to avoid SSR issues
        try {
            if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
                import("@sentry/nextjs").then(Sentry => {
                    Sentry.withScope(scope => {
                        if (context?.orgId) scope.setTag("orgId", context.orgId as string);
                        if (context?.userId) scope.setTag("userId", context.userId as string);
                        if (context?.route) scope.setTag("route", context.route as string);
                        if (context?.entityId) scope.setTag("entityId", context.entityId as string);
                        scope.setExtra("context", context ?? {});
                        Sentry.captureMessage(message, "error");
                    });
                }).catch(() => { /* Sentry not available */ });
            }
        } catch { /* Non-fatal */ }
    } else if (level === "warn") {
        console.warn(output);
    } else {
        console.log(output);
    }
}

/** Shorthand helpers */
export const logger = {
    debug: (msg: string, ctx?: LogContext) => log("debug", msg, ctx),
    info: (msg: string, ctx?: LogContext) => log("info", msg, ctx),
    warn: (msg: string, ctx?: LogContext) => log("warn", msg, ctx),
    error: (msg: string, ctx?: LogContext) => log("error", msg, ctx),

    /** Convenience: measure and log latency */
    timed: async <T>(
        label: string,
        fn: () => Promise<T>,
        ctx?: LogContext
    ): Promise<T> => {
        const start = Date.now();
        try {
            const result = await fn();
            log("info", label, { ...ctx, latencyMs: Date.now() - start });
            return result;
        } catch (err) {
            log("error", `${label} failed`, { ...ctx, latencyMs: Date.now() - start, error: String(err) });
            throw err;
        }
    },
};
