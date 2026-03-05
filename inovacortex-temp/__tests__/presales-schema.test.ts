/**
 * __tests__/presales-schema.test.ts
 * Tests for the Zod schema validation used in the AI agent output.
 *
 * Run: npx jest __tests__/presales-schema.test.ts
 */

import { PreSalesSchema } from "../lib/ai/agent";

const validOutput = {
    executiveSummary: "A InovaCortex identificou uma oportunidade significativa de automação no fluxo de atendimento desta empresa do segmento de e-commerce. Com base nas respostas da avaliação, o lead demonstra maturidade digital intermediária e urgência alta para escalar sem aumentar equipe. A implementação de agentes de IA nos canais de WhatsApp e Instagram pode reduzir o volume de atendimento humano em até 60%, liberando a equipe para focar em casos complexos e vendas consultivas.",
    diagnosticQuestions: [
        "Qual é o tempo médio de resposta atual para atendimentos via WhatsApp?",
        "Quais os 3 principais motivos de contato dos seus clientes?",
        "Vocês já utilizam algum tipo de automação ou chatbot atualmente?",
        "Qual o CRM atual e qual o nível de adoção pela equipe de vendas?",
        "Qual seria o KPI de sucesso para o primeiro trimestre pós-implementação?",
    ],
    architectureProposal: {
        modules: [
            { title: "Agente de Triagem WhatsApp", description: "Classifica e responde automaticamente as 20 perguntas mais frequentes." },
            { title: "Agente de Qualificação de Lead", description: "Captura dados, pontua e encaminha leads quentes para o consultor." },
            { title: "Integração CRM", description: "Sincroniza dados de atendimento com HubSpot em tempo real." },
        ],
        integrations: ["WhatsApp Business API", "HubSpot CRM", "Make (Integromat)"],
        roadmap: [
            { week: "Semana 1-2", action: "Mapeamento de fluxos de atendimento e top 20 perguntas" },
            { week: "Semana 3-4", action: "Deploy do agente de triagem com supervisão humana" },
            { week: "Semana 5-6", action: "Integração CRM e treinamento da equipe" },
            { week: "Semana 7-8", action: "Go-live completo e monitoramento de KPIs" },
        ],
    },
};

describe("PreSalesSchema validation", () => {
    test("accepts a valid complete output", () => {
        expect(() => PreSalesSchema.parse(validOutput)).not.toThrow();
    });

    test("rejects output with executiveSummary too short", () => {
        expect(() =>
            PreSalesSchema.parse({ ...validOutput, executiveSummary: "Curto demais." })
        ).toThrow();
    });

    test("rejects output with fewer than 5 diagnosticQuestions", () => {
        expect(() =>
            PreSalesSchema.parse({ ...validOutput, diagnosticQuestions: ["Q1", "Q2"] })
        ).toThrow();
    });

    test("rejects output with missing architectureProposal.modules", () => {
        const broken = {
            ...validOutput,
            architectureProposal: {
                ...validOutput.architectureProposal,
                modules: [],
            },
        };
        expect(() => PreSalesSchema.parse(broken)).toThrow();
    });

    test("rejects output with empty integrations array", () => {
        const broken = {
            ...validOutput,
            architectureProposal: {
                ...validOutput.architectureProposal,
                integrations: [],
            },
        };
        expect(() => PreSalesSchema.parse(broken)).toThrow();
    });

    test("returns typed object on valid parse", () => {
        const result = PreSalesSchema.parse(validOutput);
        expect(result.diagnosticQuestions).toHaveLength(5);
        expect(result.architectureProposal.modules[0].title).toBe("Agente de Triagem WhatsApp");
    });
});
