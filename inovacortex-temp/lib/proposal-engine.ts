/**
 * lib/proposal-engine.ts
 * Deterministic Proposal Generator — zero LLM.
 *
 * Combines:
 *  - Assessment (score, team, segment, goals, pains)
 *  - ROIProjection (financial impact)
 *  - PreSalesArtifact (optional AI-generated context)
 *
 * Produces a fully structured, versioned, reproducible proposal with:
 *  - Module list + descriptions
 *  - Investment range (min-max)
 *  - Timeline (weeks)
 *  - ROI + Payback snapshots
 */

import crypto from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProposalModule {
    id: string;
    title: string;
    description: string;
    deliverables: string[];
    estimatedWeeks: number;
    basePrice: number;       // BRL
    included: boolean;       // Default true; admin can toggle
}

export interface PricingEstimate {
    minBRL: number;
    maxBRL: number;
    currency: "BRL";
    basis: string;          // e.g., "3 módulos × complexidade Alta"
}

export interface ProposalTimeline {
    phase: string;
    weeks: string;
    deliverables: string[];
}

export interface GeneratedProposal {
    publicSlug: string;
    version: number;
    executiveSummary: string;
    modules: ProposalModule[];
    timeline: ProposalTimeline[];
    pricingEstimate: PricingEstimate;
    roiSnapshot: {
        operationalSavings: number;
        revenueIncrease: number;
        paybackMonths: number;
        confidenceLevel: string;
    };
    presalesSnapshot: {
        executiveSummary?: string;
        diagnosticQuestions?: string[];
    };
}

// ─── Module Catalog ───────────────────────────────────────────────────────────

const MODULE_CATALOG: Omit<ProposalModule, "included" | "id">[] = [
    {
        title: "Agente de Atendimento Multicanal",
        description: "IA conversacional para WhatsApp, Instagram e Web, com triagem automática e deflexão de 60–80% das demandas repetitivas.",
        deliverables: ["Bot treinado", "Fluxos conversacionais", "Dashboard de métricas", "Relatórios semanais"],
        estimatedWeeks: 2,
        basePrice: 6500,
    },
    {
        title: "Agente de Qualificação de Leads",
        description: "Captura, qualifica e pontua leads automaticamente antes de repassar para o time comercial.",
        deliverables: ["Pipeline de qualificação", "Integração CRM", "Score automático", "Alertas em tempo real"],
        estimatedWeeks: 2,
        basePrice: 5500,
    },
    {
        title: "Integração & Orquestração de Sistemas",
        description: "Conexão entre CRM, ERP, ferramentas de marketing e canais digitais via APIs e webhooks.",
        deliverables: ["Mapa de integrações", "Flows Make/n8n", "Documentação técnica", "Testes end-to-end"],
        estimatedWeeks: 3,
        basePrice: 7000,
    },
    {
        title: "Mission Control Dashboard",
        description: "Painel centralizado de monitoramento com métricas de automação em tempo real.",
        deliverables: ["Dashboard personalizado", "Alertas KPI", "Relatórios executivos mensais"],
        estimatedWeeks: 2,
        basePrice: 4500,
    },
    {
        title: "Automação de Follow-Up Comercial",
        description: "Sequências automáticas de follow-up por WhatsApp e email baseadas em comportamento do lead.",
        deliverables: ["Régua de comunicação", "Templates aprovados", "A/B testing básico"],
        estimatedWeeks: 1,
        basePrice: 3500,
    },
    {
        title: "Relatórios & Observabilidade",
        description: "Estrutura de dados e relatórios para acompanhar KPIs de automação, conversão e atendimento.",
        deliverables: ["Dashboards analytics", "Relatório executivo mensal", "Alertas automáticos"],
        estimatedWeeks: 2,
        basePrice: 4000,
    },
];

// ─── Pricing Tables ───────────────────────────────────────────────────────────

const COMPLEXITY_MULTIPLIER: Record<string, number> = {
    "Alta prioridade": 1.4,
    "Boa oportunidade": 1.2,
    "Exploratória": 1.0,
};

const TEAM_SIZE_MULTIPLIER: Record<string, number> = {
    "1-5": 0.9,
    "6-20": 1.0,
    "21-100": 1.3,
    "100+": 1.6,
};

// ─── Selection Logic ─────────────────────────────────────────────────────────

function selectModules(
    scoreTotal: number,
    pains: string[],
    channels: string[],
): ProposalModule[] {
    const selected: ProposalModule[] = [];

    // Always include multicanal if WhatsApp/Instagram in channels
    if (channels.some(c => c.toLowerCase().includes("whatsapp") || c.toLowerCase().includes("instagram"))) {
        selected.push({ ...MODULE_CATALOG[0], id: "m1", included: true });
    }

    // Lead qualification for high score leads
    if (scoreTotal >= 50) {
        selected.push({ ...MODULE_CATALOG[1], id: "m2", included: true });
    }

    // Integration layer for medium-high complexity
    if (scoreTotal >= 55 || pains.some(p => p.toLowerCase().includes("crm") || p.toLowerCase().includes("integr"))) {
        selected.push({ ...MODULE_CATALOG[2], id: "m3", included: true });
    }

    // Mission Control for high-priority leads
    if (scoreTotal >= 65) {
        selected.push({ ...MODULE_CATALOG[3], id: "m4", included: true });
    }

    // Follow-up automation base module always included
    selected.push({ ...MODULE_CATALOG[4], id: "m5", included: true });

    // Reports for enterprise-level
    if (scoreTotal >= 70) {
        selected.push({ ...MODULE_CATALOG[5], id: "m6", included: true });
    }

    // Ensure at least 2 modules
    if (selected.length < 2) {
        if (!selected.find(m => m.id === "m1")) {
            selected.push({ ...MODULE_CATALOG[0], id: "m1", included: true });
        }
    }

    return selected;
}

