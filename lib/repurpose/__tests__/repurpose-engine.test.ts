/**
 * lib/repurpose/__tests__/repurpose-engine.test.ts
 * V21: Unit tests for the Repurpose Engine pure functions.
 *
 * Tests ONLY: buildStubFormats (pure, zero deps)
 */

import { describe, it, expect } from "vitest";
import { buildStubFormats } from "../stub-formats";

const ctx = {
    topic: "Por que empresas precisam de automação",
    hook: "Se você ainda faz isso manualmente, está perdendo dinheiro.",
    cta: "Me envie 'IA' para conversar.",
    text: "Texto base do post original.",
    platform: "linkedin",
    postType: "authority",
};

describe("Repurpose Engine — buildStubFormats", () => {
    const result = buildStubFormats(ctx);

    it("returns all 5 format keys", () => {
        expect(result).toHaveProperty("linkedin_v2");
        expect(result).toHaveProperty("carousel");
        expect(result).toHaveProperty("thread");
        expect(result).toHaveProperty("video");
        expect(result).toHaveProperty("email");
    });

    describe("linkedin_v2", () => {
        it("has hook, text, and cta", () => {
            expect(result.linkedin_v2.hook).toBeTruthy();
            expect(result.linkedin_v2.text).toBeTruthy();
            expect(result.linkedin_v2.cta).toBeTruthy();
        });

        it("includes original hook and cta", () => {
            expect(result.linkedin_v2.hook).toContain(ctx.hook);
            expect(result.linkedin_v2.cta).toBe(ctx.cta);
        });
    });

    describe("carousel", () => {
        it("has title, 7 slides, and cta", () => {
            expect(result.carousel.title).toBeTruthy();
            expect(result.carousel.slides).toHaveLength(7);
            expect(result.carousel.cta).toBeTruthy();
        });

        it("all slides are non-empty strings", () => {
            for (const slide of result.carousel.slides) {
                expect(typeof slide).toBe("string");
                expect(slide.length).toBeGreaterThan(0);
            }
        });
    });

    describe("thread", () => {
        it("has 8–12 tweets", () => {
            expect(result.thread.tweets.length).toBeGreaterThanOrEqual(8);
            expect(result.thread.tweets.length).toBeLessThanOrEqual(12);
        });

        it("first tweet starts with '1/'", () => {
            expect(result.thread.tweets[0]).toMatch(/^1\//);
        });

        it("tweets are numbered sequentially", () => {
            result.thread.tweets.forEach((t, i) => {
                expect(t).toMatch(new RegExp(`^${i + 1}\\/`));
            });
        });
    });

    describe("video", () => {
        it("has hook, scenes, and cta", () => {
            expect(result.video.hook).toBeTruthy();
            expect(Array.isArray(result.video.scenes)).toBe(true);
            expect(result.video.cta).toBeTruthy();
        });

        it("scenes have sec, fala, tela fields", () => {
            for (const scene of result.video.scenes) {
                expect(typeof scene.sec).toBe("number");
                expect(typeof scene.fala).toBe("string");
                expect(typeof scene.tela).toBe("string");
            }
        });

        it("scenes are ordered by sec ASC", () => {
            const secs = result.video.scenes.map(s => s.sec);
            for (let i = 1; i < secs.length; i++) {
                expect(secs[i]).toBeGreaterThanOrEqual(secs[i - 1]);
            }
        });
    });

    describe("email", () => {
        it("has subject and body", () => {
            expect(result.email.subject).toBeTruthy();
            expect(result.email.body).toBeTruthy();
        });

        it("body is 100+ chars", () => {
            expect(result.email.body.length).toBeGreaterThan(100);
        });

        it("subject includes topic", () => {
            expect(result.email.subject).toContain(ctx.topic);
        });
    });

    it("is fully deterministic (same input → same output)", () => {
        const r2 = buildStubFormats(ctx);
        expect(r2).toEqual(result);
    });
});
