/**
 * __tests__/roi-engine.test.ts
 * Tests for lib/roi-engine.ts deterministic ROI calculator.
 *
 * Run: npx jest __tests__/roi-engine.test.ts
 */

import { calculateROI, ROIInput } from "../lib/roi-engine";

const baseInput: ROIInput = {
    teamSize: "6-20",
    volumeDay: "50-200",
    scoreTotal: 70,
    classification: "Alta prioridade",
    pains: ["Atendimento lento", "Perda de leads"],
};

describe("ROI Engine", () => {
    test("returns all expected fields", () => {
        const result = calculateROI(baseInput);
        expect(result).toHaveProperty("operationalSavingsEstimate");
        expect(result).toHaveProperty("revenueIncreaseEstimate");
        expect(result).toHaveProperty("monthlyHoursRecovered");
        expect(result).toHaveProperty("estimatedPaybackMonths");
        expect(result).toHaveProperty("confidenceLevel");
        expect(result).toHaveProperty("savingsRange");
        expect(result).toHaveProperty("hoursRange");
    });

    test("higher score produces higher savings", () => {
        const low = calculateROI({ ...baseInput, scoreTotal: 20 });
        const high = calculateROI({ ...baseInput, scoreTotal: 90 });
        expect(high.operationalSavingsEstimate).toBeGreaterThan(low.operationalSavingsEstimate);
    });

    test("larger team produces more hours recovered", () => {
        const small = calculateROI({ ...baseInput, teamSize: "1-5" });
        const large = calculateROI({ ...baseInput, teamSize: "100+" });
        expect(large.monthlyHoursRecovered).toBeGreaterThan(small.monthlyHoursRecovered);
    });

    test("more pains produce higher savings via multiplier", () => {
        const noPains = calculateROI({ ...baseInput, pains: [] });
        const allPains = calculateROI({
            ...baseInput, pains: [
                "Atendimento lento", "Perda de leads", "Retrabalho manual",
                "Falta de follow-up", "Sem CRM"
            ]
        });
        expect(allPains.operationalSavingsEstimate).toBeGreaterThan(noPains.operationalSavingsEstimate);
    });

    test("confidence level is 'Alta' for high score + large team", () => {
        const result = calculateROI({ ...baseInput, scoreTotal: 80, teamSize: "21-100" });
        expect(result.confidenceLevel).toBe("Alta");
    });

    test("confidence level is 'Baixa' for very low score", () => {
        const result = calculateROI({ ...baseInput, scoreTotal: 25 });
        expect(result.confidenceLevel).toBe("Baixa");
    });

    test("custom avgHourlyCost increases savings", () => {
        const cheap = calculateROI({ ...baseInput, avgHourlyCost: 50 });
        const expensive = calculateROI({ ...baseInput, avgHourlyCost: 200 });
        expect(expensive.operationalSavingsEstimate).toBeGreaterThan(cheap.operationalSavingsEstimate);
    });

    test("payback is positive and reasonable", () => {
        const result = calculateROI(baseInput);
        expect(result.estimatedPaybackMonths).toBeGreaterThan(0);
        expect(result.estimatedPaybackMonths).toBeLessThan(50);
    });

    test("savingsRange includes formatted numbers", () => {
        const result = calculateROI(baseInput);
        expect(result.savingsRange).toContain("k");
    });

    test("all numeric results are positive", () => {
        const result = calculateROI(baseInput);
        expect(result.operationalSavingsEstimate).toBeGreaterThanOrEqual(0);
        expect(result.revenueIncreaseEstimate).toBeGreaterThanOrEqual(0);
        expect(result.monthlyHoursRecovered).toBeGreaterThanOrEqual(0);
    });
});
