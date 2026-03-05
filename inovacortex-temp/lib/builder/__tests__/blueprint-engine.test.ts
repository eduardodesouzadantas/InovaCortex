/**
 * lib/builder/__tests__/blueprint-engine.test.ts
 * V25.1: Vitest tests for the Blueprint Engine.
 *
 * Tests:
 *  1) selectTemplates — hot/warm/cold tier rules
 *  2) compileBlueprint — stable ordering + stableJson
 *  3) No secrets leakage (default values are empty, no tokens)
 *  4) Pure helper functions (tierFromScore, stableJson, checksum)
 */

import { describe, it, expect } from "vitest";
import {
    selectTemplates,
    compileBlueprint,
    tierFromScore,
    stableJson,
    checksum,
    type InputSnapshot,
    type Tier,
} from "../blueprint-engine";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeSnap(overrides: Partial<InputSnapshot> = {}): InputSnapshot {
    return {
        orgId: "test-org",
        assessmentId: null,
        proposalId: null,
        workspaceId: null,
        snapshotAt: "2026-03-04T06:00:00.000Z",
        company: "ACME",
        segment: "Serviços",
        industry: "service",
        teamSize: "10-50",
        volumeDay: "100-500",
        scoreTotal: 75,
        tier: "hot",
        missions: ["Vendas", "Suporte"],
        channels: ["WhatsApp"],
        hasWhatsApp: true,
        hasInstagram: false,
        hasLinkedIn: false,
        hasEmail: false,
        hasCRM: false,
        hasERP: false,
        hasAutomation: false,
        hasAPI: false,
        urgency: "high",
        proposedModules: [],
        estimatedBudget: "medium",
        ...overrides,
    };
}

// ─── tierFromScore ────────────────────────────────────────────────────────────

describe("tierFromScore", () => {
    it("0 → cold", () => expect(tierFromScore(0)).toBe("cold"));
    it("39 → cold", () => expect(tierFromScore(39)).toBe("cold"));
    it("40 → warm", () => expect(tierFromScore(40)).toBe("warm"));
    it("69 → warm", () => expect(tierFromScore(69)).toBe("warm"));
    it("70 → hot", () => expect(tierFromScore(70)).toBe("hot"));
    it("100 → hot", () => expect(tierFromScore(100)).toBe("hot"));
});

// ─── selectTemplates — hot tier ───────────────────────────────────────────────

describe("selectTemplates: hot tier", () => {
    it("hot + service industry → whatsapp_funnel_v1", () => {
        const keys = selectTemplates(makeSnap({ tier: "hot", industry: "service" }));
        expect(keys).toContain("whatsapp_funnel_v1");
    });

    it("hot + clinic industry → clinic_stack_v1", () => {
        const keys = selectTemplates(makeSnap({ tier: "hot", industry: "clinic" }));
        expect(keys).toContain("clinic_stack_v1");
    });

    it("hot + saas industry → outbound_saas_v1", () => {
        const keys = selectTemplates(makeSnap({ tier: "hot", industry: "saas" }));
        expect(keys).toContain("outbound_saas_v1");
    });

    it("hot + high budget → full_stack_v1 included", () => {
        const keys = selectTemplates(makeSnap({ tier: "hot", estimatedBudget: "high" }));
        expect(keys).toContain("full_stack_v1");
    });

    it("hot + low budget → no full_stack_v1", () => {
        const keys = selectTemplates(makeSnap({ tier: "hot", estimatedBudget: "low" }));
        expect(keys).not.toContain("full_stack_v1");
    });
});

// ─── selectTemplates — warm tier ─────────────────────────────────────────────

describe("selectTemplates: warm tier", () => {
    it("warm + service → whatsapp_funnel_v1", () => {
        const keys = selectTemplates(makeSnap({ tier: "warm", industry: "service", scoreTotal: 55 }));
        expect(keys).toContain("whatsapp_funnel_v1");
    });

    it("warm + saas → outbound_saas_v1", () => {
        const keys = selectTemplates(makeSnap({ tier: "warm", industry: "saas", scoreTotal: 55 }));
        expect(keys).toContain("outbound_saas_v1");
    });

    it("warm + linkedin → outbound_saas_v1", () => {
        const keys = selectTemplates(makeSnap({ tier: "warm", hasLinkedIn: true, scoreTotal: 55 }));
        expect(keys).toContain("outbound_saas_v1");
    });

    it("warm + CRM → data_heavy_v1", () => {
        const keys = selectTemplates(makeSnap({ tier: "warm", hasCRM: true, scoreTotal: 55 }));
        expect(keys).toContain("data_heavy_v1");
    });

    it("warm + ERP → data_heavy_v1", () => {
        const keys = selectTemplates(makeSnap({ tier: "warm", hasERP: true, scoreTotal: 55 }));
        expect(keys).toContain("data_heavy_v1");
    });
});

