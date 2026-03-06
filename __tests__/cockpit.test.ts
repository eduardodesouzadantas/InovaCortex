/**
 * __tests__/cockpit.test.ts
 * V14: Command Center — pure logic tests (no DB, no AI).
 */

// ─── Helpers under test ───────────────────────────────────────────────────────
// Pull pure logic from the module, keeping DB calls separate.

function formatMoney(n: number): string {
    if (n >= 1_000_000) return `R$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `R$${(n / 1_000).toFixed(0)}k`;
    return `R$${n}`;
}

function assessmentsPct(used: number, max: number): number {
    return Math.min(100, Math.round((used / max) * 100));
}

function computeAICost(generations: number): number {
    return Math.round(generations * 0.002 * 100) / 100;
}

function buildActionQueueOrder(items: { priority: string }[]): string[] {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2 };
    return [...items].sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9)).map(i => i.priority);
}

function computeOverallConversionRate(total: number, converted: number): number {
    return total > 0 ? Math.round((converted / total) * 100) : 0;
}

function canToggle(role: string): boolean {
    return ["owner", "admin"].includes(role);
}

function toggleGuard(key: string): boolean {
    const ALLOWED = ["ai.content_engine", "ai.presales", "ai.funnel_engine", "ai.authority"];
    return ALLOWED.includes(key);
}

// ─── formatMoney ─────────────────────────────────────────────────────────────

describe("V14 Cockpit: formatMoney", () => {
    test("0 → R$0", () => expect(formatMoney(0)).toBe("R$0"));
    test("500 → R$500", () => expect(formatMoney(500)).toBe("R$500"));
    test("1000 → R$1k", () => expect(formatMoney(1000)).toBe("R$1k"));
    test("50000 → R$50k", () => expect(formatMoney(50000)).toBe("R$50k"));
    test("1000000 → R$1.0M", () => expect(formatMoney(1000000)).toBe("R$1.0M"));
    test("2500000 → R$2.5M", () => expect(formatMoney(2500000)).toBe("R$2.5M"));
});

// ─── Usage % ─────────────────────────────────────────────────────────────────

describe("V14 Cockpit: Usage percentage", () => {
    test("0 of 10 = 0%", () => expect(assessmentsPct(0, 10)).toBe(0));
    test("5 of 10 = 50%", () => expect(assessmentsPct(5, 10)).toBe(50));
    test("10 of 10 = 100%", () => expect(assessmentsPct(10, 10)).toBe(100));
    test("12 of 10 = 100% (cap)", () => expect(assessmentsPct(12, 10)).toBe(100));
    test("7 of 20 = 35%", () => expect(assessmentsPct(7, 20)).toBe(35));
});

// ─── AI Cost ─────────────────────────────────────────────────────────────────

describe("V14 Cockpit: AI cost estimation", () => {
    test("0 generations = $0", () => expect(computeAICost(0)).toBe(0));
    test("100 generations = $0.20", () => expect(computeAICost(100)).toBe(0.20));
    test("500 generations = $1.00", () => expect(computeAICost(500)).toBe(1.00));
    test("1 generation = $0.00", () => expect(computeAICost(1)).toBe(0.00));
    test("50 generations = $0.10", () => expect(computeAICost(50)).toBe(0.10));
});

// ─── Action Queue ordering ────────────────────────────────────────────────────

describe("V14 Cockpit: Action queue ordering", () => {
    const mixed = [
        { priority: "medium" },
        { priority: "critical" },
        { priority: "high" },
        { priority: "medium" },
        { priority: "high" },
    ];

    const sorted = buildActionQueueOrder(mixed);

    test("critical comes first", () => expect(sorted[0]).toBe("critical"));
    test("high comes before medium", () => {
        const hiIdx = sorted.indexOf("high");
        const medIdx = sorted.indexOf("medium");
        expect(hiIdx).toBeLessThan(medIdx);
    });
    test("result has 5 items", () => expect(sorted).toHaveLength(5));
    test("empty array stays empty", () => expect(buildActionQueueOrder([])).toHaveLength(0));
});

// ─── Funnel conversion rate ───────────────────────────────────────────────────

describe("V14 Cockpit: Funnel overall conversion rate", () => {
    test("0 of 0 sequences = 0%", () => expect(computeOverallConversionRate(0, 0)).toBe(0));
    test("1 of 10 = 10%", () => expect(computeOverallConversionRate(10, 1)).toBe(10));
    test("5 of 10 = 50%", () => expect(computeOverallConversionRate(10, 5)).toBe(50));
    test("all converted = 100%", () => expect(computeOverallConversionRate(5, 5)).toBe(100));
    test("rounds properly", () => expect(computeOverallConversionRate(3, 1)).toBe(33));
});

// ─── RBAC toggle guard ────────────────────────────────────────────────────────

describe("V14 Cockpit: Toggle RBAC", () => {
    test("owner can toggle", () => expect(canToggle("owner")).toBe(true));
    test("admin can toggle", () => expect(canToggle("admin")).toBe(true));
    test("closer cannot toggle", () => expect(canToggle("closer")).toBe(false));
    test("viewer cannot toggle", () => expect(canToggle("viewer")).toBe(false));
});

// ─── AI toggle key allowlist ──────────────────────────────────────────────────

describe("V14 Cockpit: AI toggle key allowlist", () => {
    test("ai.content_engine allowed", () => expect(toggleGuard("ai.content_engine")).toBe(true));
    test("ai.presales allowed", () => expect(toggleGuard("ai.presales")).toBe(true));
    test("ai.funnel_engine allowed", () => expect(toggleGuard("ai.funnel_engine")).toBe(true));
    test("ai.authority allowed", () => expect(toggleGuard("ai.authority")).toBe(true));
    test("unknown key rejected", () => expect(toggleGuard("ai.unknown")).toBe(false));
    test("empty key rejected", () => expect(toggleGuard("")).toBe(false));
    test("admin.superuser rejected", () => expect(toggleGuard("admin.superuser")).toBe(false));
});

// ─── Health status logic ──────────────────────────────────────────────────────

describe("V14 Cockpit: System health classification", () => {
    function classifyAIHealth(hasKey: boolean): string { return hasKey ? "ok" : "degraded"; }
    function classifyAlertHealth(count: number): string { return count > 0 ? "critical" : "ok"; }
    function classifyFunnelHealth(enabled: boolean): string { return enabled ? "ok" : "off"; }

    test("AI health: has key → ok", () => expect(classifyAIHealth(true)).toBe("ok"));
    test("AI health: no key → degraded", () => expect(classifyAIHealth(false)).toBe("degraded"));
    test("Alert health: 0 alerts → ok", () => expect(classifyAlertHealth(0)).toBe("ok"));
    test("Alert health: 1+ alerts → critical", () => expect(classifyAlertHealth(3)).toBe("critical"));
    test("Funnel health: enabled → ok", () => expect(classifyFunnelHealth(true)).toBe("ok"));
    test("Funnel health: disabled → off", () => expect(classifyFunnelHealth(false)).toBe("off"));
});

// ─── V15 Stub Mode Logic ──────────────────────────────────────────────────────

describe("V15 Cockpit: Stub mode validation", () => {
    function computeStubKeys(openaiKey: string | undefined, metaToken: string | undefined) {
        return {
            "ai.content_engine": !openaiKey,
            "ai.authority": !openaiKey,
            "ai.presales": !openaiKey,
            "ai.funnel_engine": !metaToken
        };
    }

    test("All keys present → No stub mode", () => {
        const result = computeStubKeys("sk-1234", "EAAGmxyz");
        expect(result["ai.content_engine"]).toBe(false);
        expect(result["ai.funnel_engine"]).toBe(false);
    });

    test("OpenAI missing → Content and Authority in stub mode", () => {
        const result = computeStubKeys("", "EAAGmxyz");
        expect(result["ai.content_engine"]).toBe(true);
        expect(result["ai.authority"]).toBe(true);
        expect(result["ai.presales"]).toBe(true);
        expect(result["ai.funnel_engine"]).toBe(false);
    });

    test("Meta missing → Funnel in stub mode", () => {
        const result = computeStubKeys("sk-1234", "");
        expect(result["ai.content_engine"]).toBe(false);
        expect(result["ai.funnel_engine"]).toBe(true);
    });

    test("Both missing → All in stub mode", () => {
        const result = computeStubKeys("", undefined);
        expect(Object.values(result).every(v => v === true)).toBe(true);
    });
});
