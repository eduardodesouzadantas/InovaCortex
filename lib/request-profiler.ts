import { AsyncLocalStorage } from "node:async_hooks";

import { logger } from "@/lib/logger";

type SlowQuery = {
    durationMs: number;
    query: string;
    target?: string;
};

type ProfileStep = {
    label: string;
    durationMs: number;
};

type RequestProfileStore = {
    route: string;
    method: string;
    startedAt: number;
    targetMs: number;
    prismaQueryMs: number;
    prismaQueryCount: number;
    slowQueries: SlowQuery[];
    steps: ProfileStep[];
};

const SLOW_QUERY_MS = 75;
const MAX_RECORDED_SLOW_QUERIES = 5;
const requestProfilerStorage = new AsyncLocalStorage<RequestProfileStore>();

function compactQuery(query: string): string {
    return query.replace(/\s+/g, " ").trim().slice(0, 220);
}

export function recordPrismaQuery(event: { duration: number; query: string; target?: string }): void {
    const store = requestProfilerStorage.getStore();
    if (!store) return;

    store.prismaQueryCount += 1;
    store.prismaQueryMs += event.duration;

    if (event.duration >= SLOW_QUERY_MS && store.slowQueries.length < MAX_RECORDED_SLOW_QUERIES) {
        store.slowQueries.push({
            durationMs: event.duration,
            query: compactQuery(event.query),
            target: event.target,
        });
    }
}

export async function profileStep<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    try {
        return await fn();
    } finally {
        const store = requestProfilerStorage.getStore();
        if (store) {
            store.steps.push({
                label,
                durationMs: Date.now() - startedAt,
            });
        }
    }
}

export async function profileRequest<T>(
    input: { route: string; method: string; targetMs?: number },
    fn: () => Promise<T>,
): Promise<T> {
    const store: RequestProfileStore = {
        route: input.route,
        method: input.method,
        startedAt: Date.now(),
        targetMs: input.targetMs ?? 500,
        prismaQueryMs: 0,
        prismaQueryCount: 0,
        slowQueries: [],
        steps: [],
    };

    return requestProfilerStorage.run(store, async () => {
        let thrownError: unknown = null;

        try {
            return await fn();
        } catch (error) {
            thrownError = error;
            throw error;
        } finally {
            const totalMs = Date.now() - store.startedAt;
            const slowestQueryMs = store.slowQueries.reduce((max, entry) => Math.max(max, entry.durationMs), 0);
            const level = thrownError || totalMs > store.targetMs ? "warn" : "info";

            logger[level]("[RequestProfile]", {
                route: store.route,
                method: store.method,
                totalMs,
                targetMs: store.targetMs,
                prismaQueryMs: Math.round(store.prismaQueryMs),
                prismaQueryCount: store.prismaQueryCount,
                slowestQueryMs,
                slowQueries: store.slowQueries,
                steps: store.steps,
                error: thrownError instanceof Error ? thrownError.message : thrownError ? String(thrownError) : undefined,
            });
        }
    });
}
