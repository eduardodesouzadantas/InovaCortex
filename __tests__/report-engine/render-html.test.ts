import { renderBusinessMRIHtml } from "@/lib/report-engine/render-html";
import type { NormalizedBusinessMRIReportData } from "@/lib/report-engine/types";

describe("renderBusinessMRIHtml", () => {
    it("renders all required report pages and chart canvases", async () => {
        const input: NormalizedBusinessMRIReportData = {
            tenantId: "org_test",
            reportId: "rep_123",
            companyName: "Acme Ltda",
            generatedAtIso: "2026-03-12T10:00:00.000Z",
            generatedAtLabel: "12/03/2026",
            classification: "Alta prioridade",
            scoreTotal: 82,
            summary: "Resumo executivo para validacao.",
            recommendedMissions: ["Automacao de atendimento", "Follow-up comercial"],
            pains: ["Retrabalho manual", "Perda de leads"],
            risks: ["Dados inconsistentes", "Baixa adocao interna"],
            roadmap: [
                {
                    phase: "Fase 1",
                    title: "Discovery",
                    description: "Mapeamento de processos",
                    owner: "PM",
                    eta: "Semana 1",
                },
            ],
            blueprint: {
                modules: ["CRM", "Ops Intelligence"],
                integrations: ["WhatsApp", "ERP"],
                architectureNotes: ["Auditoria por tenant"],
            },
            roi: {
                operationalSavingsEstimate: 45000,
                revenueIncreaseEstimate: 32000,
                monthlyHoursRecovered: 160,
                estimatedPaybackMonths: 1.9,
                confidenceLevel: "Alta",
                savingsRange: "R$ 38k - R$ 52k",
                revenueRange: "R$ 27k - R$ 37k",
                hoursRange: "130 - 180 horas",
            },
        };

        const html = await renderBusinessMRIHtml(input);

        expect(html).toContain("Pagina 2");
        expect(html).toContain("Pagina 9");
        expect(html).toContain("chart-automation-score");
        expect(html).toContain("chart-financial-impact");
        expect(html).toContain("chart-operational-efficiency");
        expect(html).toContain("InovaCortex AI Business MRI");
    });
});