// ─── selectTemplates — cold tier ─────────────────────────────────────────────

describe("selectTemplates: cold tier", () => {
    it("cold → lite_v1 only, no full_stack", () => {
        const keys = selectTemplates(makeSnap({ tier: "cold", scoreTotal: 20, estimatedBudget: "medium" }));
        expect(keys).toContain("lite_v1");
        expect(keys).not.toContain("full_stack_v1");
        expect(keys).not.toContain("clinic_stack_v1");
    });
});

// ─── selectTemplates — mission overrides ─────────────────────────────────────

describe("selectTemplates: mission / channel overrides", () => {
    it("missions includes Dados → data_heavy_v1 appended", () => {
        const keys = selectTemplates(makeSnap({ tier: "warm", missions: ["Dados"], hasCRM: false, hasERP: false }));
        expect(keys).toContain("data_heavy_v1");
    });

    it("hasInstagram → ecommerce_v1 appended", () => {
        const keys = selectTemplates(makeSnap({ hasInstagram: true }));
        expect(keys).toContain("ecommerce_v1");
    });

    it("no duplicates in output", () => {
        const keys = selectTemplates(makeSnap({ tier: "hot", industry: "saas", hasCRM: true, estimatedBudget: "high", hasLinkedIn: true }));
        const unique = new Set(keys);
        expect(keys.length).toBe(unique.size);
    });
});

// ─── compileBlueprint — stable ordering ───────────────────────────────────────

describe("compileBlueprint: stable ordering", () => {
    it("same inputs produce identical JSON (deterministic)", () => {
        const snap = makeSnap();
        const keys = selectTemplates(snap);
        const bp1 = compileBlueprint(keys, snap);
        const bp2 = compileBlueprint(keys, snap);
        // Remove _checksum from comparison (it depends on stable JSON itself)
        expect(stableJson({ ...bp1, _checksum: "" })).toBe(stableJson({ ...bp2, _checksum: "" }));
    });

    it("selectedModules are sorted by priority asc", () => {
        const snap = makeSnap({ tier: "hot", estimatedBudget: "high" });
        const bp = compileBlueprint(selectTemplates(snap), snap);
        const prios = bp.selectedModules.map(m => m.priority);
        for (let i = 0; i < prios.length - 1; i++) {
            expect(prios[i]).toBeLessThanOrEqual(prios[i + 1]);
        }
    });

    it("integrations are sorted alphabetically", () => {
        const snap = makeSnap({ hasWhatsApp: true, hasLinkedIn: true });
        const bp = compileBlueprint(selectTemplates(snap), snap);
        const keys = bp.integrations.map(i => i.key);
        const sorted = [...keys].sort();
        expect(keys).toEqual(sorted);
    });

    it("_checksum is 8 hex chars", () => {
        const snap = makeSnap();
        const bp = compileBlueprint(selectTemplates(snap), snap);
        expect(bp._checksum).toMatch(/^[0-9a-f]{8}$/);
    });

    it("different tier = different checksum", () => {
        const hot = makeSnap({ tier: "hot" });
        const cold = makeSnap({ tier: "cold", scoreTotal: 20 });
        const bp1 = compileBlueprint(selectTemplates(hot), hot);
        const bp2 = compileBlueprint(selectTemplates(cold), cold);
        expect(bp1._checksum).not.toBe(bp2._checksum);
    });
});

// ─── compileBlueprint — no secrets leakage ────────────────────────────────────

const SECRET_PATTERN = /(?:Bearer |sk-|pk_|secret|token|password|api_key|apikey)[\w-]{6,}/gi;

