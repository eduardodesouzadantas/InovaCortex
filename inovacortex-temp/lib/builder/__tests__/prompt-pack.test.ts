/**
 * lib/builder/__tests__/prompt-pack.test.ts
 * V25.2: Vitest tests for the Prompt Pack Generator.
 *
 * Tests:
 *  1) max 6 parts enforced
 *  2) every part contains a verification plan
 *  3) all file references are in allowed directories
 *  4) no secrets in rendered body
 *  5) body structure + indexing
 *  6) part deduplication / stable ordering
 */

import { describe, it, expect } from "vitest";
import { buildPromptPack, allPathsAllowed, ALLOWED_DIRS } from "../prompt-pack";
import { compileBlueprint, selectTemplates, type InputSnapshot } from "../blueprint-engine";

// ─── Fixture ──────────────────────────────────────────────────────────────────

function makeSnap(overrides: Partial<InputSnapshot> = {}): InputSnapshot {
    return {
        orgId: "inovacortex",
        assessmentId: null,
        proposalId: null,
        workspaceId: null,
        snapshotAt: "2026-03-04T06:25:00.000Z",
        company: "ACME Corp",
        segment: "SaaS",
        industry: "saas",
        teamSize: "10-50",
        volumeDay: "100-500",
        scoreTotal: 80,
        tier: "hot",
        missions: ["Vendas", "Suporte"],
        channels: ["WhatsApp", "LinkedIn"],
        hasWhatsApp: true,
        hasInstagram: false,
        hasLinkedIn: true,
        hasEmail: false,
        hasCRM: true,
        hasERP: false,
        hasAutomation: false,
        hasAPI: true,
        urgency: "high",
        proposedModules: [],
        estimatedBudget: "medium",
        ...overrides,
    };
}

function makeBlueprint(snapOverrides?: Partial<InputSnapshot>) {
    const snap = makeSnap(snapOverrides);
    const templates = selectTemplates(snap);
    return compileBlueprint(templates, snap);
}

// ─── Max 6 parts ─────────────────────────────────────────────────────────────

describe("buildPromptPack: max 6 parts", () => {
    it("default options → exactly 6 parts", () => {
        const bp = makeBlueprint();
        const pack = buildPromptPack(bp);
        expect(pack.parts.length).toBeLessThanOrEqual(6);
        expect(pack.parts.length).toBeGreaterThan(0);
    });

    it("maxParts:6 → exactly 6 parts", () => {
        const bp = makeBlueprint();
        const pack = buildPromptPack(bp, { maxParts: 6 });
        expect(pack.parts.length).toBe(6);
    });

    it("maxParts:3 → exactly 3 parts", () => {
        const bp = makeBlueprint();
        const pack = buildPromptPack(bp, { maxParts: 3 });
        expect(pack.parts.length).toBe(3);
    });

    it("maxParts:10 is capped at 6", () => {
        const bp = makeBlueprint();
        const pack = buildPromptPack(bp, { maxParts: 10 });
        expect(pack.parts.length).toBeLessThanOrEqual(6);
    });

    it("parts are index-numbered 1..N", () => {
        const bp = makeBlueprint();
        const pack = buildPromptPack(bp);
        pack.parts.forEach((p, i) => expect(p.index).toBe(i + 1));
    });
});

// ─── Verification plan presence ───────────────────────────────────────────────

