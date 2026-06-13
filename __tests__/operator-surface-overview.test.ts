import { buildOperatorSurfaceModel, type OperatorSurfaceOverviewInput } from "../lib/operator/surface-overview";

function createInput(overrides: Partial<OperatorSurfaceOverviewInput> = {}): OperatorSurfaceOverviewInput {
    return {
        orgSlug: "acme",
        orgName: "Acme",
        openLeads: 18,
        hotLeads: 4,
        staleProposals: 2,
        overdueTasks: 1,
        dueTodayTasks: 3,
        pendingActions: 2,
        unreadConversations: 5,
        upcomingMeetings: 2,
        openWorkspaces: 3,
        activeOutboundSequences: 7,
        todayContentItems: 2,
        hotLeadItems: [
            {
                id: "lead-1",
                company: "Globex",
                scoreTotal: 88,
                status: "novo",
            },
        ],
        staleProposalItems: [
            {
                id: "proposal-1",
                assessmentId: "assessment-1",
                company: "Initech",
                updatedAt: "2026-03-10T12:00:00.000Z",
            },
        ],
        closeItems: [
            {
                id: "close-1",
                assessmentId: "assessment-1",
                company: "Initech",
                blocker: "decisao parada",
                valueCents: 90000,
                updatedAt: "2026-03-15T12:00:00.000Z",
            },
        ],
        agendaItems: [
            {
                id: "meeting-1",
                leadLabel: "ceo@globex.com",
                startAt: "2026-03-17T15:00:00.000Z",
                status: "scheduled",
                assessmentId: null,
                isPrepared: false,
                isMissingFollowUp: false,
            },
        ],
        overdueTaskItems: [
            {
                id: "task-1",
                title: "Configurar onboarding",
                dueAt: "2026-03-12T12:00:00.000Z",
                workspaceId: "workspace-1",
            },
        ],
        queueItems: [
            {
                id: "queue-1",
                title: "Inbox com pendencia",
                detail: "5 conversas com mensagens nao tratadas.",
                eyebrow: "whatsapp crm",
                href: "/org/acme/admin/whatsapp",
                tone: "warning" as const,
            },
        ],
        revenueSignals: {
            generatedAt: "2026-03-17T12:00:00.000Z",
            estimatedOpenRevenueCents: 300000,
            estimatedRevenueAtRiskCents: 90000,
            stalledProposals: { count: 2, valueCents: 60000, thresholdDays: 5 },
            inactiveDeals: { count: 1, valueCents: 30000, thresholdDays: 7 },
            proposalsWithoutResponse: { count: 1, thresholdDays: 3 },
            quietCriticalConversations: { count: 1, thresholdHours: 24 },
            mostStagnantStage: {
                stageId: "stage-proposal",
                stageLabel: "Proposal",
                stalledCount: 2,
                estimatedValueCents: 60000,
            },
            momentum: {
                tone: "warning",
                direction: "down",
                label: "Momentum em queda",
                detail: "A maquina comercial perdeu ritmo recente.",
                proposalEntriesCurrentWindow: 2,
                proposalEntriesPreviousWindow: 4,
                activityEntriesCurrentWindow: 5,
                activityEntriesPreviousWindow: 8,
            },
            topAtRiskOpportunities: [
                {
                    assessmentId: "assessment-1",
                    company: "Initech",
                    dealId: "deal-1",
                    conversationId: "conversation-1",
                    stageLabel: "Proposal",
                    proposalStatus: "viewed",
                    estimatedValueCents: 90000,
                    lastTouchAt: "2026-03-17T10:00:00.000Z",
                    ownerId: "owner-1",
                    ownerLabel: "Pedro",
                    riskScore: 10,
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
                focus: "Initech: Cobrar proposta parada agora.",
            },
        },
        lossItems: [],
        ...overrides,
    };
}

describe("Operator surface overview model", () => {
    test("prioritizes execution-now semantics instead of executive reading", () => {
        const model = buildOperatorSurfaceModel(createInput());

        expect(model.overview.headline).toContain("Cockpit operacional");
        expect(model.overview.summary).toContain("toque operacional");
        expect(model.operationalDay.title).toBe("Resumo operacional do dia");
        expect(model.followUps.title).toBe("Follow-ups prioritarios");
        expect(model.queue.title).toBe("Fila e pendencias");
        expect(model.overview.focusNow[0]).toContain("proposta");
    });

    test("adds prioritized revenue queue items from revenue signals", () => {
        const model = buildOperatorSurfaceModel(createInput({
            queueItems: [],
            revenueSignals: {
                generatedAt: "2026-03-17T12:00:00.000Z",
                estimatedOpenRevenueCents: 300000,
                estimatedRevenueAtRiskCents: 90000,
                stalledProposals: { count: 1, valueCents: 60000, thresholdDays: 5 },
                inactiveDeals: { count: 1, valueCents: 30000, thresholdDays: 7 },
                proposalsWithoutResponse: { count: 2, thresholdDays: 3 },
                quietCriticalConversations: { count: 0, thresholdHours: 24 },
                mostStagnantStage: { stageId: "stage-proposal", stageLabel: "Proposal", stalledCount: 2, estimatedValueCents: 90000 },
                momentum: {
                    tone: "warning",
                    direction: "down",
                    label: "Momentum em queda",
                    detail: "A maquina perdeu ritmo.",
                    proposalEntriesCurrentWindow: 2,
                    proposalEntriesPreviousWindow: 4,
                    activityEntriesCurrentWindow: 5,
                    activityEntriesPreviousWindow: 8,
                },
                topAtRiskOpportunities: [
                    {
                        assessmentId: "assessment-1",
                        company: "Initech",
                        dealId: "deal-1",
                        conversationId: "conversation-1",
                        stageLabel: "Proposal",
                        proposalStatus: "sent",
                        estimatedValueCents: 90000,
                        lastTouchAt: "2026-03-17T10:00:00.000Z",
                        ownerId: "owner-1",
                        ownerLabel: "Pedro",
                        riskScore: 10,
                        reason: "Proposta parada ha 6 dias.",
                        recommendedAction: "Cobrar proposta parada agora.",
                    },
                ],
                agingBuckets: [],
                riskByStage: [{ stageId: "stage-proposal", stageLabel: "Proposal", count: 1, valueCents: 90000, riskShare: 1 }],
                riskByOwner: [{ ownerId: "owner-1", ownerLabel: "Pedro", count: 1, valueCents: 90000, riskShare: 1 }],
                conversionTrend: { current: 2, previous: 4, delta: -2, direction: "down", detail: "" },
                summary: { tone: "warning", headline: "Risco existente", focus: "Atuar em oportunidade de risco." },
            },
        }));

        expect(model.revenue.metrics.some((metric) => metric.id === "revenue-at-risk")).toBe(true);
        expect(model.revenue.items.some((item) => item.id.startsWith("revenue-risk-"))).toBe(true);
        expect(model.revenue.items.some((item) => item.eyebrow === "receita em risco")).toBe(true);
    });

    test("falls back honestly when the tenant has little day-to-day signal", () => {
        const model = buildOperatorSurfaceModel(createInput({
            openLeads: 0,
            hotLeads: 0,
            staleProposals: 0,
            overdueTasks: 0,
            dueTodayTasks: 0,
            pendingActions: 0,
            unreadConversations: 0,
            upcomingMeetings: 0,
            openWorkspaces: 0,
            activeOutboundSequences: 0,
            todayContentItems: 0,
            hotLeadItems: [],
            staleProposalItems: [],
            closeItems: [],
            agendaItems: [],
            overdueTaskItems: [],
            queueItems: [],
            revenueSignals: {
                generatedAt: "2026-03-17T12:00:00.000Z",
                estimatedOpenRevenueCents: 0,
                estimatedRevenueAtRiskCents: 0,
                stalledProposals: { count: 0, valueCents: 0, thresholdDays: 5 },
                inactiveDeals: { count: 0, valueCents: 0, thresholdDays: 7 },
                proposalsWithoutResponse: { count: 0, thresholdDays: 3 },
                quietCriticalConversations: { count: 0, thresholdHours: 24 },
                mostStagnantStage: null,
                momentum: {
                    tone: "neutral",
                    direction: "flat",
                    label: "Momentum estavel",
                    detail: "Pipeline estavel.",
                    proposalEntriesCurrentWindow: 0,
                    proposalEntriesPreviousWindow: 0,
                    activityEntriesCurrentWindow: 0,
                    activityEntriesPreviousWindow: 0,
                },
                topAtRiskOpportunities: [],
                agingBuckets: [],
                riskByStage: [],
                riskByOwner: [],
                conversionTrend: { current: 0, previous: 0, delta: 0, direction: "flat", detail: "" },
                summary: {
                    tone: "neutral",
                    headline: "Ainda nao ha receita aberta suficiente para uma leitura forte de revenue.",
                    focus: "Aumentar o volume de pipeline com disciplina de follow-up.",
                },
            },
        }));

        expect(model.overview.tone).toBe("neutral");
        expect(model.overview.focusNow[0]).toContain("operacao esta calma");
        expect(model.warnings).toHaveLength(3);
    });
});
