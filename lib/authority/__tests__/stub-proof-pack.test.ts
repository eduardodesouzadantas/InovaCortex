/**
 * lib/authority/__tests__/stub-proof-pack.test.ts
 * V21: Unit tests for the stub-proof-pack pure functions.
 * Zero deps — vitest-safe.
 */

import { describe, it, expect } from "vitest";
import { buildStubProofPack, buildAnonLabel, formatBRL, type ProofMetrics } from "../stub-proof-pack";

const metrics: ProofMetrics = {
    sector: "clínica estética",
    teamSizeLabel: "10-20 pessoas",
    monthlyEconomy: 8500,
    monthlyRevenue: 4200,
    hoursSaved: 45,
    paybackMonths: 6,
    diasGoLive: 28,
    modules: ["Atendimento IA", "CRM Automatizado", "Agendamento"],
    anonLabel: "clínica estética com 10-20 pessoas",
};

describe("buildStubProofPack", () => {
    const pack = buildStubProofPack(metrics);

    it("returns case_study_md, linkedin_post, stat_card", () => {
        expect(pack).toHaveProperty("case_study_md");
        expect(pack).toHaveProperty("linkedin_post");
        expect(pack).toHaveProperty("stat_card");
    });

    describe("case_study_md", () => {
        it("contains real metrics (no invented numbers)", () => {
            expect(pack.case_study_md).toContain("28 dias");
            expect(pack.case_study_md).toContain("6 meses");
        });

        it("contains module names", () => {
            expect(pack.case_study_md).toContain("Atendimento IA");
        });

        it("is markdown (contains # header)", () => {
            expect(pack.case_study_md).toMatch(/^#\s/);
        });

        it("has a results table", () => {
            expect(pack.case_study_md).toContain("| Métrica");
        });
    });

    describe("linkedin_post", () => {
        it("contains real dias go-live", () => {
            expect(pack.linkedin_post).toContain("28 dias");
        });

        it("contains formatted economy", () => {
            expect(pack.linkedin_post).toMatch(/R\$\s*8[,.]?5k|8\.?500/);
        });

        it("has hashtags", () => {
            expect(pack.linkedin_post).toContain("#");
        });

        it("is 100+ chars", () => {
            expect(pack.linkedin_post.length).toBeGreaterThan(100);
        });
    });

    describe("stat_card", () => {
        it("has 3-5 items", () => {
            expect(pack.stat_card.length).toBeGreaterThanOrEqual(3);
            expect(pack.stat_card.length).toBeLessThanOrEqual(5);
        });

        it("all items are non-empty strings", () => {
            for (const s of pack.stat_card) {
                expect(typeof s).toBe("string");
                expect(s.length).toBeGreaterThan(0);
            }
        });

        it("contains dias go-live stat", () => {
            expect(pack.stat_card.some(s => s.includes("28 dias"))).toBe(true);
        });
    });

    it("is deterministic", () => {
        const p2 = buildStubProofPack(metrics);
        expect(p2).toEqual(pack);
    });
});

describe("buildAnonLabel", () => {
    const s = "clínica estética";
    const t = "10-20 pessoas";

    it("full → 'sector com size'", () => {
        expect(buildAnonLabel(s, t, "full")).toBe("clínica estética com 10-20 pessoas");
    });

    it("sector_only → sector only", () => {
        expect(buildAnonLabel(s, t, "sector_only")).toBe(s);
    });

    it("size_only → 'empresa com size'", () => {
        expect(buildAnonLabel(s, t, "size_only")).toBe("empresa com 10-20 pessoas");
    });

    it("none with realName → realName", () => {
        expect(buildAnonLabel(s, t, "none", "Clínica Bella")).toBe("Clínica Bella");
    });

    it("none without realName → falls back to full", () => {
        expect(buildAnonLabel(s, t, "none")).toBe("clínica estética com 10-20 pessoas");
    });
});

describe("formatBRL", () => {
    it("formats values < 1000 as R$ XXX", () => {
        expect(formatBRL(500)).toBe("R$ 500");
    });

    it("formats values >= 1000 as R$ Xk", () => {
        expect(formatBRL(8500)).toBe("R$ 8,5k");
    });

    it("formats exactly 1000 as R$ 1,0k", () => {
        expect(formatBRL(1000)).toBe("R$ 1,0k");
    });
});