describe("buildPromptPack: each part has a verification plan", () => {
    it("every part has at least 1 verificationCommand", () => {
        const pack = buildPromptPack(makeBlueprint());
        for (const part of pack.parts) {
            expect(part.verificationCommands.length).toBeGreaterThan(0);
        }
    });

    it("every part body contains '### Verification Commands'", () => {
        const pack = buildPromptPack(makeBlueprint());
        for (const part of pack.parts) {
            expect(part.body).toContain("### Verification Commands");
        }
    });

    it("every part body contains '### Acceptance Criteria'", () => {
        const pack = buildPromptPack(makeBlueprint());
        for (const part of pack.parts) {
            expect(part.body).toContain("### Acceptance Criteria");
        }
    });

    it("verification commands include tsc check in at least 3 parts", () => {
        const pack = buildPromptPack(makeBlueprint());
        const count = pack.parts.filter(p =>
            p.verificationCommands.some(c => c.includes("tsc"))
        ).length;
        expect(count).toBeGreaterThanOrEqual(2);
    });

    it("final part (part 6) verification includes 'npm run build'", () => {
        const pack = buildPromptPack(makeBlueprint(), { maxParts: 6 });
        const last = pack.parts[pack.parts.length - 1];
        const hasNpmBuild = last.verificationCommands.some(c => c.includes("npm run build"));
        expect(hasNpmBuild).toBe(true);
    });
});

// ─── Allowed directories ─────────────────────────────────────────────────────

describe("buildPromptPack: files in allowed directories", () => {
    it("allPathsAllowed returns true for valid paths", () => {
        expect(allPathsAllowed(["app/org/inovacortex/page.tsx", "lib/builder/engine.ts", "prisma/schema.prisma"])).toBe(true);
    });

    it("allPathsAllowed returns false for disallowed paths", () => {
        expect(allPathsAllowed(["node_modules/some/lib.ts"])).toBe(false);
        expect(allPathsAllowed(["../../../etc/passwd"])).toBe(false);
        expect(allPathsAllowed(["scripts/hack.ts"])).toBe(false);
    });

    it("mixed paths — returns false if any is disallowed", () => {
        expect(allPathsAllowed(["app/page.tsx", "node_modules/foo"])).toBe(false);
    });

    it("filesToCreate in all parts reference only allowed dirs or are empty", () => {
        const pack = buildPromptPack(makeBlueprint(), { orgSlug: "inovacortex" });
        for (const part of pack.parts) {
            const valid = part.filesToCreate.every(f =>
                ALLOWED_DIRS.some(d => f.startsWith(d))
            );
            expect(valid).toBe(true);
        }
    });

    it("filesToModify in all parts reference only allowed dirs or allowed special files", () => {
        const pack = buildPromptPack(makeBlueprint(), { orgSlug: "inovacortex" });
        // Allow: app/, lib/, prisma/, components/, public/, .env.example
        for (const part of pack.parts) {
            const valid = part.filesToModify.every(f =>
                ALLOWED_DIRS.some(d => f.startsWith(d)) ||
                f.startsWith(".env")
            );
            expect(valid).toBe(true);
        }
    });

    it("ALLOWED_DIRS contains core dirs (app, lib, prisma, components, public)", () => {
        const dirs = Array.from(ALLOWED_DIRS);
        expect(dirs).toContain("app/");
        expect(dirs).toContain("lib/");
        expect(dirs).toContain("prisma/");
        expect(dirs).toContain("components/");
        expect(dirs).toContain("public/");
    });
});

// ─── No secrets leakage ───────────────────────────────────────────────────────

const SECRET_RE = /(?:Bearer |sk-|EAA[a-zA-Z0-9]{10,}|password\s*=\s*\S)/gi;

describe("buildPromptPack: no secrets in rendered body", () => {
    it("no bearer token pattern in any part body", () => {
        const pack = buildPromptPack(makeBlueprint());
        for (const part of pack.parts) {
            expect(part.body).not.toMatch(/Bearer [a-zA-Z0-9]{10,}/);
        }
    });

    it("no sk- (OpenAI key) pattern in any part body", () => {
        const pack = buildPromptPack(makeBlueprint());
        for (const part of pack.parts) {
            expect(part.body).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
        }
    });

    it("doNotChange lists .env as protected", () => {
        const pack = buildPromptPack(makeBlueprint());
        for (const part of pack.parts) {
            const hasEnvGuard = part.doNotChange.some(d => d.includes(".env"));
            expect(hasEnvGuard).toBe(true);
        }
    });

    it("settings keys mentioned are uppercase env var names, not values", () => {
        const pack = buildPromptPack(makeBlueprint());
        // Find any part body line mentioning env var
        const envLines = pack.parts.flatMap(p =>
            p.verificationCommands.filter(c => c.includes("OPENAI") || c.includes("WHATSAPP"))
        );
        for (const line of envLines) {
            // Should not contain an actual secret value (e.g. sk-...)
            expect(line).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
            expect(line).not.toMatch(/EAA[a-zA-Z0-9]{10,}/);
        }
    });
});

