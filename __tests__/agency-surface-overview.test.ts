import { buildAgencySurfaceModel, type AgencySurfaceOverviewInput } from "../lib/agency/surface-overview";
import type { TenantRevenueSignals } from "../lib/commercial/revenue-engine";

function createInput(overrides: Partial<Parameters<typeof buildAgencySurfaceModel>[0]> = {}) {
    return {
        tenantCount: 12,
        newTenants30d: 3,
        connectedIntegrations: 7,
        pendingRollouts: 2,
        blockedPlatformTasks: 1,
        highSeverityPlatformEvents7d: 2,
        acceptedTenantProposals30d: 4,
        recentTenants: [
            {
                id: "org-1",
                name: "Acme",
                slug: "acme",
                plan: "growth",
                subscriptionStatus: "active",
                createdAt: "2026-03-15T12:00:00.000Z",
            },
            {
                id: "org-exp",
                name: "Expando",
                slug: "expando",
                plan: "free",
                subscriptionStatus: "active",
                createdAt: "2026-03-16T12:00:00.000Z",
            },
            {
                id: "org-paused",
                name: "Pauser",
                slug: "pauser",
                plan: "basic",
                subscriptionStatus: "paused",
                createdAt: "2026-03-17T12:00:00.000Z",
            },
        ],
        agencyLeadCount30d: 18,
        agencyActiveProposals: 5,
        agencyAcceptedProposals30d: 2,
        agencyUpcomingMeetings7d: 3,
        agencyUnreadConversations: 4,
        agencyPendingActions: 2,
        agencyReadyContent: 3,
        agencyBlockedDeliveryTasks: 1,
        staleProposals: [
            {
                id: "proposal-1",
                company: "Globex",
                updatedAt: "2026-03-12T12:00:00.000Z",
            },
        ],
        upcomingMeetings: [
            {
                id: "meeting-1",
                leadLabel: "ceo@acme.com",
                startAt: "2026-03-18T15:00:00.000Z",
            },
        ],
        marketingQueue: [
            {
                id: "marketing-1",
                topic: "AI ops for agencies",
                platform: "linkedin",
                scheduledFor: "2026-03-17T11:00:00.000Z",
            },
        ],
        totalOpenTenantRevenueCents: 15000000,
        totalRecoveredTenantRevenueCents: 450000,
        tenantConversionRates: [15, 22, 18],
        avgTenantReplyTimeMinutes: 45,
        tenantActivitySignals: [
            { id: "org-1", slug: "acme", name: "Acme", activityCount7d: 10, previousActivityCount7d: 50, conversionRate: 15 },
            { id: "org-2", slug: "globex", name: "Globex", activityCount7d: 5, previousActivityCount7d: 5, conversionRate: 3 },
        ],
        ...overrides,
    };
}

