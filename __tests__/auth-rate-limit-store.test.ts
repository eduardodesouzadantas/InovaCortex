import {
    createFallbackRateLimitStore,
    createInMemoryRateLimitStore,
    createPrismaRateLimitStore,
    type RateLimitStore,
} from "../lib/auth/rate-limit-store";

function expectRateLimitStoreContract(store: RateLimitStore): void {
    expect(typeof store.consume).toBe("function");
    expect(typeof store.clear).toBe("function");
}

describe("auth rate limit stores", () => {
    it("implements the shared store interface", async () => {
        const store = createInMemoryRateLimitStore();
        expectRateLimitStoreContract(store);
        await store.clear();
        const snapshot = await store.consume({
            key: "auth:login:auth:identifier:test:203.0.113.10",
            windowMs: 1_000,
            now: 0,
        });
        expect(snapshot).toEqual({
            count: 1,
            resetAt: 1_000,
        });
    });

    it("increments and expires buckets in memory", async () => {
        const store = createInMemoryRateLimitStore();

        expect(await store.consume({
            key: "auth:login:auth:identifier:test:203.0.113.10",
            windowMs: 1_000,
            now: 0,
        })).toEqual({
            count: 1,
            resetAt: 1_000,
        });

        expect(await store.consume({
            key: "auth:login:auth:identifier:test:203.0.113.10",
            windowMs: 1_000,
            now: 0,
        })).toEqual({
            count: 2,
            resetAt: 1_000,
        });

        expect(await store.consume({
            key: "auth:login:auth:identifier:test:203.0.113.10",
            windowMs: 1_000,
            now: 1_001,
        })).toEqual({
            count: 1,
            resetAt: 2_001,
        });
    });

    it("increments and expires buckets through the shared store adapter", async () => {
        const buckets = new Map<string, { count: number; resetAt: number }>();
        const prismaMock: any = {
            $queryRaw: jest.fn(async (_query: TemplateStringsArray, ...values: unknown[]) => {
                const key = String(values[0]);
                const dateValues = values.filter((value): value is Date => value instanceof Date);
                const current = dateValues.length > 0 ? Math.min(...dateValues.map((value) => value.getTime())) : 0;
                const resetAt = dateValues.length > 0 ? Math.max(...dateValues.map((value) => value.getTime())) : 0;
                const existing = buckets.get(key);

                if (!existing || existing.resetAt <= current) {
                    const next = { count: 1, resetAt };
                    buckets.set(key, next);
                    return [{ count: next.count, resetAt: new Date(next.resetAt) }];
                }

                const next = {
                    count: existing.count + 1,
                    resetAt: existing.resetAt,
                };
                buckets.set(key, next);
                return [{ count: next.count, resetAt: new Date(next.resetAt) }];
            }),
            $executeRaw: jest.fn(async (query: TemplateStringsArray, ...values: unknown[]) => {
                const sql = query.join(" ").replace(/\s+/g, " ").trim().toLowerCase();
                if (sql.includes("where reset_at <=")) {
                    const threshold = values.find((value): value is Date => value instanceof Date)?.getTime() ?? 0;
                    let deleted = 0;
                    for (const [key, bucket] of buckets.entries()) {
                        if (bucket.resetAt <= threshold) {
                            buckets.delete(key);
                            deleted += 1;
                        }
                    }
                    return deleted;
                }

                buckets.clear();
                return 0;
            }),
        };

        const store = createPrismaRateLimitStore(prismaMock);
        expectRateLimitStoreContract(store);

        expect(await store.consume({
            key: "auth:invite:org-1:identifier:abc:203.0.113.20",
            windowMs: 1_000,
            now: 0,
        })).toEqual({
            count: 1,
            resetAt: 1_000,
        });

        expect(await store.consume({
            key: "auth:invite:org-1:identifier:abc:203.0.113.20",
            windowMs: 1_000,
            now: 0,
        })).toEqual({
            count: 2,
            resetAt: 1_000,
        });

        expect(await store.consume({
            key: "auth:invite:org-1:identifier:abc:203.0.113.20",
            windowMs: 1_000,
            now: 1_001,
        })).toEqual({
            count: 1,
            resetAt: 2_001,
        });
    });

    it("shares counters across two store instances backed by the same database", async () => {
        const buckets = new Map<string, { count: number; resetAt: number }>();
        const prismaMock: any = {
            $queryRaw: jest.fn(async (_query: TemplateStringsArray, ...values: unknown[]) => {
                const key = String(values[0]);
                const dateValues = values.filter((value): value is Date => value instanceof Date);
                const current = dateValues.length > 0 ? Math.min(...dateValues.map((value) => value.getTime())) : 0;
                const resetAt = dateValues.length > 0 ? Math.max(...dateValues.map((value) => value.getTime())) : 0;
                const existing = buckets.get(key);

                if (!existing || existing.resetAt <= current) {
                    const next = { count: 1, resetAt };
                    buckets.set(key, next);
                    return [{ count: next.count, resetAt: new Date(next.resetAt) }];
                }

                const next = {
                    count: existing.count + 1,
                    resetAt: existing.resetAt,
                };
                buckets.set(key, next);
                return [{ count: next.count, resetAt: new Date(next.resetAt) }];
            }),
            $executeRaw: jest.fn(async (query: TemplateStringsArray, ...values: unknown[]) => {
                const sql = query.join(" ").replace(/\s+/g, " ").trim().toLowerCase();
                if (sql.includes("where reset_at <=")) {
                    const threshold = values.find((value): value is Date => value instanceof Date)?.getTime() ?? 0;
                    let deleted = 0;
                    for (const [key, bucket] of buckets.entries()) {
                        if (bucket.resetAt <= threshold) {
                            buckets.delete(key);
                            deleted += 1;
                        }
                    }
                    return deleted;
                }

                buckets.clear();
                return 0;
            }),
        };

        const storeA = createPrismaRateLimitStore(prismaMock);
        const storeB = createPrismaRateLimitStore(prismaMock);

        expect(await storeA.consume({
            key: "auth:login:auth:identifier:test:203.0.113.10",
            windowMs: 1_000,
            now: 0,
        })).toEqual({
            count: 1,
            resetAt: 1_000,
        });

        expect(await storeB.consume({
            key: "auth:login:auth:identifier:test:203.0.113.10",
            windowMs: 1_000,
            now: 0,
        })).toEqual({
            count: 2,
            resetAt: 1_000,
        });
    });

    it("cleans up expired buckets", async () => {
        const store = createInMemoryRateLimitStore();

        await store.consume({
            key: "auth:login:auth:identifier:test:203.0.113.10",
            windowMs: 1_000,
            now: 0,
        });

        expect(await store.cleanupExpiredBuckets?.({ now: 1_001 })).toBe(1);
        expect(await store.consume({
            key: "auth:login:auth:identifier:test:203.0.113.10",
            windowMs: 1_000,
            now: 1_001,
        })).toEqual({
            count: 1,
            resetAt: 2_001,
        });
    });

    it("falls back safely when the shared store fails", async () => {
        const fallback = createInMemoryRateLimitStore();
        const shared = {
            consume: jest.fn(async () => {
                throw new Error("database unavailable");
            }),
            clear: jest.fn(async () => undefined),
        } satisfies RateLimitStore;

        const fallbackStore = createFallbackRateLimitStore(shared, fallback, jest.fn());

        await expect(fallbackStore.consume({
            key: "auth:login:auth:identifier:test:203.0.113.10",
            windowMs: 1_000,
            now: 0,
        })).resolves.toEqual({
            count: 1,
            resetAt: 1_000,
        });
    });
});
