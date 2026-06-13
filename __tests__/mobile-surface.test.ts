import { loadMobileCommandSurface } from "@/lib/mobile/mobile-surface";

const buildTenantExecutiveDashboard = jest.fn();
const listPublicConversations = jest.fn();
const listPublicDeals = jest.fn();

jest.mock("@/lib/executive/tenant-intelligence", () => ({
    buildTenantExecutiveDashboard: (...args: unknown[]) => buildTenantExecutiveDashboard(...args),
}));

jest.mock("@/lib/public-api/v1-service", () => ({
    listPublicConversations: (...args: unknown[]) => listPublicConversations(...args),
    listPublicDeals: (...args: unknown[]) => listPublicDeals(...args),
}));

describe("loadMobileCommandSurface", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        buildTenantExecutiveDashboard.mockResolvedValue({
            org: {
                id: "org-1",
                slug: "acme",
                name: "Acme",
                plan: "enterprise",
            },
            generatedAt: "2026-03-18T12:00:00.000Z",
            overview: {
                headline: "Headline",
                subheadline: "Subheadline",
            },
            decisionNarrative: {
                tone: "neutral",
                summary: "Summary",
                stateOfPlay: "State",
                biggestRisk: "Risk",
                biggestOpportunity: "Opportunity",
                focusNow: ["A", "B"],
            },
            summaryCards: [
                { id: "revenue", title: "Receita", value: "R$ 10k", detail: "Detail", tone: "positive" },
            ],
            prioritizedAlerts: [
                {
                    pulseKey: "pulse-1",
                    title: "Deal travado",
                    summary: "Sem avanço",
                    category: "stalled_deal",
                    severity: "high",
                    priority: 1,
                    status: "open",
                    linkedEntityId: "deal-1",
                    linkedEntityType: "deal",
                    ctaCode: "review_pipeline",
                    ctaLabel: "Revisar pipeline",
                },
            ],
        });
        listPublicConversations.mockResolvedValue({
            items: [
                {
                    id: "wa-1",
                    channel: "whatsapp",
                    title: "WhatsApp A",
                    lastMessagePreview: "Agora",
                    subject: null,
                    status: "open",
                    unreadCount: 2,
                    lastMessageAt: "2026-03-18T12:30:00.000Z",
                    contact: { name: "Ana", email: "ana@example.com" },
                },
                {
                    id: "email-1",
                    channel: "email",
                    title: "Email B",
                    lastMessagePreview: "Email agora",
                    subject: null,
                    status: "open",
                    unreadCount: 1,
                    lastMessageAt: "2026-03-18T12:20:00.000Z",
                    contact: { name: "Bea", email: "bea@example.com" },
                },
            ],
            pagination: {
                limit: 12,
                total: 2,
                returnedCount: 2,
                hasNextPage: false,
                nextCursor: null,
            },
            summary: {
                total: 2,
                whatsapp: 1,
                email: 1,
            },
        });
        listPublicDeals.mockResolvedValue({
            items: [
                {
                    id: "deal-1",
                    contactId: "con-1",
                    contact: {
                        id: "con-1",
                        name: "Ana",
                        email: "ana@example.com",
                        phoneNumberE164: "+5511999999999",
                        lifecycle: "lead",
                        tags: [],
                    },
                    stage: {
                        id: "stage-1",
                        name: "Proposta",
                        pipelineId: "pipe-1",
                    },
                    value: 12000,
                    status: "open",
                    activityCount: 3,
                    createdAt: "2026-03-18T11:00:00.000Z",
                },
            ],
            pagination: {
                limit: 6,
                total: 1,
                returnedCount: 1,
                hasNextPage: false,
                nextCursor: null,
            },
        });
    });

    it("loads and merges inbox items by freshness", async () => {
        const data = await loadMobileCommandSurface({
            organizationId: "org-1",
            organizationSlug: "acme",
        });

        expect(data).not.toBeNull();
        expect(data?.inboxItems).toHaveLength(2);
        expect(data?.inboxItems[0].id).toBe("wa-1");
        expect(data?.inboxItems[0].channel).toBe("whatsapp");
        expect(data?.inboxItems[1].id).toBe("email-1");
        expect(data?.recentDeals[0].id).toBe("deal-1");
    });

    it("returns null when the executive dashboard is unavailable", async () => {
        buildTenantExecutiveDashboard.mockResolvedValueOnce(null);

        const data = await loadMobileCommandSurface({
            organizationId: "org-1",
            organizationSlug: "acme",
        });

        expect(data).toBeNull();
    });
});
