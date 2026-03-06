/**
 * lib/agentops/cache-key.ts
 * V20.1: Pure SHA-256 cache key generation — ZERO external imports.
 * Importable directly in vitest without path alias resolution issues.
 *
 * Exported from cache.ts for convenience, but kept separate for testability.
 */

import crypto from "crypto";

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

/** JSON.stringify with sorted keys for stable hashing. */
export function stableJson(val: unknown): string {
    return JSON.stringify(val, (_k, v) =>
        v !== null && typeof v === "object" && !Array.isArray(v)
            ? Object.fromEntries(Object.entries(v).sort())
            : v,
    );
}

function sha256(input: string): string {
    return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}
