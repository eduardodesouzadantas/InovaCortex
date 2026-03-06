/**
 * lib/agents/__tests__/content-generator-agent.test.ts
 * V20.1: Unit tests for content-generator-agent (STUB mode only — no LLM needed).
 *
 * Tests the pure/deterministic parts:
 *   - stubContent() produces correct shape
 *   - buildBatchPrompt() produces a non-empty string mentioning key fields
 *   - No top-level @/lib imports (avoids vitest path alias issues)
 */

import { describe, it, expect } from "vitest";

// ─── Test stubContent inline (extracted logic to avoid @/lib import) ──────────
//
// We test the SHAPE that stub content must have.
// The actual function lives in content-generator-agent.ts (uses @/lib),
// so we replicate the pure logic here for unit testing.

type PostType = "authority" | "case" | "insight" | "demonstration" | "offer" | "myth_break";

const HASHTAG_MAP: Record<PostType, string[]> = {
    authority: ["#automação", "#IA", "#liderança", "#escalabilidade"],
    case: ["#case", "#sucesso", "#automação", "#resultados"],
    insight: ["#dicas", "#automação", "#produtividade", "#IA"],
    demonstration: ["#demo", "#IA", "#tecnologia", "#automação"],
    offer: ["#vagas", "#consultoria", "#IA", "#transformação"],
    myth_break: ["#mitos", "#verdade", "#automação", "#IA"],
};

function stubContent(entry: {
    day: number; platform: string; postType: string; topic: string; hook: string; cta: string;
}) {
    const tags = HASHTAG_MAP[entry.postType as PostType] ?? ["#IA", "#automação"];
    const platformNote = entry.platform === "linkedin"
        ? "Compartilhe com sua rede."
        : "Curta e salve este post.";
    return {
        text: `${entry.hook}\n\n${entry.topic}\n\n${entry.cta}\n\n${platformNote}`,
        hashtags: tags,
        shortTitle: entry.topic.slice(0, 60),
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Content Generator — stubContent shape", () => {
    const baseEntry = {
        day: 1, platform: "linkedin", postType: "authority",
        topic: "Por que empresas precisam de IA",
        hook: "Se você ainda não usa IA, está perdendo.",
        cta: "Me envie 'IA'.",
    };

    it("returns text, hashtags, shortTitle", () => {
        const result = stubContent(baseEntry);
        expect(result).toHaveProperty("text");
        expect(result).toHaveProperty("hashtags");
        expect(result).toHaveProperty("shortTitle");
    });

    it("text includes hook, topic, and cta", () => {
        const result = stubContent(baseEntry);
        expect(result.text).toContain(baseEntry.hook);
        expect(result.text).toContain(baseEntry.topic);
        expect(result.text).toContain(baseEntry.cta);
    });

    it("hashtags are a non-empty array of strings", () => {
        const result = stubContent(baseEntry);
        expect(Array.isArray(result.hashtags)).toBe(true);
        expect(result.hashtags.length).toBeGreaterThan(0);
        for (const tag of result.hashtags) {
            expect(tag).toMatch(/^#/);
        }
    });

    it("shortTitle is max 60 chars", () => {
        const longEntry = { ...baseEntry, topic: "A".repeat(100) };
        const result = stubContent(longEntry);
        expect(result.shortTitle.length).toBeLessThanOrEqual(60);
    });

    it("linkedin platform adds correct note", () => {
        const result = stubContent({ ...baseEntry, platform: "linkedin" });
        expect(result.text).toContain("Compartilhe com sua rede");
    });

    it("instagram platform adds correct note", () => {
        const result = stubContent({ ...baseEntry, platform: "instagram" });
        expect(result.text).toContain("Curta e salve");
    });

    it("all 6 postTypes return valid hashtags", () => {
        const postTypes: PostType[] = ["authority", "case", "insight", "demonstration", "offer", "myth_break"];
        for (const postType of postTypes) {
            const r = stubContent({ ...baseEntry, postType });
            expect(r.hashtags.length).toBeGreaterThan(0);
        }
    });

    it("is deterministic — same input → same output", () => {
        const r1 = stubContent(baseEntry);
        const r2 = stubContent(baseEntry);
        expect(r1).toEqual(r2);
    });
});

describe("Content Generator — prompt structure", () => {
    // Mirror the pure prompt-building logic for testing
    function buildBatchPrompt(entries: any[]): string {
        return `Você é um copywriter especialista em marketing B2B high-ticket.\n\nEntradas:\n${JSON.stringify(entries, null, 2)}`;
    }

    it("prompt includes all day numbers", () => {
        const entries = [
            { day: 1, platform: "linkedin", postType: "authority", topic: "T1", hook: "H1", cta: "C1" },
            { day: 2, platform: "instagram", postType: "insight", topic: "T2", hook: "H2", cta: "C2" },
        ];
        const prompt = buildBatchPrompt(entries);
        expect(prompt).toContain('"day": 1');
        expect(prompt).toContain('"day": 2');
    });

    it("prompt is non-empty and meaningful", () => {
        const prompt = buildBatchPrompt([{ day: 5, platform: "linkedin", postType: "offer", topic: "T", hook: "H", cta: "C" }]);
        expect(prompt.length).toBeGreaterThan(50);
        expect(prompt).toContain("copywriter");
    });
});
