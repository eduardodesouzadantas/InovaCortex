/**
 * __tests__/proposal-engine.test.ts
 * Tests for lib/proposal-engine.ts deterministic proposal generator.
 *
 * Run: npx jest __tests__/proposal-engine.test.ts
 */

import { generateProposal, formatPricingRange } from "../lib/proposal-engine";

const mockAssessment = {
    id: "test-assessment-id-123",
    name: "Eduardo Costa",
    company: "AcmeCorp",
    role: "CEO",
    segment: "E-commerce",
    teamSize: "6-20",
    volumeDay: "50-200",
    scoreTotal: 75,
    classification: "Alta prioridade",
    pains: JSON.stringify(["Atendimento lento", "Perda de leads", "Sem CRM"]),
    channels: JSON.stringify(["WhatsApp", "Instagram"]),
    urgency: "Alta - Imediato",
    goal: "Escalar sem contratar",
};

const mockROI = {
    operationalSavingsEstimate: 28000,
    revenueIncreaseEstimate: 9500,
    estimatedPaybackMonths: 0.4,
    confidenceLevel: "Alta",
};

const mockPreSales = {
    executiveSummary: "Resumo executivo de teste para a AcmeCorp...",
    diagnosticQuestions: JSON.stringify(["Pergunta 1?", "Pergunta 2?"]),
};

describe("Proposal Engine", () => {
    test("generates a valid proposal with all required fields", () => {
        const p = generateProposal({
            assessment: mockAssessment,
            roiProjection: mockROI,
            lastPreSales: mockPreSales,
            existingVersion: 0,
        });
        expect(p).toHaveProperty("modules");
        expect(p).toHaveProperty("pricingEstimate");
        expect(p).toHaveProperty("timeline");
        expect(p).toHaveProperty("roiSnapshot");
        expect(p).toHaveProperty("publicSlug");
        expect(p.version).toBe(1);
    });

    test("includes WhatsApp/Instagram module for matching channels", () => {
        const p = generateProposal({
            assessment: mockAssessment,
            roiProjection: mockROI,
            lastPreSales: null,
        });
        const multicanalModule = p.modules.find(m => m.title.includes("Multicanal"));
        expect(multicanalModule).toBeDefined();
        expect(multicanalModule?.included).toBe(true);
    });

    test("includes Mission Control for high score (≥65)", () => {
        const p = generateProposal({
            assessment: mockAssessment,   // scoreTotal = 75
            roiProjection: mockROI,
            lastPreSales: null,
        });
        expect(p.modules.some(m => m.title.includes("Mission Control"))).toBe(true);
    });

    test("does NOT include Mission Control for low score (<65)", () => {
        const p = generateProposal({
            assessment: { ...mockAssessment, scoreTotal: 40, classification: "Exploratória" },
            roiProjection: mockROI,
            lastPreSales: null,
        });
        expect(p.modules.some(m => m.title.includes("Mission Control"))).toBe(false);
    });

    test("pricing min < max and both are positive", () => {
        const p = generateProposal({ assessment: mockAssessment, roiProjection: mockROI, lastPreSales: null });
        expect(p.pricingEstimate.minBRL).toBeGreaterThan(0);
        expect(p.pricingEstimate.maxBRL).toBeGreaterThan(p.pricingEstimate.minBRL);
    });

    test("pricing scales up for larger teams", () => {
        const smallTeam = generateProposal({ assessment: { ...mockAssessment, teamSize: "1-5" }, roiProjection: mockROI, lastPreSales: null });
        const largeTeam = generateProposal({ assessment: { ...mockAssessment, teamSize: "100+" }, roiProjection: mockROI, lastPreSales: null });
        expect(largeTeam.pricingEstimate.minBRL).toBeGreaterThan(smallTeam.pricingEstimate.minBRL);
    });

    test("version increments correctly", () => {
        const v1 = generateProposal({ assessment: mockAssessment, roiProjection: mockROI, lastPreSales: null, existingVersion: 0 });
        const v2 = generateProposal({ assessment: mockAssessment, roiProjection: mockROI, lastPreSales: null, existingVersion: 1 });
        expect(v1.version).toBe(1);
        expect(v2.version).toBe(2);
        expect(v1.publicSlug).not.toBe(v2.publicSlug);
    });

    test("executive summary mentions company and classification", () => {
        const p = generateProposal({ assessment: mockAssessment, roiProjection: mockROI, lastPreSales: null });
        expect(p.executiveSummary).toContain("AcmeCorp");
        expect(p.executiveSummary).toContain("Alta prioridade");
    });

    test("timeline has at least 3 phases", () => {
        const p = generateProposal({ assessment: mockAssessment, roiProjection: mockROI, lastPreSales: null });
        expect(p.timeline.length).toBeGreaterThanOrEqual(3);
    });

    test("ROI snapshot mirrors input projections", () => {
        const p = generateProposal({ assessment: mockAssessment, roiProjection: mockROI, lastPreSales: null });
        expect(p.roiSnapshot.operationalSavings).toBe(28000);
        expect(p.roiSnapshot.paybackMonths).toBe(0.4);
    });

    test("formatPricingRange returns BRL formatted string", () => {
        const p = generateProposal({ assessment: mockAssessment, roiProjection: mockROI, lastPreSales: null });
        const range = formatPricingRange(p.pricingEstimate);
        expect(range).toContain("R$");
        expect(range).toContain("–");
    });
});
