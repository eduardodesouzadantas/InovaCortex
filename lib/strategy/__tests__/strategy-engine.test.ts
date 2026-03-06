import { describe, it, expect } from "vitest";
import { detectBottlenecks, generateRecommendations, StrategyKPIs } from "../strategy-engine";

describe("Strategy Engine Logic", () => {
    const mockBenchmarks = {
        proposalAcceptanceRate: 40,
        pipelineVelocityDays: 10,
        averageDealSize: 5000,
        meetingShowRate: 80
    };

    it("should detect acceptance bottleneck when below benchmark", () => {
        const kpis: StrategyKPIs = {
            proposalAcceptanceRate: 30, // 30 < 40 * 0.9 (36)
            pipelineVelocityDays: 8,
            averageDealSize: 6000,
            meetingShowRate: 85
        };

        const bottlenecks = detectBottlenecks(kpis, mockBenchmarks);
        expect(bottlenecks.some(b => b.type === 'acceptance')).toBe(true);
        expect(bottlenecks.find(b => b.type === 'acceptance')?.severity).toBe('warning');
    });

    it("should detect critical acceptance bottleneck when way below benchmark", () => {
        const kpis: StrategyKPIs = {
            proposalAcceptanceRate: 15, // 15 < 40 * 0.6 (24)
            pipelineVelocityDays: 8,
            averageDealSize: 6000,
            meetingShowRate: 85
        };

        const bottlenecks = detectBottlenecks(kpis, mockBenchmarks);
        expect(bottlenecks.find(b => b.type === 'acceptance')?.severity).toBe('critical');
    });

    it("should detect velocity bottleneck when cycle is too long", () => {
        const kpis: StrategyKPIs = {
            proposalAcceptanceRate: 45,
            pipelineVelocityDays: 15, // 15 > 10 * 1.2 (12)
            averageDealSize: 6000,
            meetingShowRate: 85
        };

        const bottlenecks = detectBottlenecks(kpis, mockBenchmarks);
        expect(bottlenecks.some(b => b.type === 'velocity')).toBe(true);
    });

    it("should generate appropriate recommendations", () => {
        const kpis: StrategyKPIs = {
            proposalAcceptanceRate: 30,
            pipelineVelocityDays: 15,
            averageDealSize: 6000,
            meetingShowRate: 60
        };

        const bottlenecks = detectBottlenecks(kpis, mockBenchmarks);
        const recs = generateRecommendations(kpis, bottlenecks);

        expect(recs.length).toBeGreaterThan(0);
        expect(recs.some(r => r.type === 'revenue')).toBe(true);
        expect(recs.some(r => r.type === 'delivery')).toBe(true);
    });
});