describe("Agency surface overview model", () => {
    test("keeps platform control and agency ops as explicit separate sections", () => {
        const model = buildAgencySurfaceModel(createInput());

        expect(model.overview.headline).toContain("Agency Surface v2");
        expect(model.controlPlane.title).toBe("Platform Control");
        expect(model.agencyOps.title).toBe("Agency Operating System");
        expect(model.controlPlane.metrics).toHaveLength(4);
        expect(model.agencyOps.metrics).toHaveLength(6);
        expect(model.overview.focusNow[0]).toContain("control plane");
    });

    test("falls back honestly when both platform and agency signals are still shallow", () => {
        const model = buildAgencySurfaceModel(createInput({
            tenantCount: 0,
            newTenants30d: 0,
            connectedIntegrations: 0,
            pendingRollouts: 0,
            blockedPlatformTasks: 0,
            highSeverityPlatformEvents7d: 0,
            acceptedTenantProposals30d: 0,
            recentTenants: [],
            agencyLeadCount30d: 0,
            agencyActiveProposals: 0,
            agencyAcceptedProposals30d: 0,
            agencyUpcomingMeetings7d: 0,
            agencyUnreadConversations: 0,
            agencyPendingActions: 0,
            agencyReadyContent: 0,
            agencyBlockedDeliveryTasks: 0,
            staleProposals: [],
            upcomingMeetings: [],
            marketingQueue: [],
        }));

        expect(model.overview.commandTone).toBe("neutral");
        expect(model.warnings).toHaveLength(3);
        expect(model.controlPlane.items[0].title).toContain("Sem tenants recentes");
        expect(model.overview.focusNow[0]).toContain("sem pressao real suficiente");
    });

    test("includes agency revenue open and at-risk signals when available", () => {
        const revenueSignals: TenantRevenueSignals = {
            generatedAt: "2026-03-17T12:00:00.000Z",
            estimatedOpenRevenueCents: 800000,
            estimatedRevenueAtRiskCents: 200000,
            stalledProposals: { count: 1, valueCents: 120000, thresholdDays: 5 },
            inactiveDeals: { count: 1, valueCents: 80000, thresholdDays: 7 },
            proposalsWithoutResponse: { count: 1, thresholdDays: 3 },
            quietCriticalConversations: { count: 0, thresholdHours: 24 },
            mostStagnantStage: null,
            momentum: { tone: "warning", direction: "down", label: "Momentum em queda", detail: "", proposalEntriesCurrentWindow: 5, proposalEntriesPreviousWindow: 8, activityEntriesCurrentWindow: 8, activityEntriesPreviousWindow: 12 },
            topAtRiskOpportunities: [],
            agingBuckets: [],
            riskByStage: [],
            riskByOwner: [],
            conversionTrend: { current: 5, previous: 8, delta: -3, direction: "down", detail: "" },
            summary: { tone: "warning", headline: "", focus: "" },
        };

        const model = buildAgencySurfaceModel(createInput({
            agencyRevenueSignals: revenueSignals,
        }));

        expect(model.agencyOps.metrics.find((m) => m.id === "agency-open-revenue")?.value).toContain("R$");
        expect(model.agencyOps.metrics.find((m) => m.id === "agency-revenue-at-risk")?.value).toContain("R$");
        expect(model.overview.focusNow.some((item) => item.includes("Proteger"))).toBe(true);
    });

    test("generates retention and expansion signals based on activity and conversion", () => {
        const model = buildAgencySurfaceModel(createInput());

        expect(model.retentionSignals).toHaveLength(2);
        expect(model.retentionSignals[0].label).toBe("Queda de atividade");
        expect(model.retentionSignals[1].label).toBe("Baixa conversao");
        expect(model.expansionSignals[0].label).toBe("Potencial de Upgrade");
    });

    test("generates success playbooks derived from signals", () => {
        const model = buildAgencySurfaceModel(createInput());

        expect(model.successPlaybooks.length).toBeGreaterThan(0);
        expect(model.successPlaybooks.some(pb => pb.playbookName === "Retention Playbook")).toBe(true);
        expect(model.successPlaybooks.some(pb => pb.playbookName === "Expansion Playbook")).toBe(true);
        expect(model.successPlaybooks.some(pb => pb.playbookName === "Recovery Playbook")).toBe(true);
    });

    test("applies persisted execution status to playbooks", () => {
        const persisted = {
            "pb-ret-org-1": {
                status: "in-progress" as const,
                owner: "carmen",
                createdAt: "2026-03-16T00:00:00.000Z",
                startedAt: "2026-03-16T01:00:00.000Z",
                completedAt: undefined,
                observedImpact: "Primeiro contato feito",
            },
        } as Record<string, import("../lib/agency/surface-overview").AgencySuccessPlaybookExecution>;

        const model = buildAgencySurfaceModel(createInput(), persisted);
        const tracked = model.successPlaybooks.find(pb => pb.id === "pb-ret-org-1");

        expect(tracked).toBeDefined();
        expect(tracked?.status).toBe("in-progress");
        expect(tracked?.owner).toBe("carmen");
        expect(tracked?.observedImpact).toBe("Primeiro contato feito");
    });

    test("defaults suggested status when no persistent data exists", () => {
        const model = buildAgencySurfaceModel(createInput());

        for (const pb of model.successPlaybooks) {
            expect(pb.status).toBe("suggested");
            expect(pb.createdAt).toBeDefined();
        }
    });
});
