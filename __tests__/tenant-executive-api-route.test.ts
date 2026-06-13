const requireOrgContextMock = jest.fn();
const buildTenantExecutiveDashboardMock = jest.fn();

jest.mock("../lib/auth/org-context", () => ({
    requireOrgContext: requireOrgContextMock,
    orgContextErrorResponse: jest.fn((error: Error) => Response.json({
        success: false,
        error: error.message,
    }, { status: 403 })),
}));

jest.mock("../lib/executive/tenant-intelligence", () => ({
    buildTenantExecutiveDashboard: buildTenantExecutiveDashboardMock,
}));

jest.mock("../lib/logger", () => ({
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
    logger: {
        error: jest.fn(),
    },
}));

import { GET } from "../app/api/org/[slug]/executive/intelligence/route";

describe("Tenant executive intelligence route", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("denies non-admin profiles", async () => {
        requireOrgContextMock.mockResolvedValue({
            orgId: "org-a",
            orgSlug: "acme",
            role: "viewer",
            plan: "starter",
        });

        const response = await GET(
            new Request("http://localhost/api/org/acme/executive/intelligence"),
            { params: Promise.resolve({ slug: "acme" }) },
        );

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({
            success: false,
            error: "FORBIDDEN",
        });
        expect(buildTenantExecutiveDashboardMock).not.toHaveBeenCalled();
    });

    test("returns the real dashboard payload for authorized executive access", async () => {
        requireOrgContextMock.mockResolvedValue({
            orgId: "org-a",
            orgSlug: "acme",
            role: "admin",
            plan: "growth",
        });
        buildTenantExecutiveDashboardMock.mockResolvedValue({
            org: {
                id: "org-a",
                slug: "acme",
                name: "Acme",
                plan: "growth",
            },
            generatedAt: "2026-03-16T12:00:00.000Z",
            hasData: true,
            emptyReason: null,
            overview: {
                headline: "Exec summary",
                subheadline: "Real backend data",
            },
            headlineMetrics: [],
            summaryCards: [],
            recentSeries: {
                label: "Ultimas 4 semanas",
                insight: "Serie curta conectada.",
                hasData: true,
                points: [],
            },
            trendComparison: {
                currentLabel: "Ultimos 14 dias",
                previousLabel: "14 dias anteriores",
                items: [],
            },
            revenueIntelligence: {
                tone: "neutral",
                outlook: "Revenue outlook",
                pipelineDirection: "Pipeline direction",
                riskNarrative: "Risk narrative",
                focus: "Focus",
                signals: [],
            },
            revenueSignals: {
                generatedAt: "2026-03-16T12:00:00.000Z",
                estimatedOpenRevenueCents: 100000,
                estimatedRevenueAtRiskCents: 25000,
                stalledProposals: { count: 1, valueCents: 25000, thresholdDays: 5 },
                inactiveDeals: { count: 0, valueCents: 0, thresholdDays: 7 },
                proposalsWithoutResponse: { count: 1, thresholdDays: 3 },
                quietCriticalConversations: { count: 0, thresholdHours: 24 },
                mostStagnantStage: null,
                momentum: {
                    tone: "neutral",
                    direction: "flat",
                    label: "Momentum estavel",
                    detail: "Pipeline estavel.",
                    proposalEntriesCurrentWindow: 1,
                    proposalEntriesPreviousWindow: 1,
                    activityEntriesCurrentWindow: 2,
                    activityEntriesPreviousWindow: 2,
                },
                topAtRiskOpportunities: [],
                summary: {
                    tone: "warning",
                    headline: "Receita sob risco controlado.",
                    focus: "Cobrar proposta parada.",
                },
            },
            periodComparison: {
                currentLabel: "Ultimos 30 dias",
                previousLabel: "30 dias anteriores",
                items: [],
            },
            prioritizedAlerts: [],
            decisionNarrative: {
                tone: "neutral",
                summary: "Exec summary",
                stateOfPlay: "State",
                biggestRisk: "Risk",
                biggestOpportunity: "Opportunity",
                focusNow: [],
            },
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
                openDeals: 1,
                activeProposals: 2,
                acceptedProposals: 0,
                recentActivities: 3,
            },
            operations: {
                pendingActions: 1,
                openProfitLeaks: 0,
                avgReplyTimeMinutes: 10,
            },
            alerts: [],
            warnings: [],
        });

        const response = await GET(
            new Request("http://localhost/api/org/acme/executive/intelligence"),
            { params: Promise.resolve({ slug: "acme" }) },
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            data: {
                org: {
                    slug: "acme",
                    name: "Acme",
                },
                pipeline: {
                    openDeals: 1,
                },
            },
        });
        expect(buildTenantExecutiveDashboardMock).toHaveBeenCalledWith("acme");
    });
});
