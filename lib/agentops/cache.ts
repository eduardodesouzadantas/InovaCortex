/**
 * lib/agentops/cache.ts
 * V20.1: LLM Output Cache — dedup identical agent calls by input hash.
 *
 * Flow:
 *   1. makeCacheKey(agentName, model, input) → keyHash (sha256)
 *   2. getCached(orgId, keyHash)             → AgentCache | null
 *   3. (if null) call LLM
 *   4. setCached(orgId, keyHash, ...)        → persists result
 *
 * Cache is per-org to avoid data leakage between organizations.
 * No TTL by default — entries are permanent (cheap to store, immutable).
 * Pass maxAgeMs to getCached for time-bounded lookups.
 *
 * Usage:
 *   const keyHash = makeCacheKey("ROIAgent", "gemini-2.0-flash", inputObj);
 *   const hit = await getCached(orgId, keyHash);
 *   if (hit) return JSON.parse(hit.outputJson);
 *   const result = await callLLM(inputObj);
 *   await setCached(orgId, keyHash, { agentName, model, input: inputObj, output: result, tokensUsed, costUsd });
 */

import crypto from "crypto";
import { logger } from "@/lib/logger";


// ─── Types ────────────────────────────────────────────────────────────────────

export interface CacheSetOptions {
    agentName: string;
    model: string;
    inputObj: unknown;
    outputObj: unknown;
    tokensUsed?: number;
    costUsd?: number;
}

export interface CacheHit {
    id: string;
    outputJson: string;
    tokensUsed: number;
    costUsd: number;
    createdAt: Date;
    /** Convenience: parsed output */
    output: unknown;
}

// ─── Key Generation ───────────────────────────────────────────────────────────

/**
 * Generate a deterministic cache key from agent name, model, and input.
 * Keys are stable across restarts (SHA-256 of sorted, normalised JSON).
 */
export function makeCacheKey(
    agentName: string,
    model: string,
    input: unknown,
): { keyHash: string; inputHash: string } {
    const inputJson = stableJson(input);
    const keySource = `${agentName}::${model}::${inputJson}`;
    const keyHash = sha256(keySource);
    const inputHash = sha256(inputJson);
    return { keyHash, inputHash };
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Look up a cached result. Returns null on miss.
 * @param maxAgeMs optional: reject entries older than this many ms
 */
export async function getCached(
    orgId: string,
    keyHash: string,
    maxAgeMs?: number,
): Promise<CacheHit | null> {
    const { prisma } = await import("@/lib/prisma");
    const entry = await (prisma as any).agentCache.findUnique({
        where: { orgId_keyHash: { orgId, keyHash } },
    }).catch(() => null);

    if (!entry) return null;

    if (maxAgeMs !== undefined) {
        const age = Date.now() - new Date(entry.createdAt).getTime();
        if (age > maxAgeMs) {
            logger.info("AgentCache: stale entry ignored", { orgId, keyHash, ageMs: age, maxAgeMs });
            return null;
        }
    }

    logger.info("AgentCache HIT", { orgId, keyHash, agentName: entry.agentName, tokensUsed: entry.tokensUsed });

    let output: unknown;
    try { output = JSON.parse(entry.outputJson); } catch { output = entry.outputJson; }

    return {
        id: entry.id,
        outputJson: entry.outputJson,
        tokensUsed: entry.tokensUsed,
        costUsd: entry.costUsd,
        createdAt: entry.createdAt,
        output,
    };
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Persist a cache entry. Upserts so concurrent writes are safe.
 */
export async function setCached(
    orgId: string,
    keyHash: string,
    opts: CacheSetOptions,
): Promise<void> {
    const { prisma } = await import("@/lib/prisma");
    const { agentName, model, inputObj, outputObj, tokensUsed = 0, costUsd = 0 } = opts;
    const { inputHash } = makeCacheKey(agentName, model, inputObj);
    const outputJson = JSON.stringify(outputObj);

    await (prisma as any).agentCache.upsert({
        where: { orgId_keyHash: { orgId, keyHash } },
        create: {
            orgId,
            keyHash,
            agentName,
            model,
            inputHash,
            outputJson,
            tokensUsed,
            costUsd,
        },
        update: {
            outputJson,
            tokensUsed,
            costUsd,
        },
    });

    logger.info("AgentCache SET", { orgId, keyHash, agentName, tokensUsed, costUsd });
}

// ─── Invalidation ─────────────────────────────────────────────────────────────

/**
 * Delete all cache entries for an org (emergency purge / org deletion).
 */
export async function invalidateCacheForOrg(orgId: string): Promise<number> {
    const { prisma } = await import("@/lib/prisma");
    const { count } = await (prisma as any).agentCache.deleteMany({ where: { orgId } });
    logger.info("AgentCache invalidated", { orgId, deleted: count });
    return count;
}

/**
 * Delete all entries for a specific agent name across an org.
 */
export async function invalidateCacheForAgent(orgId: string, agentName: string): Promise<number> {
    const { prisma } = await import("@/lib/prisma");
    const { count } = await (prisma as any).agentCache.deleteMany({ where: { orgId, agentName } });
    logger.info("AgentCache invalidated for agent", { orgId, agentName, deleted: count });
    return count;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sha256(input: string): string {
    return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/** JSON.stringify with sorted keys for stable hashing. */
function stableJson(val: unknown): string {
    return JSON.stringify(val, (_k, v) =>
        v !== null && typeof v === "object" && !Array.isArray(v)
            ? Object.fromEntries(Object.entries(v).sort())
            : v,
    );
}
