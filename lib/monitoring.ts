/**
 * lib/monitoring.ts
 * V11: Sentry error capture wrapper with organizational context.
 * Gracefully no-ops when NEXT_PUBLIC_SENTRY_DSN is not configured.
 */

interface CaptureContext {
    orgId?: string;
    userId?: string;
    entityId?: string;
    route?: string;
    extra?: Record<string, unknown>;
    level?: "fatal" | "error" | "warning" | "info";
}

/**
 * Capture an exception with organizational context.
 * Safe to call even when Sentry is not configured.
 */
export async function captureException(
    error: unknown,
    context?: CaptureContext
): Promise<void> {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

    try {
        const Sentry = await import("@sentry/nextjs");
        Sentry.withScope(scope => {
            scope.setLevel(context?.level ?? "error");
            if (context?.orgId) scope.setTag("orgId", context.orgId);
            if (context?.userId) scope.setTag("userId", context.userId);
            if (context?.route) scope.setTag("route", context.route);
            if (context?.entityId) scope.setTag("entityId", context.entityId);
            if (context?.extra) scope.setExtras(context.extra);
            Sentry.captureException(error);
        });
    } catch {
        /* Sentry unavailable — silent fail */
    }
}

/**
 * Set user context for the current Sentry session.
 */
export async function setSentryUser(userId: string, orgId: string): Promise<void> {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
    try {
        const Sentry = await import("@sentry/nextjs");
        Sentry.setUser({ id: userId, organization: orgId });
    } catch { /* Silent */ }
}

/**
 * Clear Sentry user context (e.g., on logout).
 */
export async function clearSentryUser(): Promise<void> {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
    try {
        const Sentry = await import("@sentry/nextjs");
        Sentry.setUser(null);
    } catch { /* Silent */ }
}

/**
 * Check if error monitoring is active.
 */
export function isMonitoringEnabled(): boolean {
    return !!process.env.NEXT_PUBLIC_SENTRY_DSN;
}
