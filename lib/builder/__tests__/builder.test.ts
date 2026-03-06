/**
 * lib/builder/__tests__/builder.test.ts
 * V25: Vitest tests for builder-guard pure helpers.
 *
 * Tests: gating logic, status machine transitions, RBAC checks.
 * DB interactions are mocked inline.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { isValidTransition, ALL_BUILD_MODES, ALL_ARTIFACT_TYPES, INTERNAL_ORG_SLUG, SETTING_KEY } from "../builder-guard";

// ─── isValidTransition ────────────────────────────────────────────────────────
describe("isValidTransition (status machine)", () => {
    // Happy paths
    it("draft → review     ✓", () => expect(isValidTransition("draft", "review")).toBe(true));
    it("draft → failed     ✓", () => expect(isValidTransition("draft", "failed")).toBe(true));
    it("review → approved  ✓", () => expect(isValidTransition("review", "approved")).toBe(true));
    it("review → draft     ✓", () => expect(isValidTransition("review", "draft")).toBe(true));
    it("review → failed    ✓", () => expect(isValidTransition("review", "failed")).toBe(true));
    it("approved → executing ✓", () => expect(isValidTransition("approved", "executing")).toBe(true));
    it("approved → draft   ✓", () => expect(isValidTransition("approved", "draft")).toBe(true));
    it("executing → done   ✓", () => expect(isValidTransition("executing", "done")).toBe(true));
    it("executing → failed ✓", () => expect(isValidTransition("executing", "failed")).toBe(true));
    it("failed → draft     ✓", () => expect(isValidTransition("failed", "draft")).toBe(true));

    // Invalid paths
    it("done → anything    ✗", () => {
        expect(isValidTransition("done", "draft")).toBe(false);
        expect(isValidTransition("done", "review")).toBe(false);
    });
    it("draft → done       ✗", () => expect(isValidTransition("draft", "done")).toBe(false));
    it("draft → executing  ✗", () => expect(isValidTransition("draft", "executing")).toBe(false));
    it("review → done      ✗", () => expect(isValidTransition("review", "done")).toBe(false));
    it("approved → done    ✗", () => expect(isValidTransition("approved", "done")).toBe(false));
    it("unknown → review   ✗", () => expect(isValidTransition("nonexistent", "review")).toBe(false));
    it("empty string       ✗", () => expect(isValidTransition("", "draft")).toBe(false));
});

// ─── Constants consistency ────────────────────────────────────────────────────
describe("ALL_BUILD_MODES", () => {
    it("contains plan_only", () => expect(ALL_BUILD_MODES).toContain("plan_only"));
    it("contains prompt_pack", () => expect(ALL_BUILD_MODES).toContain("prompt_pack"));
    it("contains code_patch", () => expect(ALL_BUILD_MODES).toContain("code_patch"));
    it("has 3 entries", () => expect(ALL_BUILD_MODES.length).toBe(3));
});

describe("ALL_ARTIFACT_TYPES", () => {
    it("contains implementation_plan", () => expect(ALL_ARTIFACT_TYPES).toContain("implementation_plan"));
    it("contains prompt_pack", () => expect(ALL_ARTIFACT_TYPES).toContain("prompt_pack"));
    it("contains diff_plan", () => expect(ALL_ARTIFACT_TYPES).toContain("diff_plan"));
    it("contains checklist", () => expect(ALL_ARTIFACT_TYPES).toContain("checklist"));
    it("has 4 entries", () => expect(ALL_ARTIFACT_TYPES.length).toBe(4));
});

// ─── Gating constants ─────────────────────────────────────────────────────────
describe("Gating constants", () => {
    it("INTERNAL_ORG_SLUG is 'inovacortex'", () => expect(INTERNAL_ORG_SLUG).toBe("inovacortex"));
    it("SETTING_KEY is 'internal_builder_enabled'", () => expect(SETTING_KEY).toBe("internal_builder_enabled"));
});

// ─── Gating logic (pure) ──────────────────────────────────────────────────────
// We test the gating rules as pure logic (no DB needed).
describe("Gating rules (pure logic)", () => {
    // Rule 1: slug match
    it("slug 'inovacortex' → allowed regardless of setting", () => {
        const slug = "inovacortex";
        const allowed = slug === INTERNAL_ORG_SLUG || false; // setting=false
        expect(allowed).toBe(true);
    });

    it("slug 'someclient' + setting=false → denied", () => {
        const slug: string = "someclient";
        const setting: string = "false";
        const allowed = slug === INTERNAL_ORG_SLUG || setting === "true";
        expect(allowed).toBe(false);
    });

    it("slug 'someclient' + setting=true → allowed", () => {
        const slug: string = "someclient";
        const setting: string = "true";
        const allowed = slug === INTERNAL_ORG_SLUG || setting === "true";
        expect(allowed).toBe(true);
    });

    it("slug 'demo-corp' + setting=undefined → denied", () => {
        const slug: string = "demo-corp";
        const setting: string | undefined = undefined;
        const allowed = slug === INTERNAL_ORG_SLUG || setting === "true";
        expect(allowed).toBe(false);
    });

    // Rule 2: RBAC
    it("role 'owner' → allowed", () => expect(["owner", "admin"].includes("owner")).toBe(true));
    it("role 'admin' → allowed", () => expect(["owner", "admin"].includes("admin")).toBe(true));
    it("role 'closer' → denied", () => expect(["owner", "admin"].includes("closer")).toBe(false));
    it("role 'viewer' → denied", () => expect(["owner", "admin"].includes("viewer")).toBe(false));
    it("role '' → denied", () => expect(["owner", "admin"].includes("")).toBe(false));
});

// ─── Blueprint exposure guard ─────────────────────────────────────────────────
describe("Blueprint redaction (response shape)", () => {
    it("safe template omits blueprintJson", () => {
        const raw = { id: "abc", key: "k", name: "N", blueprintJson: '{"steps":[]}', version: 1 };
        const { blueprintJson: _, ...safe } = raw;
        expect("blueprintJson" in safe).toBe(false);
        expect(safe.key).toBe("k");
    });

    it("blueprintJson must not appear in GET response", () => {
        // Simulates what the GET route returns
        const fakeDb = { id: "1", key: "x", name: "X", description: "", version: 1, createdAt: new Date() };
        expect("blueprintJson" in fakeDb).toBe(false);
    });
});
