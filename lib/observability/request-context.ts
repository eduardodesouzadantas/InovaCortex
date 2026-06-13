import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "crypto";

export type RequestContext = {
    requestId?: string;
    organizationId?: string;
    organizationSlug?: string;
    userId?: string;
    route?: string;
    method?: string;
    operation?: string;
    correlationId?: string;
    [key: string]: unknown;
};

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

function sanitizeRequestId(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 128) return null;
    return trimmed;
}

export function createRequestId(prefix = "req"): string {
    return `${prefix}_${crypto.randomUUID()}`;
}

export function resolveRequestIdFromHeaders(headers: Headers | { get(name: string): string | null } | null | undefined): string {
    const requestId =
        sanitizeRequestId(headers?.get("x-request-id")) ??
        sanitizeRequestId(headers?.get("x-correlation-id"));

    return requestId ?? createRequestId();
}

export function getRequestContext(): RequestContext {
    return { ...(requestContextStorage.getStore() ?? {}) };
}

export function setRequestContext(patch: RequestContext): RequestContext {
    const current = requestContextStorage.getStore() ?? {};
    const next = { ...current, ...patch };
    requestContextStorage.enterWith(next);
    return next;
}

export async function runWithRequestContext<T>(
    context: RequestContext,
    fn: () => Promise<T> | T,
): Promise<T> {
    const current = requestContextStorage.getStore() ?? {};
    const merged = { ...current, ...context };

    return await requestContextStorage.run(merged, async () => fn());
}

