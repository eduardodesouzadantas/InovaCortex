// Jest globals (describe, it, expect) are available without import
import { calculateScore, AssessmentPayload } from "../lib/scoring";

const basePayload: AssessmentPayload = {
    name: "Test User",
    email: "test@example.com",
    company: "Test Corp",
    role: "CEO",
    segment: "Technology",
    teamSize: "1-10",
    volumeDay: "Menos de 100",
    channels: ["WhatsApp"],
    stack: [],
    pains: ["Baixa conversão de leads"],
    urgency: "Baixa - Exploratória (6 meses+)",
    goal: "Apenas conhecer",
};

describe("Assessment Scoring Engine", () => {
    it("should return a low score and Exploratory classification for basic inputs", () => {
        const result = calculateScore(basePayload);
        expect(result.scoreTotal).toBeLessThan(50);
        expect(result.classification).toBe("Exploratória");
        expect(result.recommendedMissions).toContain("Automação Operacional Básica");
    });

    it("should return a medium score and Good Opportunity for mid-level inputs", () => {
        const payload: AssessmentPayload = {
            ...basePayload,
            volumeDay: "100-500", // A: +10
            channels: ["WhatsApp", "Instagram"], // A: +5
            stack: ["Hubspot CRM", "Make"], // B: +13
            pains: ["Baixa conversão de leads", "Alto custo operacional (faturamento/equipe)"], // C: +15
            urgency: "Média - Próximo trimestre", // D: +8
            goal: "Reduzir tempo de resposta", // E: +10
        };

        // Total should be roughly 10 + 5 + 13 + 15 + 8 + 10 = 61 -> Boa oportunidade (50-74)
        const result = calculateScore(payload);
        expect(result.scoreTotal).toBeGreaterThanOrEqual(50);
        expect(result.scoreTotal).toBeLessThan(75);
        expect(result.classification).toBe("Boa oportunidade");
    });

    it("should return high score and High Priority for heavy operations", () => {
        const payload: AssessmentPayload = {
            ...basePayload,
            volumeDay: "Mais de 500", // A: +15
            channels: ["WhatsApp", "Instagram", "Email", "Telefone"], // A: +10 (cap 25)
            stack: ["Salesforce CRM", "SAP ERP", "Zapier", "API"], // B: +25
            pains: ["Data perdida", "Custo alto", "Retrabalho", "Lentidão"], // C: +20
            urgency: "Alta - Imediato/Para Ontem", // D: +15
            goal: "Aumentar conversão e padronizar com urgência", // E: +15
        };

        // Expected to cap near 100
        const result = calculateScore(payload);
        expect(result.scoreTotal).toBeGreaterThanOrEqual(75);
        expect(result.classification).toBe("Alta prioridade");
    });

    it("should properly recommend Vendas and Suporte for WhatsApp channels aiming for conversion", () => {
        const payload: AssessmentPayload = {
            ...basePayload,
            volumeDay: "100-500",
            channels: ["WhatsApp"],
            goal: "Aumentar conversão de vendas",
        };
        const result = calculateScore(payload);
        expect(result.recommendedMissions).toContain("Vendas");
        expect(result.recommendedMissions).toContain("Suporte");
    });
});
