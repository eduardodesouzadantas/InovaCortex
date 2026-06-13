import {
    buildExecutiveNarrative,
    buildExecutiveGrowthExpansion,
    buildRecentSeries,
    buildPrioritizedAlerts,
    buildRevenueIntelligence,
    buildTrendComparison,
} from "../lib/executive/tenant-intelligence";
import type { TenantRevenueSignals } from "../lib/commercial/revenue-engine";

function createSummary(overrides: Partial<{
    revenueClosedCents: number;
    proposalsSent: number;
    acceptedProposals: number;
    meetingsBooked: number;
    completedMeetings: number;
    activities: number;
    criticalAlerts: number;
}> = {}) {
    return {
        revenueClosedCents: 0,
        proposalsSent: 0,
        acceptedProposals: 0,
        meetingsBooked: 0,
        completedMeetings: 0,
        activities: 0,
        criticalAlerts: 0,
        ...overrides,
    };
}

function createRevenueSignals(overrides: Partial<TenantRevenueSignals> = {}): TenantRevenueSignals {
    return {
        generatedAt: "2026-03-17T12:00:00.000Z",
        estimatedOpenRevenueCents: 2_000_000,
        estimatedRevenueAtRiskCents: 600_000,
        stalledProposals: {
            count: 2,
            valueCents: 400_000,
            thresholdDays: 5,
        },
        inactiveDeals: {
            count: 1,
            valueCents: 200_000,
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
            stageId: "stage-1",
            stageLabel: "Proposal",
            stalledCount: 2,
            estimatedValueCents: 400_000,
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
                company: "Acme",
                dealId: "deal-1",
                conversationId: "conversation-1",
                stageLabel: "Proposal",
                proposalStatus: "viewed",
                estimatedValueCents: 400_000,
                lastTouchAt: "2026-03-15T10:00:00.000Z",
                ownerId: "owner-1",
                ownerLabel: "Ana",
                riskScore: 11,
                reason: "Proposta parada ha 6 dias.",
                recommendedAction: "Cobrar proposta parada agora.",
            },
        ],
        agingBuckets: [],
        riskByStage: [],
        riskByOwner: [],
        conversionTrend: { current: 2, previous: 4, delta: -2, direction: "down", detail: "" },
        summary: {
            tone: "warning",
            headline: "Existe receita aberta pedindo intervencao curta.",
            focus: "Acme: Cobrar proposta parada agora.",
        },
        ...overrides,
    };
}