// ─── Main Function ────────────────────────────────────────────────────────────

interface GenerateProposalInput {
    assessment: any;
    roiProjection: any;
    lastPreSales: any | null;
    existingVersion?: number;
}

export function generateProposal({
    assessment,
    roiProjection,
    lastPreSales,
    existingVersion = 0,
}: GenerateProposalInput): GeneratedProposal {
    const pains: string[] = JSON.parse(assessment.pains || "[]");
    const channels: string[] = JSON.parse(assessment.channels || "[]");

    // 1. Select modules
    const modules = selectModules(assessment.scoreTotal, pains, channels);

    // 2. Pricing
    const complexityMult = COMPLEXITY_MULTIPLIER[assessment.classification] ?? 1.2;
    const teamMult = TEAM_SIZE_MULTIPLIER[assessment.teamSize] ?? 1.0;

    const baseSum = modules.reduce((s, m) => s + m.basePrice, 0);
    const adjustedMin = Math.round(baseSum * complexityMult * teamMult * 0.90);
    const adjustedMax = Math.round(baseSum * complexityMult * teamMult * 1.30);

    const pricingEstimate: PricingEstimate = {
        minBRL: adjustedMin,
        maxBRL: adjustedMax,
        currency: "BRL",
        basis: `${modules.length} módulos × complexidade ${assessment.classification} × equipe ${assessment.teamSize}`,
    };

    // 3. Timeline
    let week = 1;
    const timeline: ProposalTimeline[] = [
        {
            phase: "Fase 0 — Discovery & Setup",
            weeks: `Semana 1`,
            deliverables: ["Kick-off", "Levantamento de requisitos", "Acesso a sistemas", "Alinhamento de KPIs"],
        },
        ...modules.map(m => {
            const start = week + 1;
            week += m.estimatedWeeks;
            return {
                phase: m.title,
                weeks: `Semana ${start}–${start + m.estimatedWeeks - 1}`,
                deliverables: m.deliverables,
            };
        }),
        {
            phase: "Fase Final — Go-Live & Handover",
            weeks: `Semana ${week + 2}`,
            deliverables: ["Testes de aceitação", "Treinamento da equipe", "Documentação completa", "Suporte 30 dias"],
        },
    ];

    // 4. Executive summary
    const executiveSummary =
        `Com base no diagnóstico realizado, identificamos que ${assessment.company} está em estágio ` +
        `"${assessment.classification}" no mapa de maturidade digital da InovaCortex (Score: ${assessment.scoreTotal}/100). ` +
        `O presente plano propõe a implementação de ${modules.length} módulos de automação com IA, ` +
        `projetando uma economia operacional de R$ ${roiProjection?.operationalSavingsEstimate?.toLocaleString("pt-BR") ?? "—"}/mês ` +
        `e receita incremental de R$ ${roiProjection?.revenueIncreaseEstimate?.toLocaleString("pt-BR") ?? "—"}/mês. ` +
        `O payback estimado é de ${roiProjection?.estimatedPaybackMonths ?? "—"} ${Number(roiProjection?.estimatedPaybackMonths) === 1 ? "mês" : "meses"}, ` +
        `com nível de confiança "${roiProjection?.confidenceLevel ?? "Média"}".`;

    // 5. Public slug (stable per version)
    const slugBase = `${assessment.id.slice(0, 8)}-v${existingVersion + 1}`;
    const publicSlug = `${slugBase}-${crypto.createHash("sha1").update(slugBase).digest("hex").slice(0, 6)}`;

    return {
        publicSlug,
        version: existingVersion + 1,
        executiveSummary,
        modules,
        timeline,
        pricingEstimate,
        roiSnapshot: {
            operationalSavings: roiProjection?.operationalSavingsEstimate ?? 0,
            revenueIncrease: roiProjection?.revenueIncreaseEstimate ?? 0,
            paybackMonths: roiProjection?.estimatedPaybackMonths ?? 0,
            confidenceLevel: roiProjection?.confidenceLevel ?? "Média",
        },
        presalesSnapshot: {
            executiveSummary: lastPreSales?.executiveSummary ?? undefined,
            diagnosticQuestions: lastPreSales ? JSON.parse(lastPreSales.diagnosticQuestions) : undefined,
        },
    };
}

// ─── Pricing Format Helpers ───────────────────────────────────────────────────

export function formatPricingRange(p: PricingEstimate): string {
    const fmt = (n: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
    return `${fmt(p.minBRL)} – ${fmt(p.maxBRL)}`;
}
