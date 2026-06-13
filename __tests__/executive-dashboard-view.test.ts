jest.mock("next/link", () => {
    const ReactModule = jest.requireActual<typeof import("react")>("react");
    return {
        __esModule: true,
        default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
            ReactModule.createElement("a", { href, ...props }, children),
    };
});

import { renderToStaticMarkup } from "react-dom/server";
import { ExecutiveDashboardView } from "../app/org/[slug]/executive/_components/executive-dashboard-view";
import type { ExecutiveDashboardModel } from "../lib/executive/tenant-intelligence";

function createDashboard(overrides: Partial<ExecutiveDashboardModel> = {}): ExecutiveDashboardModel {
    return {
        org: {
            id: "org-a",
            slug: "acme",
            name: "Acme Corp",
            plan: "growth",
        },
        generatedAt: "2026-03-16T12:00:00.000Z",
        hasData: true,
        emptyReason: null,
        overview: {
            headline: "Leitura executiva de Acme Corp",
            subheadline: "Dados reais conectados ao backend operacional.",
        },
        headlineMetrics: [
            {
                id: "pipeline-open",
                label: "Pipeline Aberto",
                value: "12",
                tone: "neutral",
                detail: "3 propostas ativas",
            },
            {
                id: "revenue-opportunity",
                label: "Oportunidade de Receita",
                value: "R$ 120.000",
                tone: "positive",
                detail: "2 deals com alta probabilidade",
            },
        ],
        summaryCards: [
            {
                id: "reply-time",
                title: "Tempo Medio de Resposta",
                value: "24 min",
                detail: "Baseado em conversas reais",
                tone: "positive",
            },
            {
                id: "show-rate",
                title: "Show Rate",
                value: "80,0%",
                detail: "6 reunioes no periodo",
                tone: "positive",
            },
        ],
        recentSeries: {
            label: "Ultimas 4 semanas",
            insight: "A serie curta sugere aceleracao recente com risco sob controle.",
            hasData: true,
            points: [
                {
                    id: "w1",
                    label: "17 fev-23 fev",
                    shortLabel: "S1",
                    revenueClosedCents: 900000,
                    proposalsSent: 2,
                    acceptedProposals: 0,
                    activities: 5,
                    criticalAlerts: 2,
                },
                {
                    id: "w2",
                    label: "24 fev-02 mar",
                    shortLabel: "S2",
                    revenueClosedCents: 1200000,
                    proposalsSent: 3,
                    acceptedProposals: 1,
                    activities: 6,
                    criticalAlerts: 1,
                },
                {
                    id: "w3",
                    label: "03 mar-09 mar",
                    shortLabel: "S3",
                    revenueClosedCents: 1800000,
                    proposalsSent: 4,
                    acceptedProposals: 1,
                    activities: 7,
                    criticalAlerts: 1,
                },
                {
                    id: "w4",
                    label: "10 mar-16 mar",
                    shortLabel: "S4",
                    revenueClosedCents: 2400000,
                    proposalsSent: 5,
                    acceptedProposals: 2,
                    activities: 8,
                    criticalAlerts: 0,
                },
            ],
        },
        trendComparison: {
            currentLabel: "Ultimos 14 dias",
            previousLabel: "14 dias anteriores",
            items: [
                {
                    id: "revenue-velocity",
                    label: "Receita fechada",
                    current: "R$ 42.000",
                    previous: "R$ 20.000",
                    delta: "+R$ 22.000",
                    direction: "up",
                    tone: "positive",
                    insight: "A receita recente ganhou tracao na janela curta.",
                    hasBaseline: true,
                },
                {
                    id: "risk-pressure",
                    label: "Pressao de alertas",
                    current: "1",
                    previous: "3",
                    delta: "-2",
                    direction: "down",
                    tone: "positive",
                    insight: "A pressao de risco reduziu na janela recente.",
                    hasBaseline: true,
                },
            ],
        },
        revenueIntelligence: {
            tone: "warning",
            outlook: "A leitura de receita segue fragil: existe tracao, mas o curto prazo perdeu consistencia.",
            pipelineDirection: "A entrada recente de propostas acelerou e sustenta pipeline futuro.",
            riskNarrative: "R$ 18.000 ja aparece sob pressao entre vazamentos abertos e perda recente de receita.",
            focus: "Concentrar a lideranca nos 1 deals quentes antes de abrir nova frente.",
            warRoomSnapshot: {
                estimatedOpenRevenue: "R$ 9.000",
                estimatedRevenueAtRisk: "R$ 1.800",
                riskShare: "20,0%",
                momentumDirection: "Momentum em queda",
                stagnantStage: "Proposal",
                topRiskStage: "Proposal",
                topRiskOwner: "Joao",
                primaryFocus: "Concentrar a lideranca nos 1 deals quentes antes de abrir nova frente.",
            },
            immediateFocus: [
                {
                    id: "proposals-without-response",
                    label: "Propostas sem resposta",
                    count: 1,
                    value: "",
                    detail: "Threshold: 3 dias",
                    suggestedAction: "Reengajar propostas sem resposta com sequencia de follow-up imediata.",
                    tone: "warning",
                },
            ],
            signals: [
                {
                    id: "revenue-delta",
                    label: "Delta de receita",
                    value: "+R$ 12.000",
                    detail: "Ultimos 14 dias versus 14 dias anteriores.",
                    tone: "positive",
                },
                {
                    id: "coverage",
                    label: "Cobertura sobre risco",
                    value: "1,2x",
                    detail: "Oportunidade quente dividida pela perda estimada aberta.",
                    tone: "warning",
                },
            ],
        },
        revenueSignals: {
            generatedAt: "2026-03-16T12:00:00.000Z",
            estimatedOpenRevenueCents: 900000,
            estimatedRevenueAtRiskCents: 180000,
            stalledProposals: {
                count: 2,
                valueCents: 150000,
                thresholdDays: 5,
            },
            inactiveDeals: {
                count: 1,
                valueCents: 30000,
                thresholdDays: 7,
            },
            proposalsWithoutResponse: {
                count: 1,
                thresholdDays: 3,
            },
            quietCriticalConversations: {
                count: 1,
                thresholdHours: 24,
            },
            mostStagnantStage: {
                stageId: "stage-proposal",
                stageLabel: "Proposal",
                stalledCount: 2,
                estimatedValueCents: 150000,
            },
            momentum: {
                tone: "warning",
                direction: "down",
                label: "Momentum em queda",
                detail: "A maquina comercial perdeu ritmo recente.",
                proposalEntriesCurrentWindow: 2,
                proposalEntriesPreviousWindow: 4,
                activityEntriesCurrentWindow: 6,
                activityEntriesPreviousWindow: 9,
            },
            topAtRiskOpportunities: [
                {
                    assessmentId: "assessment-1",
                    company: "Initech",
                    dealId: "deal-1",
                    conversationId: "conversation-1",
                    stageLabel: "Proposal",
                    proposalStatus: "viewed",
                    estimatedValueCents: 150000,
                    lastTouchAt: "2026-03-16T10:00:00.000Z",
                    ownerId: "owner-1",
                    ownerLabel: "Joao",
                    riskScore: 11,
                    reason: "Proposta parada ha 6 dias.",
                    recommendedAction: "Cobrar proposta parada agora.",
                },
            ],
            agingBuckets: [
                { bucket: "0-7 dias", count: 1, valueCents: 150000 },
            ],
            riskByStage: [
                { stageId: "stage-proposal", stageLabel: "Proposal", count: 1, valueCents: 150000, riskShare: 1 },
            ],
            riskByOwner: [
                { ownerId: "owner-1", ownerLabel: "Joao", count: 1, valueCents: 150000, riskShare: 1 },
            ],
            conversionTrend: { current: 2, previous: 4, delta: -2, direction: "down", detail: "" },
            summary: {
                tone: "warning",
                headline: "Existe R$ 1.800 em receita aberta pedindo intervencao curta.",
                focus: "Initech: Cobrar proposta parada agora.",
            },
        },
        periodComparison: {
            currentLabel: "Ultimos 30 dias",
            previousLabel: "30 dias anteriores",
            items: [
                {
                    id: "revenue-closed",
                    label: "Receita fechada",
                    current: "R$ 48.000",
                    previous: "R$ 30.000",
                    delta: "+R$ 18.000",
                    direction: "up",
                    tone: "positive",
                    insight: "A receita fechada acelerou versus o periodo anterior.",
                    hasBaseline: true,
                },
                {
                    id: "critical-alerts",
                    label: "Alertas criticos",
                    current: "3",
                    previous: "1",
                    delta: "+2",
                    direction: "up",
                    tone: "critical",
                    insight: "Os sinais criticos aumentaram e pedem triagem executiva.",
                    hasBaseline: true,
                },
            ],
        },
        prioritizedAlerts: [
            {
                id: "alert-1",
                pulseKey: "stalled_deal::proposal stale",
                title: "proposal stale",
                severity: "critical",
                source: "system_event",
                impact: "Risco imediato",
                message: "Propostas travadas ha mais de 72 horas.",
                createdAt: "2026-03-16T10:00:00.000Z",
                whyNow: "Priorizado por ser um sinal critico recente vindo da operacao real.",
                recommendedFocus: "Triar a origem do alerta e cobrar correcao com responsavel claro.",
                status: "open",
                lastActionAt: null,
                lastActionBy: null,
                linkedEntityType: "deal",
                linkedEntityId: "deal-1",
                category: "stalled_deal",
                categoryLabel: "Negocio travado",
                cta: "demand_action",
                ctaLabel: "Cobrar execucao",
            },
        ],
        decisionNarrative: {
            tone: "critical",
            summary: "Acme Corp exige atencao executiva imediata.",
            stateOfPlay: "Nos ultimos 30 dias, o tenant fechou 1 proposta e manteve 12 deals abertos.",
            biggestRisk: "proposal stale: Propostas travadas ha mais de 72 horas.",
            biggestOpportunity: "lead@acme.com concentra R$ 20.000 em oportunidade de curto prazo.",
            focusNow: [
                "proposal stale",
                "Destravar follow-up de lead@acme.com",
            ],
        },
        revenueBrain: {
            totalOpportunity: 150000,
            highProbabilityDeals: [
                {
                    id: "deal-1",
                    email: "lead@acme.com",
                    value: 2000000,
                    probability: 0.83,
                },
            ],
            stalledDeals: [],
            fastWins: [],
            recommendations: [],
        },
        leakDetector: {
            totalLeakValue: 0,
            leakItems: [],
        },
        actionEngine: {
            actions: [
                {
                    label: "Intervir: proposta parada",
                    impact: "Vazamento de Receita",
                    description: "Reengajar propostas visualizadas sem follow-up.",
                    priority: "high",
                },
            ],
        },
        kpis: {
            revenueCents: 0,
            mrrCents: 0,
            pipelineCents: 500000,
            proposalsSent: 3,
            proposalAcceptanceRate: 42,
            meetingShowRate: 80,
            meetingsBooked: 6,
            avgReplyTimeMinutes: 24,
            leaksOpenCents: 0,
            pipelineVelocityDays: 12,
        },
        pipeline: {
            openDeals: 12,
            activeProposals: 3,
            acceptedProposals: 1,
            recentActivities: 9,
        },
        operations: {
            pendingActions: 2,
            openProfitLeaks: 0,
            avgReplyTimeMinutes: 24,
        },
        lossRecovery: {
            totalLosses: 1,
            recoverableLossesValue: "Leitura em curso",
            dominantReason: "NO-RESPONSE",
            topLossStage: "PROPOSAL",
            items: [],
            tone: "neutral",
        },
        growthExpansion: {
            topUpsideOpportunities: [
                {
                    company: "lead@acme.com",
                    estimatedValue: "R$ 20.000",
                    probability: 0.83,
                    recommendedAction: "Priorizar fechamento com time senior.",
                },
            ],
            expansionSignals: [
                {
                    id: "momentum",
                    label: "Momentum em queda",
                    detail: "A maquina comercial perdeu ritmo recente.",
                    tone: "warning",
                },
            ],
            primaryGrowthFront: "Upside concentrado em 1 deal quente",
            mainBottleneck: "Gargalo: stage Proposal",
            executiveAction: "Estabelecer comite de fechamento para lead@acme.com.",
        },
        alerts: [],
        warnings: [],
        ...overrides,
    };
}

