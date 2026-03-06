/**
 * __tests__/funnel-sequence.test.ts
 * R3: Funnel automation tests — pure logic, no DB or API calls.
 */

import {
    FUNNEL_TEMPLATES,
    selectTemplate,
    computeScoreTier,
    nextStage,
    renderTemplate,
    type ScoreTier,
    type FunnelStage,
    type TemplateVars,
} from "../lib/funnel-templates";

import { normalizePhone } from "../lib/whatsapp";

// ─── Score Tier Computation ───────────────────────────────────────────────────

describe("Funnel: Score tier classification", () => {
    test("score ≥ 80 → hot", () => expect(computeScoreTier(80)).toBe("hot"));
    test("score = 100 → hot", () => expect(computeScoreTier(100)).toBe("hot"));
    test("score = 79 → warm", () => expect(computeScoreTier(79)).toBe("warm"));
    test("score = 50 → warm", () => expect(computeScoreTier(50)).toBe("warm"));
    test("score = 49 → cold", () => expect(computeScoreTier(49)).toBe("cold"));
    test("score = 0 → cold", () => expect(computeScoreTier(0)).toBe("cold"));
    test("score boundary 80 → hot", () => expect(computeScoreTier(80)).toBe("hot"));
    test("score boundary 50 → warm", () => expect(computeScoreTier(50)).toBe("warm"));
});

// ─── Template Library ─────────────────────────────────────────────────────────

describe("Funnel: Template library", () => {
    test("at least 9 templates defined", () => {
        expect(FUNNEL_TEMPLATES.length).toBeGreaterThanOrEqual(9);
    });

    test("all templates have required fields", () => {
        for (const t of FUNNEL_TEMPLATES) {
            expect(t.key).toBeTruthy();
            expect(t.stage).toBeTruthy();
            expect(t.body).toBeTruthy();
            expect(t.cooldownHours).toBeGreaterThanOrEqual(0);
        }
    });

    test("no duplicate template keys", () => {
        const keys = FUNNEL_TEMPLATES.map(t => t.key);
        expect(new Set(keys).size).toBe(keys.length);
    });

    test("follow_up_2 exists as ultimate fallback", () => {
        expect(FUNNEL_TEMPLATES.some(t => t.key === "follow_up_2")).toBe(true);
    });
});

// ─── Template Selector ────────────────────────────────────────────────────────

describe("Funnel: Template selection", () => {
    test("hot initial → initial_hot template", () => {
        const t = selectTemplate("whatsapp_initial", "hot");
        expect(t.key).toBe("initial_hot");
    });

    test("warm initial → initial_warm template", () => {
        const t = selectTemplate("whatsapp_initial", "warm");
        expect(t.key).toBe("initial_warm");
    });

    test("cold initial → initial_cold template", () => {
        const t = selectTemplate("whatsapp_initial", "cold");
        expect(t.key).toBe("initial_cold");
    });

    test("proposal sent → proposal_sent (all tiers)", () => {
        const t1 = selectTemplate("proposal_sent", "hot");
        const t2 = selectTemplate("proposal_sent", "cold");
        expect(t1.key).toBe("proposal_sent");
        expect(t2.key).toBe("proposal_sent");
    });

    test("unknown stage falls back to follow_up_2", () => {
        const t = selectTemplate("lost" as FunnelStage, "warm");
        expect(t.key).toBe("follow_up_2");
    });
});

// ─── Stage Progression ───────────────────────────────────────────────────────

describe("Funnel: Stage progression", () => {
    test("post_click → whatsapp_initial", () =>
        expect(nextStage("post_click")).toBe("whatsapp_initial"));

    test("whatsapp_initial → post_dossier", () =>
        expect(nextStage("whatsapp_initial")).toBe("post_dossier"));

    test("proposal_sent → follow_up_1", () =>
        expect(nextStage("proposal_sent")).toBe("follow_up_1"));

    test("follow_up_1 → follow_up_2", () =>
        expect(nextStage("follow_up_1")).toBe("follow_up_2"));

    test("follow_up_2 (last stage) → null", () =>
        expect(nextStage("follow_up_2")).toBeNull());
});

// ─── Template Rendering ───────────────────────────────────────────────────────

describe("Funnel: Template rendering", () => {
    const template = selectTemplate("whatsapp_initial", "hot");
    const vars: TemplateVars = {
        firstName: "Carlos",
        company: "Clínica Saúde Total",
        score: 88,
        savings: "15.000",
        closer: "Ana Silva",
        dossierLink: "https://inovacortex.com.br/diagnostico/abc123",
    };

    const rendered = renderTemplate(template, vars);

    test("first name is rendered", () =>
        expect(rendered).toContain("Carlos"));

    test("company is rendered", () =>
        expect(rendered).toContain("Clínica Saúde Total"));

    test("score is rendered", () =>
        expect(rendered).toContain("88"));

    test("savings is rendered", () =>
        expect(rendered).toContain("15.000"));

    test("closer name is rendered", () =>
        expect(rendered).toContain("Ana Silva"));

    test("no unreplaced {{vars}} remain", () =>
        expect(rendered).not.toMatch(/\{\{[a-zA-Z]+\}\}/));

    test("missing vars use defaults (not empty)", () => {
        const bare = renderTemplate(template, {});
        // Should use fallback strings instead of empty
        expect(bare).not.toContain("{{firstName}}");
        expect(bare).not.toContain("{{company}}");
    });
});

// ─── Cooldown Logic ───────────────────────────────────────────────────────────

describe("Funnel: Cooldown guard", () => {
    function isInCooldown(nextAllowedAt: Date | null): boolean {
        if (!nextAllowedAt) return false;
        return new Date() < nextAllowedAt;
    }

    function cooldownHoursRemaining(nextAllowedAt: Date): number {
        const diff = nextAllowedAt.getTime() - Date.now();
        return Math.max(0, Math.ceil(diff / 3600000));
    }

    test("no nextAllowedAt → not in cooldown", () => {
        expect(isInCooldown(null)).toBe(false);
    });

    test("future nextAllowedAt → in cooldown", () => {
        const future = new Date(Date.now() + 86400000);
        expect(isInCooldown(future)).toBe(true);
    });

    test("past nextAllowedAt → not in cooldown", () => {
        const past = new Date(Date.now() - 1000);
        expect(isInCooldown(past)).toBe(false);
    });

    test("24h cooldown → ~24 hours remaining", () => {
        const in24h = new Date(Date.now() + 24 * 3600000);
        expect(cooldownHoursRemaining(in24h)).toBeGreaterThanOrEqual(23);
    });
});

// ─── Phone Normalization ─────────────────────────────────────────────────────

describe("Funnel: Phone normalization (Brazil)", () => {
    test("11-digit number → 55 prefix added", () =>
        expect(normalizePhone("11999998888")).toBe("5511999998888"));

    test("already E.164 → unchanged", () =>
        expect(normalizePhone("5511999998888")).toBe("5511999998888"));

    test("formatted number → digits only + prefix", () =>
        expect(normalizePhone("(11) 99999-8888")).toBe("5511999998888"));

    test("+55 prefix → normalized", () =>
        expect(normalizePhone("+5511999998888")).toBe("5511999998888"));
});
