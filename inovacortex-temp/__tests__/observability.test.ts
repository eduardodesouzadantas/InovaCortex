/**
 * __tests__/observability.test.ts
 * V11: Observability & Trust Layer tests.
 * Tests pure logic for alerts, audit filtering, and cost aggregation.
 */

// ─── Alert Threshold Logic ────────────────────────────────────────────────────

describe("Alerts: threshold detection", () => {
    function usageBarPct(current: number, max: number): number {
        return Math.min(100, Math.round((current / Math.max(max, 1)) * 100));
    }

    function shouldAlert(current: number, max: number, threshold = 90): boolean {
        return usageBarPct(current, max) >= threshold;
    }

    test("no alert below 90%", () => {
        expect(shouldAlert(80, 100)).toBe(false);
        expect(shouldAlert(50, 100)).toBe(false);
        expect(shouldAlert(0, 100)).toBe(false);
    });

    test("alert at exactly 90%", () => {
        expect(shouldAlert(90, 100)).toBe(true);
    });

    test("alert above 90%", () => {
        expect(shouldAlert(95, 100)).toBe(true);
        expect(shouldAlert(100, 100)).toBe(true);
    });

    test("handles zero max gracefully", () => {
        expect(() => shouldAlert(5, 0)).not.toThrow();
    });
});

// ─── AI Failure Rate Logic ─────────────────────────────────────────────────────

describe("Alerts: AI failure rate", () => {
    function failureRatePct(total: number, failures: number): number {
        if (total === 0) return 0;
        return Math.round((failures / total) * 100);
    }

    function shouldAlertOnAI(total: number, failures: number, threshold = 30): boolean {
        if (total < 3) return false;
        return failureRatePct(total, failures) >= threshold;
    }

    test("no alert with fewer than 3 samples", () => {
        expect(shouldAlertOnAI(2, 2)).toBe(false);
    });

    test("no alert below 30% failure rate", () => {
        expect(shouldAlertOnAI(10, 2)).toBe(false); // 20%
        expect(shouldAlertOnAI(10, 0)).toBe(false); // 0%
    });

    test("alert at exactly 30% failure rate", () => {
        expect(shouldAlertOnAI(10, 3)).toBe(true); // 30%
    });

    test("alert above 30% failure rate", () => {
        expect(shouldAlertOnAI(10, 5)).toBe(true);  // 50%
        expect(shouldAlertOnAI(10, 10)).toBe(true); // 100%
    });

    test("100% success rate = no alert", () => {
        expect(shouldAlertOnAI(100, 0)).toBe(false);
    });
});

// ─── Cost Aggregation Logic ───────────────────────────────────────────────────

describe("Cost Dashboard: aggregation math", () => {
    function totalTokens(prompt: number, completion: number) {
        return prompt + completion;
    }

    function avgCostPerCall(totalCost: number, callCount: number): number {
        if (callCount === 0) return 0;
        return totalCost / callCount;
    }

    function costTrendPct(thisMonth: number, lastMonth: number): number | null {
        if (lastMonth === 0) return null;
        return Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
    }

    test("totalTokens sums prompt + completion", () => {
        expect(totalTokens(1000, 500)).toBe(1500);
        expect(totalTokens(0, 0)).toBe(0);
    });

    test("avgCostPerCall handles zero division", () => {
        expect(avgCostPerCall(0, 0)).toBe(0);
        expect(avgCostPerCall(1.5, 10)).toBeCloseTo(0.15);
    });

    test("costTrendPct returns null when no previous month", () => {
        expect(costTrendPct(5, 0)).toBeNull();
    });

    test("costTrendPct calculates correctly", () => {
        expect(costTrendPct(6, 4)).toBe(50);    // +50%
        expect(costTrendPct(3, 6)).toBe(-50);   // -50%
        expect(costTrendPct(5, 5)).toBe(0);     // flat
    });
});

// ─── Audit CSV Format Logic ───────────────────────────────────────────────────

describe("Audit: CSV formatting", () => {
    function escapeCSV(value: string): string {
        return `"${value.replace(/"/g, '""').replace(/\n/g, " ")}"`;
    }

    test("escapes double quotes", () => {
        expect(escapeCSV('He said "hello"')).toBe('"He said ""hello"""');
    });

    test("replaces newlines with spaces", () => {
        expect(escapeCSV("line1\nline2")).toBe('"line1 line2"');
    });

    test("wraps in double quotes", () => {
        expect(escapeCSV("simple")).toBe('"simple"');
    });

    test("handles empty string", () => {
        expect(escapeCSV("")).toBe('""');
    });
});

// ─── Logger Context ───────────────────────────────────────────────────────────

describe("Logger: timed helper logic", () => {
    test("timed returns the function result", async () => {
        async function computeLatency<T>(fn: () => Promise<T>): Promise<{ result: T; latencyMs: number }> {
            const start = Date.now();
            const result = await fn();
            return { result, latencyMs: Date.now() - start };
        }

        const { result, latencyMs } = await computeLatency(async () => 42);
        expect(result).toBe(42);
        expect(latencyMs).toBeGreaterThanOrEqual(0);
    });

    test("timed propagates errors", async () => {
        async function computeLatency<T>(fn: () => Promise<T>): Promise<T> {
            try { return await fn(); } catch (e) { throw e; }
        }

        await expect(computeLatency(async () => { throw new Error("boom"); }))
            .rejects.toThrow("boom");
    });
});