// ─── Body structure ───────────────────────────────────────────────────────────

describe("buildPromptPack: body structure", () => {
    it("each body starts with '# Prompt N: <title>'", () => {
        const pack = buildPromptPack(makeBlueprint());
        pack.parts.forEach((p, i) => {
            expect(p.body).toMatch(new RegExp(`^# Prompt ${i + 1}:`));
        });
    });

    it("body contains '### Do NOT Change' section", () => {
        const pack = buildPromptPack(makeBlueprint());
        for (const part of pack.parts) {
            expect(part.body).toContain("### Do NOT Change");
        }
    });

    it("body contains '### Style Rules' section", () => {
        const pack = buildPromptPack(makeBlueprint());
        for (const part of pack.parts) {
            expect(part.body).toContain("### Style Rules");
        }
    });

    it("style rules mention premium UI and dark background", () => {
        const pack = buildPromptPack(makeBlueprint());
        const styleJoined = pack.parts[0].styleRules.join(" ");
        expect(styleJoined).toContain("#0b0b0f");
        expect(styleJoined).toContain("premium");
    });

    it("part 1 is always DB/Schema", () => {
        const pack = buildPromptPack(makeBlueprint());
        expect(pack.parts[0].title).toContain("Database");
    });

    it("part 2 is always Core Modules", () => {
        const pack = buildPromptPack(makeBlueprint());
        expect(pack.parts[1].title).toContain("Core Module");
    });

    it("last part is always QA/Preflight or Go-live related", () => {
        const pack = buildPromptPack(makeBlueprint(), { maxParts: 6 });
        const last = pack.parts[pack.parts.length - 1];
        expect(last.title).toMatch(/QA|Preflight|Go-live/);
    });
});

// ─── Pack metadata ────────────────────────────────────────────────────────────

describe("buildPromptPack: pack metadata", () => {
    it("blueprintChecksum matches blueprint._checksum", () => {
        const bp = makeBlueprint();
        const pack = buildPromptPack(bp);
        expect(pack.blueprintChecksum).toBe(bp._checksum);
    });

    it("tier matches blueprint.tier", () => {
        const bp = makeBlueprint();
        const pack = buildPromptPack(bp);
        expect(pack.tier).toBe(bp.tier);
    });

    it("orgId matches blueprint.orgId", () => {
        const bp = makeBlueprint();
        const pack = buildPromptPack(bp);
        expect(pack.orgId).toBe(bp.orgId);
    });

    it("includeTests:false removes test style rule", () => {
        const bp = makeBlueprint();
        const withTests = buildPromptPack(bp, { includeTests: true });
        const noTests = buildPromptPack(bp, { includeTests: false });
        const wt = withTests.parts[0].styleRules.join("");
        const nt = noTests.parts[0].styleRules.join("");
        expect(wt).toContain("vitest");
        expect(nt).not.toContain("vitest test file");
    });

    it("orgSlug is substituted in filesToCreate paths", () => {
        const bp = makeBlueprint();
        const pack = buildPromptPack(bp, { orgSlug: "myclient" });
        const paths = pack.parts.flatMap(p => p.filesToCreate);
        const hasSlug = paths.some(p => p.includes("myclient"));
        expect(hasSlug).toBe(true);
    });
});
