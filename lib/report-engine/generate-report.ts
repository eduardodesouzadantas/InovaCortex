import { generatePdfFromHtml } from "@/lib/report-engine/pdf-generator";
import { renderBusinessMRIHtml } from "@/lib/report-engine/render-html";
import type { BusinessMRIReportData, BusinessMRIRoadmapItem, NormalizedBusinessMRIReportData } from "@/lib/report-engine/types";

export type { BusinessMRIReportData } from "@/lib/report-engine/types";

export async function generateBusinessMRIReport(data: BusinessMRIReportData): Promise<Buffer> {
    const normalized = normalizeInput(data);
    const html = await renderBusinessMRIHtml(normalized);
    return generatePdfFromHtml({
        html,
        companyName: normalized.companyName,
        reportId: normalized.reportId,
    });
}

function normalizeInput(data: BusinessMRIReportData): NormalizedBusinessMRIReportData {
    if (!data.tenantId || !data.reportId) {
        throw new Error("Tenant and report identifiers are required for PDF generation.");
    }
    if (!data.companyName.trim()) {
        throw new Error("Company name is required for PDF generation.");
    }

    const generatedDate = resolveDate(data.generatedAt);
    const roadmap = normalizeRoadmap(data.roadmap);

    return {
        tenantId: data.tenantId.trim(),
        reportId: data.reportId.trim(),
        companyName: data.companyName.trim(),
        generatedAtIso: generatedDate.toISOString(),
        generatedAtLabel: generatedDate.toLocaleDateString("pt-BR"),
        classification: safeText(data.classification, "Oportunidade de automacao"),
        scoreTotal: clampNumber(data.scoreTotal, 0, 100),
        summary: safeText(
            data.summary,
            "O diagnostico aponta oportunidades consistentes para reduzir gargalos operacionais e acelerar crescimento com automacao orientada a dados."
        ),
        recommendedMissions: normalizeStringList(data.recommendedMissions, [
            "Automacao de atendimento e follow-up comercial",
            "Dashboard de performance em tempo real",
            "Orquestracao de playbooks operacionais",
        ]),
        pains: normalizeStringList(data.pains, [
            "Baixa previsibilidade de pipeline",
            "Retrabalho manual em rotinas operacionais",
            "Perda de velocidade em atendimento",
        ]),
        risks: normalizeStringList(data.risks, [
            "Atraso na adocao de novos fluxos pela equipe",
            "Dependencia de dados com qualidade irregular",
            "Falhas de handoff entre areas",
        ]),
        roadmap,
        blueprint: {
            modules: normalizeStringList(data.blueprint?.modules ?? [], ["Core CRM", "Ops Intelligence", "Workflow Automation"]),
            integrations: normalizeStringList(data.blueprint?.integrations ?? [], ["WhatsApp", "Calendario", "Financeiro"]),
            architectureNotes: normalizeStringList(
                data.blueprint?.architectureNotes ?? [],
                ["Padronizar trilha de auditoria por tenant", "Monitorar SLAs com alarmes proativos"]
            ),
        },
        roi: {
            operationalSavingsEstimate: safeMoney(data.roi?.operationalSavingsEstimate),
            revenueIncreaseEstimate: safeMoney(data.roi?.revenueIncreaseEstimate),
            monthlyHoursRecovered: safeMoney(data.roi?.monthlyHoursRecovered),
            estimatedPaybackMonths: clampNumber(data.roi?.estimatedPaybackMonths ?? 0, 0, 60),
            confidenceLevel: safeText(data.roi?.confidenceLevel ?? "", "Media"),
            savingsRange: safeOptionalText(data.roi?.savingsRange),
            revenueRange: safeOptionalText(data.roi?.revenueRange),
            hoursRange: safeOptionalText(data.roi?.hoursRange),
        },
    };
}

function resolveDate(value: string | Date | undefined): Date {
    if (!value) return new Date();
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function normalizeRoadmap(items: BusinessMRIRoadmapItem[]): BusinessMRIRoadmapItem[] {
    if (!Array.isArray(items) || items.length === 0) {
        return [
            {
                phase: "Fase 1",
                title: "Discovery e baseline",
                description: "Mapear processos, metas e fontes de dados com sponsors de negocio.",
                owner: "Product + Operacoes",
                eta: "Semana 1",
            },
            {
                phase: "Fase 2",
                title: "Quick wins de automacao",
                description: "Executar automacoes de alto impacto em receita, SLA e custo operacional.",
                owner: "Squad de Implantacao",
                eta: "Semanas 2-3",
            },
            {
                phase: "Fase 3",
                title: "Escala e governanca",
                description: "Ampliar cobertura, instrumentar alertas e consolidar governanca por indicadores.",
                owner: "Lider de Operacoes",
                eta: "Semana 4",
            },
        ];
    }

    return items.slice(0, 10).map((item, index) => ({
        phase: safeText(item.phase, `Fase ${index + 1}`),
        title: safeText(item.title, "Iniciativa"),
        description: safeText(item.description, "Descricao nao informada"),
        owner: safeOptionalText(item.owner),
        eta: safeOptionalText(item.eta),
    }));
}

function normalizeStringList(items: string[], fallback: string[]): string[] {
    const values = Array.isArray(items) ? items : [];
    const cleaned = values.map((item) => item.trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned.slice(0, 14) : fallback;
}

function safeText(value: string, fallback: string): string {
    const cleaned = typeof value === "string" ? value.trim() : "";
    return cleaned.length > 0 ? cleaned : fallback;
}

function safeOptionalText(value: string | undefined): string | undefined {
    if (typeof value !== "string") return undefined;
    const cleaned = value.trim();
    return cleaned.length > 0 ? cleaned : undefined;
}

function safeMoney(value: number | undefined): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Number(value));
}

function clampNumber(value: number, min: number, max: number): number {
    const safeValue = Number.isFinite(value) ? Number(value) : min;
    return Math.max(min, Math.min(max, safeValue));
}