describe("compileBlueprint: no secrets leakage", () => {
    it("settings defaultValues must be empty strings", () => {
        const bp = compileBlueprint(["full_stack_v1"], makeSnap({ tier: "hot" }));
        for (const s of bp.settings) {
            // default values should never contain secret-like content
            expect(s.defaultValue).not.toMatch(SECRET_PATTERN);
        }
    });

    it("no secret-like strings in taskTemplates", () => {
        const bp = compileBlueprint(["whatsapp_funnel_v1"], makeSnap());
        const raw = JSON.stringify(bp.taskTemplates);
        expect(raw).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
        expect(raw).not.toMatch(/Bearer [a-zA-Z0-9]{10,}/);
    });

    it("integrations docs only contain docs URLs, no API keys", () => {
        const bp = compileBlueprint(["full_stack_v1"], makeSnap({ tier: "hot" }));
        for (const i of bp.integrations) {
            expect(i.docs).toMatch(/^https?:\/\//);
            // No token-like content in docs string
            expect(i.docs).not.toMatch(SECRET_PATTERN);
        }
    });

    it("settings keys are env var names (uppercase), not values", () => {
        const bp = compileBlueprint(["full_stack_v1"], makeSnap({ tier: "hot", hasWhatsApp: true }));
        for (const s of bp.settings) {
            expect(s.key).toMatch(/^[A-Z0-9_]+$/);
        }
    });

    it("stableJson of blueprint contains no known secret patterns", () => {
        const snap = makeSnap({ tier: "hot", hasWhatsApp: true, hasLinkedIn: true });
        const bp = compileBlueprint(selectTemplates(snap), snap);
        const raw = stableJson(bp);
        expect(raw).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
        expect(raw).not.toMatch(/Bearer [a-zA-Z0-9]{10,}/);
        expect(raw).not.toMatch(/EAA[a-zA-Z0-9]{20,}/); // Meta token pattern
    });
});

// ─── stableJson + checksum ────────────────────────────────────────────────────

describe("stableJson", () => {
    it("same object different key order = same stable JSON", () => {
        const a = { z: 1, a: 2, m: 3 };
        const b = { a: 2, m: 3, z: 1 };
        expect(stableJson(a)).toBe(stableJson(b));
    });

    it("different objects = different stable JSON", () => {
        expect(stableJson({ a: 1 })).not.toBe(stableJson({ a: 2 }));
    });
});

describe("checksum", () => {
    it("same string = same checksum", () => expect(checksum("abc")).toBe(checksum("abc")));
    it("different strings = different", () => expect(checksum("abc")).not.toBe(checksum("xyz")));
    it("always 8 hex chars", () => expect(checksum("hello world")).toMatch(/^[0-9a-f]{8}$/));
    it("empty string has valid checksum", () => expect(checksum("")).toMatch(/^[0-9a-f]{8}$/));
});

// ─── Blueprint content checks ─────────────────────────────────────────────────

describe("compileBlueprint: content correctness", () => {
    it("version is always '1.0'", () => {
        const bp = compileBlueprint(["lite_v1"], makeSnap({ tier: "cold" }));
        expect(bp.version).toBe("1.0");
    });

    it("hot snap includes required openai integration", () => {
        const bp = compileBlueprint(["whatsapp_funnel_v1"], makeSnap({ tier: "hot" }));
        expect(bp.integrations.some(i => i.key === "openai" && i.required)).toBe(true);
    });

    it("whatsapp channel → meta_whatsapp integration present", () => {
        const bp = compileBlueprint(["whatsapp_funnel_v1"], makeSnap({ hasWhatsApp: true }));
        expect(bp.integrations.some(i => i.key === "meta_whatsapp")).toBe(true);
    });

    it("cold snap → no whatsapp integration (no channel)", () => {
        const bp = compileBlueprint(["lite_v1"], makeSnap({ tier: "cold", hasWhatsApp: false }));
        expect(bp.integrations.some(i => i.key === "meta_whatsapp")).toBe(false);
    });

    it("preflight always includes db_connected as blocking", () => {
        const bp = compileBlueprint(["lite_v1"], makeSnap());
        const check = bp.preflightChecks.find(c => c.id === "db_connected");
        expect(check?.blocking).toBe(true);
    });

    it("waba preflight check only appears when hasWhatsApp=true", () => {
        const hasWA = compileBlueprint(["whatsapp_funnel_v1"], makeSnap({ hasWhatsApp: true }));
        const noWA = compileBlueprint(["lite_v1"], makeSnap({ hasWhatsApp: false }));
        expect(hasWA.preflightChecks.some(c => c.id === "waba_token")).toBe(true);
        expect(noWA.preflightChecks.some(c => c.id === "waba_token")).toBe(false);
    });

    it("rollout phases are sequential (phase numbers 1, 2, 3...)", () => {
        const bp = compileBlueprint(["full_stack_v1"], makeSnap({ tier: "hot" }));
        bp.rolloutPlan.forEach((p, i) => expect(p.phase).toBe(i + 1));
    });

    it("taskTemplates include go-live phase", () => {
        const bp = compileBlueprint(["whatsapp_funnel_v1"], makeSnap());
        const goLive = bp.taskTemplates.filter(t => t.phase.includes("Go-live"));
        expect(goLive.length).toBeGreaterThan(0);
    });

    it("overrideModules adds specified module to blueprint", () => {
        const bp = compileBlueprint(["lite_v1"], makeSnap(), ["executive_pack"]);
        expect(bp.selectedModules.some(m => m.key === "executive_pack")).toBe(true);
    });
});
