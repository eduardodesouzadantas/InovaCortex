/**
 * lib/agents/__tests__/marketing-planner-agent.test.ts
 * V20.1: Unit tests for the deterministic marketing planner.
 * Tests ONLY pure/zero-dep exports: buildCalendar, buildCalendar coverage.
 */

import { describe, it, expect } from "vitest";
import { buildCalendar } from "../marketing-planner-agent";
import type { OrgContext, PostType } from "../marketing-planner-agent";

const ctx: OrgContext = {
    niches: ["clínica estética", "imobiliária"],
    pains: ["leads não respondidos", "agendamento manual", "falta de follow-up"],
    offers: ["agente de atendimento IA", "CRM automatizado"],
    hasAuthorityAssets: true,
};

describe("Marketing Planner — buildCalendar", () => {
    const calendar = buildCalendar(ctx);

    it("returns exactly 30 entries", () => {
        expect(calendar).toHaveLength(30);
    });

    it("day numbers are 1..30 in order", () => {
        const days = calendar.map(e => e.day);
        expect(days).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    });

    it("every platform is linkedin or instagram", () => {
        const valid = new Set(["linkedin", "instagram"]);
        for (const e of calendar) {
            expect(valid.has(e.platform), `day ${e.day} bad platform: ${e.platform}`).toBe(true);
        }
    });

    it("every postType is one of the 6 valid types", () => {
        const valid: Set<PostType> = new Set(["authority", "case", "insight", "demonstration", "offer", "myth_break"]);
        for (const e of calendar) {
            expect(valid.has(e.postType as PostType), `day ${e.day} bad postType: ${e.postType}`).toBe(true);
        }
    });

    it("priority scores match the type", () => {
        const expected: Record<PostType, number> = {
            offer: 5, case: 4, demonstration: 4, authority: 3, insight: 2, myth_break: 2,
        };
        for (const e of calendar) {
            expect(e.priority).toBe(expected[e.postType as PostType]);
        }
    });

    it("all hooks and CTAs are non-empty strings", () => {
        for (const e of calendar) {
            expect(typeof e.hook).toBe("string");
            expect(e.hook.length).toBeGreaterThan(10);
            expect(typeof e.cta).toBe("string");
            expect(e.cta.length).toBeGreaterThan(5);
        }
    });

    it("day 1 (Mon) is authority", () => {
        expect(calendar[0].postType).toBe("authority");
    });

    it("day 2 (Tue) is insight", () => {
        expect(calendar[1].postType).toBe("insight");
    });

    it("day 3 (Wed) is case", () => {
        expect(calendar[2].postType).toBe("case");
    });

    it("day 4 (Thu) is demonstration", () => {
        expect(calendar[3].postType).toBe("demonstration");
    });

    it("day 5 (Fri) is offer", () => {
        expect(calendar[4].postType).toBe("offer");
    });

    it("day 6 (Sat) is insight", () => {
        expect(calendar[5].postType).toBe("insight");
    });

    it("day 7 (Sun) is authority", () => {
        expect(calendar[6].postType).toBe("authority");
    });

    it("odd days use linkedin, even days use instagram", () => {
        for (const e of calendar) {
            if (e.day % 2 === 1) expect(e.platform).toBe("linkedin");
            else expect(e.platform).toBe("instagram");
        }
    });

    it("templates reference org-specific terms in hooks", () => {
        const allHooks = calendar.map(e => e.hook).join(" ");
        const hasSomeTerm = ctx.niches.some(n => allHooks.includes(n)) ||
            ctx.pains.some(p => allHooks.includes(p));
        expect(hasSomeTerm).toBe(true);
    });

    it("second call with same context produces identical output (deterministic)", () => {
        const cal2 = buildCalendar(ctx);
        expect(cal2).toEqual(calendar);
    });

    it("no raw template tokens left (no {placeholder})", () => {
        for (const e of calendar) {
            for (const text of [e.hook, e.cta, e.topic]) {
                expect(text, `day ${e.day} has unreplaced placeholder: "${text}"`).not.toMatch(/\{[a-z_]+\}/);
            }
        }
    });
});
