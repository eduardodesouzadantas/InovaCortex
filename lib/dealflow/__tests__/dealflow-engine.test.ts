/**
 * lib/dealflow/__tests__/dealflow-engine.test.ts
 * V21: Unit tests for pure dealflow functions (no DB deps).
 */

import { describe, it, expect, vi } from "vitest";
import { classifyTier } from "../dealflow-engine";

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const baseAssessment = {
    scoreTotal: 75,
    urgency: "alta",
    classification: "Alta prioridade",
};

const highRoi = {
    estimatedPaybackMonths: 3,
    confidenceLevel: "Média",
};

const highConfRoi = {
    estimatedPaybackMonths: 6,
    confidenceLevel: "Alta",
};

const fastPaybackRoi = {
    estimatedPaybackMonths: 0.5,
    confidenceLevel: "Baixa",
};

describe("classifyTier", () => {
    it("score >= 80 → hot", () => {
        const { tier } = classifyTier({ ...baseAssessment, scoreTotal: 80 }, highRoi);
        expect(tier).toBe("hot");
    });

    it("score 75 (< 80) with normal payback → warm", () => {
        const { tier } = classifyTier({ ...baseAssessment, scoreTotal: 75 }, highRoi);
        expect(tier).toBe("warm");
    });

    it("confidence Alta → hot regardless of score", () => {
        const { tier } = classifyTier({ ...baseAssessment, scoreTotal: 60 }, highConfRoi);
        expect(tier).toBe("hot");
    });

    it("payback <= 1 month → hot", () => {
        const { tier } = classifyTier({ ...baseAssessment, scoreTotal: 55 }, fastPaybackRoi);
        expect(tier).toBe("hot");
    });

    it("score 50-79 with no hot signals → warm", () => {
        const { tier } = classifyTier({ ...baseAssessment, scoreTotal: 65 }, highRoi);
        expect(tier).toBe("warm");
    });

    it("score < 50 → cold", () => {
        const { tier } = classifyTier({ ...baseAssessment, scoreTotal: 40 }, highRoi);
        expect(tier).toBe("cold");
    });

    it("null roi → uses score alone", () => {
        const { tier: t1 } = classifyTier({ ...baseAssessment, scoreTotal: 85 }, null);
        expect(t1).toBe("hot");
        const { tier: t2 } = classifyTier({ ...baseAssessment, scoreTotal: 40 }, null);
        expect(t2).toBe("cold");
    });

    it("returns a reason string", () => {
        const { reason } = classifyTier({ ...baseAssessment, scoreTotal: 90 }, highRoi);
        expect(typeof reason).toBe("string");
        expect(reason.length).toBeGreaterThan(0);
    });
});
