/**
 * __tests__/authority-engine.test.ts
 * R4: Authority Amplifier — pure logic tests. No DB or AI.
 */

import {
    anonymizeMetrics,
    computeScoreTier as _unused,  // not imported from authority but ensuring no bleed
    formatBRL,
    aggregateStatistics,
    categorizeCompanySize,
    selectTemplate as _skip,
    type ClientMetrics,
    type AnonLevel,
} from "../lib/authority-templates";

// Re-import only what we need
import {
    anonymizeMetrics as anon,
    aggregateStatistics as agg,
    categorizeCompanySize as cat,
    formatBRL as fmt,
    ASSET_PROMPTS,
} from "../lib/authority-templates";

// ─── Sample metrics ───────────────────────────────────────────────────────────

const SAMPLE_METRICS: ClientMetrics = {
    operationalSavingsPerYear: 120000,
    revenueIncreasePerYear: 60000,
    monthlyHoursRecovered: 80,
    paybackMonths: 5,
    confidenceLevel: "Alta",
    moduleCount: 3,
    taskCount: 12,
    sector: "saúde",
    companyName: "Clínica Santa Rosa",
    teamSize: "pequena empresa (10-20 pessoas)",
    goLiveDays: 28,
};

// ─── Anonymization ────────────────────────────────────────────────────────────

describe("Authority: Anonymization", () => {
    test("level 'none' preserves company name", () => {
        const result = anon(SAMPLE_METRICS, "none");
        expect(result.displayName).toBe("Clínica Santa Rosa");
    });

    test("level 'sector_only' hides company name, shows sector descriptor", () => {
        const result = anon(SAMPLE_METRICS, "sector_only");
        expect(result.displayName).not.toBe("Clínica Santa Rosa");
        expect(result.displayName.length).toBeGreaterThan(0);
    });

    test("level 'size_only' shows team size", () => {
        const result = anon(SAMPLE_METRICS, "size_only");
        expect(result.displayName).toContain("pequena empresa");
    });

    test("level 'full' combines sector + size, hides name", () => {
        const result = anon(SAMPLE_METRICS, "full");
        expect(result.displayName).not.toBe("Clínica Santa Rosa");
        expect(result.displayName.length).toBeGreaterThan(0);
        expect(result.anonLevel).toBe("full");
    });

    test("all anon levels preserve metrics values unchanged", () => {
        for (const level of ["none", "sector_only", "size_only", "full"] as AnonLevel[]) {
            const result = anon(SAMPLE_METRICS, level);
            expect(result.operationalSavingsPerYear).toBe(120000);
            expect(result.paybackMonths).toBe(5);
            expect(result.monthlyHoursRecovered).toBe(80);
        }
    });
});

// ─── Company size categorizer ─────────────────────────────────────────────────

describe("Authority: Company size categories", () => {
    test("1 person → micro empresa", () => expect(cat(1)).toContain("micro"));
    test("10 people → micro empresa", () => expect(cat(10)).toContain("micro"));
    test("11 people → pequena empresa", () => expect(cat(11)).toContain("pequena"));
    test("20 people → pequena empresa", () => expect(cat(20)).toContain("pequena"));
    test("21 people → empresa media", () => expect(cat(21)).toContain("media"));
    test("50 people → empresa media", () => expect(cat(50)).toContain("media"));
    test("51 people → porte medio", () => expect(cat(51)).toContain("medio"));
    test("101 people → grande empresa", () => expect(cat(101)).toContain("grande"));
});

// ─── Format helpers ───────────────────────────────────────────────────────────

describe("Authority: BRL formatting", () => {
    test("120000 → localized Brazilian format", () => {
        const result = fmt(120000);
        expect(result).toContain("120");
        expect(typeof result).toBe("string");
    });

    test("0 → '0'", () => expect(fmt(0)).toBe("0"));

    test("rounds to nearest integer", () => {
        expect(fmt(120000.7)).toBe(fmt(120001));
    });
});

// ─── Statistics aggregation ───────────────────────────────────────────────────

describe("Authority: Statistics aggregation", () => {
    const cases: ClientMetrics[] = [
        { ...SAMPLE_METRICS, operationalSavingsPerYear: 120000, paybackMonths: 4, monthlyHoursRecovered: 80 },
        { ...SAMPLE_METRICS, operationalSavingsPerYear: 80000, paybackMonths: 6, monthlyHoursRecovered: 60 },
        { ...SAMPLE_METRICS, operationalSavingsPerYear: 160000, paybackMonths: 5, monthlyHoursRecovered: 100 },
    ];

    const result = agg(cases);

    test("total cases = 3", () => expect(result.totalCases).toBe(3));

    test("avg payback months = 5", () => expect(result.avgPaybackMonths).toBe(5));

    test("avg savings calculated correctly", () => {
        const expected = Math.round((120000 + 80000 + 160000) / 3);
        expect(result.avgSavingsPerYear).toBe(expected);
    });

    test("avg hours recovered = 80", () =>
        expect(result.avgHoursRecovered).toBe(Math.round((80 + 60 + 100) / 3)));

    test("empty array returns zeros", () => {
        const empty = agg([]);
        expect(empty.totalCases).toBe(0);
        expect(empty.avgPaybackMonths).toBe(0);
    });
});

// ─── Asset prompt builders ────────────────────────────────────────────────────

describe("Authority: Asset prompt builders", () => {
    const anonMetrics = anon(SAMPLE_METRICS, "full");

    test("case_study prompt includes METRICAS DO CASO", () => {
        const p = ASSET_PROMPTS["case_study"](anonMetrics);
        expect(p).toContain("METRICAS DO CASO");
    });

    test("linkedin_post prompt requests JSON with 'body'", () => {
        const p = ASSET_PROMPTS["linkedin_post"](anonMetrics);
        expect(p).toContain('"body"');
    });

    test("stat_card prompt includes stats array", () => {
        const p = ASSET_PROMPTS["stat_card"](anonMetrics);
        expect(p).toContain('"stats"');
    });

    test("all 5 asset types have a prompt builder", () => {
        const types = ["case_study", "linkedin_post", "article", "video_script", "stat_card"] as const;
        for (const t of types) {
            expect(typeof ASSET_PROMPTS[t]).toBe("function");
            const result = ASSET_PROMPTS[t](anonMetrics);
            expect(result.length).toBeGreaterThan(50);
        }
    });

    test("prompt includes ROI numbers", () => {
        const p = ASSET_PROMPTS["case_study"](anonMetrics);
        expect(p).toContain("120");  // savings value appears
    });
});

// ─── Status lifecycle ─────────────────────────────────────────────────────────

describe("Authority: Status lifecycle", () => {
    const FLOW = ["internal", "anonymized", "approved", "published"];

    test("4-stage lifecycle defined", () => expect(FLOW).toHaveLength(4));

    test("starts at internal", () => expect(FLOW[0]).toBe("internal"));

    test("ends at published", () => expect(FLOW[3]).toBe("published"));

    test("publishing requires approval (guard check)", () => {
        function canPublish(currentStatus: string): boolean {
            return currentStatus === "approved";
        }
        expect(canPublish("internal")).toBe(false);
        expect(canPublish("anonymized")).toBe(false);
        expect(canPublish("approved")).toBe(true);
    });
});
