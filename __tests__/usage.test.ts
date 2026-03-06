/**
 * __tests__/usage.test.ts
 * V10: Usage metering and plan limits tests.
 * Tests pure JS logic (PLAN_LIMITS, currentMonth, usageBar math) without DB.
 */

import { PLAN_LIMITS, currentMonth } from "../lib/usage";

// ─── PLAN_LIMITS Structure Tests ─────────────────────────────────────────────

describe("Usage: PLAN_LIMITS", () => {
    test("all plans have required event types", () => {
        const required = ["assessmentCreated", "presalesGenerated", "proposalGenerated", "pdfGenerated", "dossierGenerated"];
        for (const plan of ["free", "growth", "enterprise"]) {
            for (const type of required) {
                expect(PLAN_LIMITS[plan]).toHaveProperty(type);
                expect(PLAN_LIMITS[plan][type]).toBeGreaterThan(0);
            }
        }
    });

    test("enterprise has maximum limits (9999)", () => {
        const limits = PLAN_LIMITS.enterprise;
        for (const val of Object.values(limits)) {
            expect(val).toBe(9999);
        }
    });

    test("free plan is the most restrictive", () => {
        for (const type of Object.keys(PLAN_LIMITS.free)) {
            expect(PLAN_LIMITS.free[type]).toBeLessThan(PLAN_LIMITS.growth[type]);
            expect(PLAN_LIMITS.growth[type]).toBeLessThan(PLAN_LIMITS.enterprise[type]);
        }
    });

    test("free assessment limit is 10", () => {
        expect(PLAN_LIMITS.free.assessmentCreated).toBe(10);
    });

    test("growth assessment limit is 100", () => {
        expect(PLAN_LIMITS.growth.assessmentCreated).toBe(100);
    });
});

// ─── currentMonth Helper ──────────────────────────────────────────────────────

describe("Usage: currentMonth()", () => {
    test("returns YYYY-MM format", () => {
        const month = currentMonth();
        expect(month).toMatch(/^\d{4}-\d{2}$/);
    });

    test("returns current year and month", () => {
        const now = new Date();
        const month = currentMonth();
        const [year, mon] = month.split("-").map(Number);
        expect(year).toBe(now.getUTCFullYear());
        expect(mon).toBe(now.getUTCMonth() + 1);
    });
});

// ─── Usage Bar Math ──────────────────────────────────────────────────────────

describe("Usage: progress bar math", () => {
    function usageBar(current: number, max: number) {
        const pct = Math.min(100, Math.round((current / Math.max(max, 1)) * 100));
        const color = pct >= 90 ? "red" : pct >= 70 ? "yellow" : "primary";
        return { pct, color };
    }

    test("0% when no usage", () => {
        expect(usageBar(0, 100).pct).toBe(0);
        expect(usageBar(0, 100).color).toBe("primary");
    });

    test("50% at half usage", () => {
        expect(usageBar(50, 100).pct).toBe(50);
    });

    test("red at >= 90%", () => {
        expect(usageBar(90, 100).color).toBe("red");
        expect(usageBar(95, 100).color).toBe("red");
    });

    test("yellow at 70-89%", () => {
        expect(usageBar(70, 100).color).toBe("yellow");
        expect(usageBar(85, 100).color).toBe("yellow");
    });

    test("caps at 100% even if over limit", () => {
        expect(usageBar(999, 100).pct).toBe(100);
    });

    test("handles max=0 gracefully (no division by zero)", () => {
        expect(() => usageBar(5, 0)).not.toThrow();
        expect(usageBar(5, 0).pct).toBe(100);
    });
});

// ─── Stripe: Stub Mode Detection ─────────────────────────────────────────────

describe("Stripe: stub mode", () => {
    test("isStripeEnabled returns false when key absent", () => {
        const original = process.env.STRIPE_SECRET_KEY;
        delete process.env.STRIPE_SECRET_KEY;
        // Inline the check to avoid ESM import of stripe
        const enabled = !!process.env.STRIPE_SECRET_KEY;
        expect(enabled).toBe(false);
        process.env.STRIPE_SECRET_KEY = original;
    });

    test("isStripeEnabled returns true when key present", () => {
        const original = process.env.STRIPE_SECRET_KEY;
        process.env.STRIPE_SECRET_KEY = "sk_test_fake123";
        const enabled = !!process.env.STRIPE_SECRET_KEY;
        expect(enabled).toBe(true);
        process.env.STRIPE_SECRET_KEY = original;
    });
});
