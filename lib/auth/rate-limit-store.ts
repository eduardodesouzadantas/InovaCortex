import { logger } from "@/lib/logger";

export interface RateLimitSnapshot {
    count: number;
    resetAt: number;
}

export interface RateLimitConsumeInput {
    key: string;
    windowMs: number;
    now?: number;
}

export interface RateLimitStore {
    consume(input: RateLimitConsumeInput): Promise<RateLimitSnapshot>;
    clear(): Promise<void>;
    cleanupExpiredBuckets?(input?: { now?: number }): Promise<number>;
}

type PrismaLikeClient = {
    $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
    $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

type StoredRateLimitRow = {
    count: number;
    resetAt: Date;
};

function toSnapshot(row: StoredRateLimitRow): RateLimitSnapshot {
    return {
        count: Number(row.count),
        resetAt: row.resetAt.getTime(),
    };
}

export class InMemoryRateLimitStore implements RateLimitStore {
    private readonly buckets = new Map<string, RateLimitSnapshot>();

    async consume(input: RateLimitConsumeInput): Promise<RateLimitSnapshot> {
        const now = input.now ?? Date.now();
        const existing = this.buckets.get(input.key);

        if (!existing || existing.resetAt <= now) {
            const fresh = {
                count: 1,
                resetAt: now + input.windowMs,
            };
            this.buckets.set(input.key, fresh);
            return fresh;
        }

        const next = {
            count: existing.count + 1,
            resetAt: existing.resetAt,
        };
        this.buckets.set(input.key, next);
        return next;
    }

    async clear(): Promise<void> {
        this.buckets.clear();
    }

    async cleanupExpiredBuckets(input: { now?: number } = {}): Promise<number> {
        const now = input.now ?? Date.now();
        let deleted = 0;

        for (const [key, bucket] of this.buckets.entries()) {
            if (bucket.resetAt <= now) {
                this.buckets.delete(key);
                deleted += 1;
            }
        }

        return deleted;
    }
}

export class PrismaRateLimitStore implements RateLimitStore {
    constructor(private readonly prisma: PrismaLikeClient) {}

    private lastCleanupAt = 0;
    private readonly cleanupIntervalMs = 15 * 60 * 1000;

    private async maybeCleanupExpiredBuckets(now: number): Promise<void> {
        if (this.lastCleanupAt && now - this.lastCleanupAt < this.cleanupIntervalMs) {
            return;
        }

        this.lastCleanupAt = now;
        try {
            await this.cleanupExpiredBuckets({ now });
        } catch (error) {
            logger.warn("Auth rate limit bucket cleanup failed", {
                operation: "auth_rate_limit_cleanup",
                result: "ignored",
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    async consume(input: RateLimitConsumeInput): Promise<RateLimitSnapshot> {
        const now = input.now ?? Date.now();
        const current = new Date(now);
        const resetAt = new Date(now + input.windowMs);

        await this.maybeCleanupExpiredBuckets(now);

        const rows = await this.prisma.$queryRaw<StoredRateLimitRow[]>`
            INSERT INTO auth_rate_limit_buckets (bucket_key, count, reset_at, created_at, updated_at)
            VALUES (${input.key}, 1, ${resetAt}, ${current}, ${current})
            ON CONFLICT (bucket_key)
            DO UPDATE SET
                count = CASE
                    WHEN auth_rate_limit_buckets.reset_at <= ${current} THEN 1
                    ELSE auth_rate_limit_buckets.count + 1
                END,
                reset_at = CASE
                    WHEN auth_rate_limit_buckets.reset_at <= ${current} THEN ${resetAt}
                    ELSE auth_rate_limit_buckets.reset_at
                END,
                updated_at = ${current}
            RETURNING count, reset_at AS "resetAt"
        `;

        const row = rows[0];
        if (!row) {
            throw new Error("Failed to persist auth rate limit bucket.");
        }

        return toSnapshot(row);
    }

    async clear(): Promise<void> {
        await this.prisma.$executeRaw`
            DELETE FROM auth_rate_limit_buckets
        `;
    }

    async cleanupExpiredBuckets(input: { now?: number } = {}): Promise<number> {
        const now = new Date(input.now ?? Date.now());
        const deleted = await this.prisma.$executeRaw`
            DELETE FROM auth_rate_limit_buckets
            WHERE reset_at <= ${now}
        `;
        return Number(deleted ?? 0);
    }
}

export function createInMemoryRateLimitStore(): InMemoryRateLimitStore {
    return new InMemoryRateLimitStore();
}

export function createPrismaRateLimitStore(prisma: PrismaLikeClient): PrismaRateLimitStore {
    return new PrismaRateLimitStore(prisma);
}

export function createFallbackRateLimitStore(
    primary: RateLimitStore,
    fallback: RateLimitStore,
    onPrimaryError?: (error: unknown, input: RateLimitConsumeInput) => void,
): RateLimitStore {
    return {
        async consume(input: RateLimitConsumeInput): Promise<RateLimitSnapshot> {
            try {
                return await primary.consume(input);
            } catch (error) {
                onPrimaryError?.(error, input);
                return fallback.consume(input);
            }
        },
        async clear(): Promise<void> {
            await Promise.all([
                primary.clear().catch(() => undefined),
                fallback.clear().catch(() => undefined),
            ]);
        },
        async cleanupExpiredBuckets(input: { now?: number } = {}): Promise<number> {
            const primaryDeleted = primary.cleanupExpiredBuckets
                ? await primary.cleanupExpiredBuckets(input).catch(() => 0)
                : 0;
            const fallbackDeleted = fallback.cleanupExpiredBuckets
                ? await fallback.cleanupExpiredBuckets(input).catch(() => 0)
                : 0;
            return primaryDeleted + fallbackDeleted;
        },
    };
}