describe("Tenant executive intelligence helpers", () => {
    test("prioritizes critical risk before warnings and actions", () => {
        const alerts = buildPrioritizedAlerts({
            systemAlerts: [
                {
                    id: "evt-1",
                    type: "proposal_stale",
                    severity: "warning",
                    message: "Proposta sem follow-up.",
                    createdAt: "2026-03-16T09:00:00.000Z",
                },
            ],
            leakItems: [
                {
                    label: "Pipeline travado",
                    value: "R$ 20.000",
                    potentialLoss: 1_500_000,
                    description: "Risco severo de perda.",
                },
            ],
            actions: [
                {
                    label: "Responder lead quente",
                    impact: "Alta Probabilidade",
                    impactValue: 500_000,
                    description: "Fazer contato ainda hoje.",
                    priority: "high",
                },
            ],
        });

        expect(alerts[0]).toMatchObject({
            source: "profit_leak",
            severity: "critical",
            title: "Pipeline travado",
            category: "accelerating_loss",
            cta: "investigate",
            status: "open",
        });
        expect(alerts[0]).toHaveProperty("pulseKey");
        expect(alerts[0].whyNow).toContain("perda esta acelerando");
        expect(alerts[0].recommendedFocus).toContain("conter a perda");
        expect(alerts.some((alert) => alert.source === "action")).toBe(true);
    });

    test("keeps risk and stalled deals ahead of positive growth signals", () => {
        const alerts = buildPrioritizedAlerts({
            systemAlerts: [],
            leakItems: [],
            actions: [
                {
                    label: "Conta quente com upside",
                    impact: "Crescimento acima da media",
                    impactValue: 900_000,
                    description: "Conta expandindo com potencial acima da media.",
                    priority: "high",
                },
                {
                    label: "Proposta sem retorno",
                    impact: "Negocio travado",
                    impactValue: 250_000,
                    description: "Proposta enviada e sem retorno desde a ultima rodada.",
                    priority: "medium",
                },
            ],
        });

        expect(alerts[0].category).toBe("stalled_deal");
        expect(alerts[0].cta).toBe("demand_action");
        expect(alerts.some((alert) => alert.category === "growth_above_average")).toBe(true);
    });

    test("preserves linked deal metadata when revenue risk alerts carry a deal id", () => {
        const alerts = buildPrioritizedAlerts({
            systemAlerts: [],
            leakItems: [],
            actions: [],
            revenueSignals: createRevenueSignals({
                topAtRiskOpportunities: [
                    {
                        assessmentId: "assessment-1",
                        company: "Acme",
                        dealId: "deal-1",
                        conversationId: "conversation-1",
                        stageLabel: "Proposal",
                        proposalStatus: "viewed",
                        estimatedValueCents: 400_000,
                        lastTouchAt: "2026-03-15T10:00:00.000Z",
                        ownerId: "owner-1",
                        ownerLabel: "Ana",
                        riskScore: 11,
                        reason: "Proposta parada ha 6 dias.",
                        recommendedAction: "Cobrar proposta parada agora.",
                    },
                ],
            }),
        });

        expect(alerts.some((alert) => alert.linkedEntityId === "deal-1")).toBe(true);
        expect(alerts.some((alert) => alert.linkedEntityType === "deal")).toBe(true);
    });

    test("limits noisy duplicates and keeps a small executive pulse with clear categories", () => {
        const alerts = buildPrioritizedAlerts({
            systemAlerts: [
                {
                    id: "evt-1",
                    type: "proposal_stale",
                    severity: "warning",
                    message: "Proposta sem follow-up.",
                    createdAt: "2026-03-16T09:00:00.000Z",
                },
                {
                    id: "evt-2",
                    type: "proposal_stale",
                    severity: "warning",
                    message: "Sem retorno na proposta.",
                    createdAt: "2026-03-16T10:00:00.000Z",
                },
            ],
            leakItems: [
                {
                    label: "Pipeline travado",
                    value: "R$ 20.000",
                    potentialLoss: 1_500_000,
                    description: "Perda severa em aberto.",
                },
            ],
            actions: [
                {
                    label: "Reativar conta ociosa",
                    impact: "Recuperacao em risco",
                    impactValue: 700_000,
                    description: "Cliente voltou a responder e pode recuperar valor.",
                    priority: "high",
                },
                {
                    label: "Expandir conta quente",
                    impact: "Upside acima da media",
                    impactValue: 800_000,
                    description: "Oportunidade de crescimento acima da media.",
                    priority: "high",
                },
            ],
            revenueSignals: {
                generatedAt: "2026-03-17T12:00:00.000Z",
                estimatedOpenRevenueCents: 2_000_000,
                estimatedRevenueAtRiskCents: 600_000,
                stalledProposals: {
                    count: 2,
                    valueCents: 400_000,
                    thresholdDays: 5,
                },
                inactiveDeals: {
                    count: 1,
                    valueCents: 200_000,
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
                    stageId: "stage-1",
                    stageLabel: "Proposal",
                    stalledCount: 2,
                    estimatedValueCents: 400_000,
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
                        company: "Acme",
                        dealId: "deal-1",
                        conversationId: "conversation-1",
                        stageLabel: "Proposal",
                        proposalStatus: "viewed",
                        estimatedValueCents: 400_000,
                        lastTouchAt: "2026-03-15T10:00:00.000Z",
                        ownerId: "owner-1",
                        ownerLabel: "Ana",
                        riskScore: 11,
                        reason: "Deal parado ha 6 dias.",
                        recommendedAction: "Cobrar proposta parada agora.",
                    },
                ],
                agingBuckets: [],
                riskByStage: [],
                riskByOwner: [],
                conversionTrend: { current: 2, previous: 4, delta: -2, direction: "down", detail: "" },
                summary: {
                    tone: "warning",
                    headline: "Existe receita aberta pedindo intervencao curta.",
                    focus: "Acme: Cobrar proposta parada agora.",
                },
            },
        });

        expect(alerts).toHaveLength(4);
        expect(alerts[0].category).toBe("accelerating_loss");
        expect(alerts.filter((alert) => alert.category === "stalled_deal")).toHaveLength(1);
        expect(alerts.some((alert) => alert.category === "recovery")).toBe(true);
        expect(alerts.some((alert) => alert.category === "growth_above_average")).toBe(true);
    });

    test("builds growth and expansion summary in executive helper", () => {
        const growthExpansion = buildExecutiveGrowthExpansion({
            revenueBrain: {
                totalOpportunity: 500000,
                highProbabilityDeals: [
                    { id: "deal-1", email: "lead@acme.com", value: 2000000, probability: 0.8 },
                    { id: "deal-2", email: "lead2@acme.com", value: 1000000, probability: 0.7 },
                ],
                stalledDeals: [],
                fastWins: [],
                recommendations: [],
            },
            revenueSignals: createRevenueSignals({}),
            leakDetector: { totalLeakValue: 300000, leakItems: [{ label: "Pipeline travado", value: "R$ 300.000", potentialLoss: 300000, description: "Perda potencial." }] },
            actionEngine: { actions: [{ label: "Reativar pipeline", impact: "Upside", description: "Ação direta para growth.", priority: "high" }] },
            pipeline: { openDeals: 3, activeProposals: 5, acceptedProposals: 1, recentActivities: 8 },
            kpis: { revenueCents: 0, mrrCents: 0, pipelineCents: 0, proposalsSent: 0, proposalAcceptanceRate: 0, meetingShowRate: 0, meetingsBooked: 0, avgReplyTimeMinutes: 0, leaksOpenCents: 0, pipelineVelocityDays: 0 },
        });

        expect(growthExpansion.topUpsideOpportunities).toHaveLength(2);
        expect(growthExpansion.primaryGrowthFront).toContain("Upside concentrado");
        expect(growthExpansion.expansionSignals.some((s: { id: string }) => s.id === "stagnant-stage")).toBe(true);
    });

    test("builds a short recent series with an acceleration insight when the latest windows improve", () => {
        const series = buildRecentSeries([
            {
                id: "w1",
                label: "01-07 mar",
                shortLabel: "S1",
                summary: createSummary({ revenueClosedCents: 100_000, proposalsSent: 2, acceptedProposals: 0, criticalAlerts: 2 }),
            },
            {
                id: "w2",
                label: "08-14 mar",
                shortLabel: "S2",
                summary: createSummary({ revenueClosedCents: 120_000, proposalsSent: 2, acceptedProposals: 1, criticalAlerts: 1 }),
            },
            {
                id: "w3",
                label: "15-21 mar",
                shortLabel: "S3",
                summary: createSummary({ revenueClosedCents: 260_000, proposalsSent: 4, acceptedProposals: 2, criticalAlerts: 1 }),
            },
            {
                id: "w4",
                label: "22-28 mar",
                shortLabel: "S4",
                summary: createSummary({ revenueClosedCents: 300_000, proposalsSent: 5, acceptedProposals: 2, criticalAlerts: 0 }),
            },
        ]);

        expect(series.hasData).toBe(true);
        expect(series.points).toHaveLength(4);
        expect(series.insight).toContain("aceleracao");
    });

    test("builds positive, negative and neutral short-window trend signals deterministically", () => {
        const positive = buildTrendComparison({
            current: createSummary({ revenueClosedCents: 500_000, proposalsSent: 8, acceptedProposals: 4, criticalAlerts: 1 }),
            previous: createSummary({ revenueClosedCents: 200_000, proposalsSent: 4, acceptedProposals: 1, criticalAlerts: 3 }),
        });
        const negative = buildTrendComparison({
            current: createSummary({ revenueClosedCents: 100_000, proposalsSent: 2, acceptedProposals: 0, criticalAlerts: 5 }),
            previous: createSummary({ revenueClosedCents: 350_000, proposalsSent: 6, acceptedProposals: 3, criticalAlerts: 1 }),
        });
        const neutral = buildTrendComparison({
            current: createSummary({ revenueClosedCents: 0, proposalsSent: 0, acceptedProposals: 0, criticalAlerts: 0 }),
            previous: createSummary({ revenueClosedCents: 0, proposalsSent: 0, acceptedProposals: 0, criticalAlerts: 0 }),
        });

        expect(positive.items.find((item) => item.id === "revenue-velocity")?.tone).toBe("positive");
        expect(negative.items.find((item) => item.id === "risk-pressure")?.tone).toBe("critical");
        expect(neutral.items.every((item) => item.hasBaseline === false)).toBe(true);
    });

    test("falls back cleanly when revenue intelligence lacks historical base", () => {
        const revenueIntelligence = buildRevenueIntelligence({
            recent: createSummary(),
            previous: createSummary(),
            revenueBrain: {
                totalOpportunity: 0,
                highProbabilityDeals: [],
                stalledDeals: [],
                fastWins: [],
                recommendations: [],
            },
            leakDetector: {
                totalLeakValue: 0,
                leakItems: [],
            },
            kpis: {
                revenueCents: 0,
                mrrCents: 0,
                pipelineCents: 0,
                proposalsSent: 0,
                proposalAcceptanceRate: 0,
                meetingShowRate: 0,
                meetingsBooked: 0,
                avgReplyTimeMinutes: 0,
                leaksOpenCents: 0,
                pipelineVelocityDays: 0,
            },
            pipeline: {
                openDeals: 0,
                activeProposals: 0,
                acceptedProposals: 0,
                recentActivities: 0,
            },
            revenueSignals: createRevenueSignals({
                estimatedOpenRevenueCents: 0,
                estimatedRevenueAtRiskCents: 0,
                stalledProposals: { count: 0, valueCents: 0, thresholdDays: 5 },
                inactiveDeals: { count: 0, valueCents: 0, thresholdDays: 7 },
                proposalsWithoutResponse: { count: 0, thresholdDays: 3 },
                quietCriticalConversations: { count: 0, thresholdHours: 24 },
                mostStagnantStage: null,
                topAtRiskOpportunities: [],
                summary: {
                    tone: "neutral",
                    headline: "Ainda nao ha receita aberta suficiente para uma leitura forte de revenue.",
                    focus: "Aumentar o volume de pipeline com disciplina de follow-up.",
                },
                momentum: {
                    tone: "neutral",
                    direction: "flat",
                    label: "Momentum estavel",
                    detail: "O pipeline segue estavel no curto prazo.",
                    proposalEntriesCurrentWindow: 0,
                    proposalEntriesPreviousWindow: 0,
                    activityEntriesCurrentWindow: 0,
                    activityEntriesPreviousWindow: 0,
                },
            }),
        });

        expect(revenueIntelligence.outlook).toContain("Ainda nao ha historico suficiente");
        expect(revenueIntelligence.signals.find((signal) => signal.id === "coverage")?.value).toBe("Sem leak aberto");
    });

    test("builds war room snapshot and immediate focus from revenue signals", () => {
        const revenueIntelligence = buildRevenueIntelligence({
            recent: createSummary({ revenueClosedCents: 100000 }),
            previous: createSummary({ revenueClosedCents: 80000 }),
            revenueBrain: {
                totalOpportunity: 300000,
                highProbabilityDeals: [],
                stalledDeals: [],
                fastWins: [],
                recommendations: [],
            },
            leakDetector: {
                totalLeakValue: 50000,
                leakItems: [],
            },
            kpis: {
                revenueCents: 800000,
                mrrCents: 0,
                pipelineCents: 700000,
                proposalsSent: 10,
                proposalAcceptanceRate: 30,
                meetingShowRate: 70,
                meetingsBooked: 8,
                avgReplyTimeMinutes: 25,
                leaksOpenCents: 0,
                pipelineVelocityDays: 14,
            },
            pipeline: {
                openDeals: 8,
                activeProposals: 4,
                acceptedProposals: 2,
                recentActivities: 12,
            },
            revenueSignals: createRevenueSignals({
                estimatedOpenRevenueCents: 1000000,
                estimatedRevenueAtRiskCents: 250000,
                stalledProposals: { count: 1, valueCents: 150000, thresholdDays: 5 },
                inactiveDeals: { count: 1, valueCents: 80000, thresholdDays: 7 },
                proposalsWithoutResponse: { count: 2, thresholdDays: 3 },
                quietCriticalConversations: { count: 0, thresholdHours: 24 },
                mostStagnantStage: null,
                momentum: {
                    tone: "warning",
                    direction: "down",
                    label: "Momentum em queda",
                    detail: "A maquina comercial perdeu ritmo recente.",
                    proposalEntriesCurrentWindow: 4,
                    proposalEntriesPreviousWindow: 6,
                    activityEntriesCurrentWindow: 8,
                    activityEntriesPreviousWindow: 10,
                },
                topAtRiskOpportunities: [],
                agingBuckets: [],
                riskByStage: [],
                riskByOwner: [],
                conversionTrend: { current: 4, previous: 6, delta: -2, direction: "down", detail: "" },
                summary: {
                    tone: "warning",
                    headline: "Risco moderado",
                    focus: "Fechar conversas criticas imediatas",
                },
            }),
        });

        expect(revenueIntelligence.warRoomSnapshot.estimatedOpenRevenue).toContain("10.000");
        expect(revenueIntelligence.warRoomSnapshot.estimatedRevenueAtRisk).toContain("2.500");
        expect(revenueIntelligence.warRoomSnapshot.riskShare).toBe("25,0%");
        expect(revenueIntelligence.warRoomSnapshot.momentumDirection).toBe("Momentum em queda");
        expect(revenueIntelligence.warRoomSnapshot.stagnantStage).toBe("Sem concentracao");
        expect(revenueIntelligence.warRoomSnapshot.topRiskStage).toBe("Sem concentracao");
        expect(revenueIntelligence.warRoomSnapshot.topRiskOwner).toBe("Sem responsavel");
        expect(revenueIntelligence.warRoomSnapshot.primaryFocus).toContain("Fechar conversas criticas imediatas");

        expect(revenueIntelligence.immediateFocus).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: "stalled-proposals", tone: "critical" }),
                expect.objectContaining({ id: "inactive-deals", tone: "warning" }),
                expect.objectContaining({ id: "proposals-without-response", tone: "warning" }),
            ]),
        );
    });

    test("returns a neutral narrative when no historical signal exists", () => {
        const narrative = buildExecutiveNarrative({
            orgName: "Acme Corp",
            hasData: false,
            comparison: {
                currentLabel: "Ultimos 30 dias",
                previousLabel: "30 dias anteriores",
                items: [],
            },
            prioritizedAlerts: [],
            revenueIntelligence: {
                tone: "neutral",
                outlook: "Ainda nao ha historico suficiente para uma leitura forte de revenue intelligence.",
                pipelineDirection: "A entrada recente de propostas manteve o mesmo ritmo da janela anterior.",
                riskNarrative: "Ainda nao ha pressao material de receita aberta no curto prazo.",
                focus: "Aumentar o volume de pipeline com disciplina de follow-up para fortalecer a leitura executiva.",
                warRoomSnapshot: {
                    estimatedOpenRevenue: "R$ 0",
                    estimatedRevenueAtRisk: "R$ 0",
                    riskShare: "0,0%",
                    momentumDirection: "Momentum estavel",
                    stagnantStage: "",
                    topRiskStage: "Sem concentracao",
                    topRiskOwner: "Sem responsavel",
                    primaryFocus: "Aumentar o volume de pipeline com disciplina de follow-up.",
                },
                immediateFocus: [],
                signals: [],
            },
            revenueSignals: createRevenueSignals({
                estimatedOpenRevenueCents: 0,
                estimatedRevenueAtRiskCents: 0,
                stalledProposals: { count: 0, valueCents: 0, thresholdDays: 5 },
                inactiveDeals: { count: 0, valueCents: 0, thresholdDays: 7 },
                proposalsWithoutResponse: { count: 0, thresholdDays: 3 },
                quietCriticalConversations: { count: 0, thresholdHours: 24 },
                mostStagnantStage: null,
                topAtRiskOpportunities: [],
                summary: {
                    tone: "neutral",
                    headline: "Ainda nao ha receita aberta suficiente para uma leitura forte de revenue.",
                    focus: "Aumentar o volume de pipeline com disciplina de follow-up.",
                },
                momentum: {
                    tone: "neutral",
                    direction: "flat",
                    label: "Momentum estavel",
                    detail: "O pipeline segue estavel no curto prazo.",
                    proposalEntriesCurrentWindow: 0,
                    proposalEntriesPreviousWindow: 0,
                    activityEntriesCurrentWindow: 0,
                    activityEntriesPreviousWindow: 0,
                },
            }),
            revenueBrain: {
                totalOpportunity: 0,
                highProbabilityDeals: [],
                stalledDeals: [],
                fastWins: [],
                recommendations: [],
            },
            leakDetector: {
                totalLeakValue: 0,
                leakItems: [],
            },
            actionEngine: {
                actions: [],
            },
            pipeline: {
                openDeals: 0,
                activeProposals: 0,
                acceptedProposals: 0,
                recentActivities: 0,
            },
        });

        expect(narrative.tone).toBe("neutral");
        expect(narrative.summary).toContain("ainda sem massa operacional suficiente");
    });
});