describe("Executive dashboard view", () => {
    test("renders decision narrative, comparisons and prioritized alerts", () => {
        const html = renderToStaticMarkup(
            ExecutiveDashboardView({
                data: createDashboard(),
            }),
        );

        expect(html).toContain("Acme Corp");
        expect(html).toContain("Resumo executivo");
        expect(html).toContain("Serie recente");
        expect(html).toContain("Revenue intelligence");
        expect(html).toContain("Revenue engine");
        expect(html).toContain("Growth &amp; Expansion");
        expect(html).toContain("Upside concentrado");
        expect(html).toContain("Oportunidades em risco");
        expect(html).toContain("Top risk stage");
        expect(html).toContain("Top risk owner");
        expect(html).toContain("Tendencia curta");
        expect(html).toContain("Comparativo temporal");
        expect(html).toContain("Receita fechada");
        expect(html).toContain("CEO Pulse");
        expect(html).toContain("proposal stale");
        expect(html).toContain("Negocio travado");
        expect(html).toContain("Cobrar execucao");
        expect(html).toContain("Onde intervir primeiro");
        expect(html).toContain("Aberto");
        expect(html).toContain("Vinculado a deal");
        expect(html).toContain("Acompanhar");
        expect(html).toContain("Delegar");
        expect(html).toContain("Marcar como resolvido");
    });

    test("shows an honest empty-state message when the tenant lacks executive volume", () => {
        const html = renderToStaticMarkup(
            ExecutiveDashboardView({
                data: createDashboard({
                    hasData: false,
                    emptyReason: "Painel conectado, mas ainda sem volume suficiente para leitura confiavel.",
                    recentSeries: {
                        label: "Ultimas 4 semanas",
                        insight: "Ainda nao ha historico suficiente para montar uma serie executiva confiavel.",
                        hasData: false,
                        points: [],
                    },
                }),
            }),
        );

        expect(html).toContain("Leitura honesta");
        expect(html).toContain("Painel conectado, mas ainda sem volume suficiente para leitura confiavel.");
    });

    test("renders comparison fallback when historical baseline is absent", () => {
        const html = renderToStaticMarkup(
            ExecutiveDashboardView({
                data: createDashboard({
                    periodComparison: {
                        currentLabel: "Ultimos 30 dias",
                        previousLabel: "30 dias anteriores",
                        items: [
                            {
                                id: "proposal-conversion",
                                label: "Conversao de propostas",
                                current: "0,0%",
                                previous: "Sem base",
                                delta: "Sem comparativo",
                                direction: "flat",
                                tone: "neutral",
                                insight: "Ainda nao ha volume suficiente para comparar conversao de propostas.",
                                hasBaseline: false,
                            },
                        ],
                    },
                }),
            }),
        );

        expect(html).toContain("Sem comparativo");
        expect(html).toContain("Ainda nao ha volume suficiente para comparar conversao de propostas.");
    });

    test("renders safely when recent series and alert context are partially absent", () => {
        const html = renderToStaticMarkup(
            ExecutiveDashboardView({
                data: createDashboard({
                    recentSeries: {
                        label: "Ultimas 4 semanas",
                        insight: "Ainda nao ha historico suficiente para montar uma serie executiva confiavel.",
                        hasData: false,
                        points: [],
                    },
                    trendComparison: {
                        currentLabel: "Ultimos 14 dias",
                        previousLabel: "14 dias anteriores",
                        items: [],
                    },
                    prioritizedAlerts: [],
                }),
            }),
        );

        expect(html).toContain("Ainda nao ha historico suficiente para a serie executiva curta.");
        expect(html).toContain("Ainda nao ha dados suficientes para uma leitura de tendencia curta.");
        expect(html).toContain("Nenhum alerta executivo neste recorte. O filtro apenas organiza a leitura.");
    });
});
