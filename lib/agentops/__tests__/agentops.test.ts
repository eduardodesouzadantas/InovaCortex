/**
 * lib/agentops/__tests__/agentops.test.ts
 * V20.1: Unit tests for Registry, Budget error, and Cache key logic.
 *
 * Imports ONLY pure/zero-dep modules:
 *   - registry.ts (no external imports)
 *   - cache-key.ts (only Node crypto)
 *   - budget-error.ts (no imports)
 */

import { describe, it, expect } from "vitest";
import { registerAgent, getAgent, getAllAgents, hasAgent } from "../registry";
import { makeCacheKey } from "../cache-key";
import { BudgetExceededError } from "../budget-error";

// ─── Registry ─────────────────────────────────────────────────────────────────

describe("AgentOps Registry", () => {
    it("registers and retrieves an agent", () => {
        const handler = async () => ({ ok: true });
        registerAgent("RA_get", handler, { model: "gemini-2.0-flash", maxTokens: 512 });
        const agent = getAgent("RA_get");
        expect(agent).toBeDefined();
        expect(agent!.name).toBe("RA_get");
        expect(agent!.defaults.model).toBe("gemini-2.0-flash");
        expect(agent!.defaults.maxTokens).toBe(512);
        expect(agent!.defaults.cacheEnabled).toBe(true);
        expect(agent!.defaults.fallbackToTemplate).toBe(true);
    });

    it("fills missing defaults", () => {
        registerAgent("RA_defaults", async () => null, {});
        const agent = getAgent("RA_defaults")!;
        expect(agent.defaults.model).toBe("gemini-2.0-flash");
        expect(agent.defaults.maxTokens).toBe(2048);
        expect(agent.defaults.temperature).toBe(0.3);
    });

    it("overwrites an existing agent (last-write-wins)", () => {
        registerAgent("RA_dup", async () => "v1", { model: "model-a", maxTokens: 100 });
        registerAgent("RA_dup", async () => "v2", { model: "model-b", maxTokens: 200 });
        expect(getAgent("RA_dup")!.defaults.model).toBe("model-b");
    });

    it("hasAgent returns false for unknown name", () => {
        expect(hasAgent("NonExistent_xyz_99999")).toBe(false);
    });

    it("hasAgent returns true after register", () => {
        registerAgent("RA_has", async () => null, {});
        expect(hasAgent("RA_has")).toBe(true);
    });

    it("getAllAgents contains registered entries", () => {
        registerAgent("RA_all_X", async () => null, {});
        registerAgent("RA_all_Y", async () => null, {});
        const names = getAllAgents().map(a => a.name);
        expect(names).toContain("RA_all_X");
        expect(names).toContain("RA_all_Y");
    });
});

// ─── Cache key (pure crypto) ──────────────────────────────────────────────────

describe("AgentOps Cache — makeCacheKey", () => {
    it("returns stable keyHash regardless of object key order", () => {
        const { keyHash: h1 } = makeCacheKey("A", "m1", { x: 1, y: 2 });
        const { keyHash: h2 } = makeCacheKey("A", "m1", { y: 2, x: 1 });
        expect(h1).toBe(h2);
    });

    it("returns different keyHash for different agent names", () => {
        const { keyHash: h1 } = makeCacheKey("Agent1", "m1", {});
        const { keyHash: h2 } = makeCacheKey("Agent2", "m1", {});
        expect(h1).not.toBe(h2);
    });

    it("returns different keyHash for different models", () => {
        const { keyHash: h1 } = makeCacheKey("A", "model-a", {});
        const { keyHash: h2 } = makeCacheKey("A", "model-b", {});
        expect(h1).not.toBe(h2);
    });

    it("returns different keyHash for different inputs", () => {
        const { keyHash: h1 } = makeCacheKey("A", "m", { q: "hello" });
        const { keyHash: h2 } = makeCacheKey("A", "m", { q: "world" });
        expect(h1).not.toBe(h2);
    });

    it("keyHash and inputHash are 64-char hex strings", () => {
        const { keyHash, inputHash } = makeCacheKey("X", "Y", { data: "hello" });
        expect(keyHash).toMatch(/^[0-9a-f]{64}$/);
        expect(inputHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("is fully deterministic on repeated calls", () => {
        const r1 = makeCacheKey("Calc", "gemini-2.0-flash", { prompt: "hello", temp: 0.3 });
        const r2 = makeCacheKey("Calc", "gemini-2.0-flash", { prompt: "hello", temp: 0.3 });
        expect(r1.keyHash).toBe(r2.keyHash);
        expect(r1.inputHash).toBe(r2.inputHash);
    });
});

// ─── BudgetExceededError ──────────────────────────────────────────────────────

describe("AgentOps Budget — BudgetExceededError", () => {
    it("constructs with correct fields", () => {
        const err = new BudgetExceededError("org-1", 18000, 20000);
        expect(err).toBeInstanceOf(BudgetExceededError);
        expect(err).toBeInstanceOf(Error);
        expect(err.orgId).toBe("org-1");
        expect(err.used).toBe(18000);
        expect(err.limit).toBe(20000);
        expect(err.name).toBe("BudgetExceededError");
        expect(err.message).toContain("org-1");
        expect(err.message).toContain("18000/20000");
    });

    it("is catchable as a generic Error", () => {
        expect(() => { throw new BudgetExceededError("x", 1, 2); }).toThrow(Error);
        expect(() => { throw new BudgetExceededError("x", 1, 2); }).toThrow(BudgetExceededError);
    });
});
