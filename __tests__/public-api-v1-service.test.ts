const mockContactCount = jest.fn();
const mockContactFindMany = jest.fn();
const mockContactUpsert = jest.fn();
const mockDealCount = jest.fn();
const mockDealFindMany = jest.fn();
const mockDealFindFirst = jest.fn();
const mockDealUpdate = jest.fn();
const mockDealCreate = jest.fn();
const mockActivityCount = jest.fn();
const mockActivityFindMany = jest.fn();
const mockActivityCreate = jest.fn();
const mockWhatsAppConversationCount = jest.fn();
const mockWhatsAppConversationFindMany = jest.fn();
const mockEmailThreadCount = jest.fn();
const mockEmailThreadFindMany = jest.fn();
const mockPipelineStageFindFirst = jest.fn();
const mockPipelineStageFindUnique = jest.fn();
const mockEnsureDefaultCommercialPipelineStage = jest.fn();
const mockBuildTenantExecutiveDashboard = jest.fn();

jest.mock("../lib/prisma", () => ({
    prisma: {
        contact: {
            count: mockContactCount,
            findMany: mockContactFindMany,
            upsert: mockContactUpsert,
            findFirst: mockDealFindFirst,
        },
        deal: {
            count: mockDealCount,
            findMany: mockDealFindMany,
            findFirst: mockDealFindFirst,
            update: mockDealUpdate,
            create: mockDealCreate,
        },
        activity: {
            count: mockActivityCount,
            findMany: mockActivityFindMany,
            create: mockActivityCreate,
        },
        whatsAppConversation: {
            count: mockWhatsAppConversationCount,
            findMany: mockWhatsAppConversationFindMany,
        },
        emailThread: {
            count: mockEmailThreadCount,
            findMany: mockEmailThreadFindMany,
        },
        pipelineStage: {
            findFirst: mockPipelineStageFindFirst,
            findUnique: mockPipelineStageFindUnique,
        },
    },
}));

jest.mock("../lib/commercial/canonical-flow", () => ({
    ensureDefaultCommercialPipelineStage: mockEnsureDefaultCommercialPipelineStage,
}));

jest.mock("../lib/onboarding-status", () => ({
    recordOnboardingEmailConnected: jest.fn(async () => undefined),
    recordOnboardingPipelineConfigured: jest.fn(async () => undefined),
    recordOnboardingFirstContact: jest.fn(async () => undefined),
    recordOnboardingFirstDeal: jest.fn(async () => undefined),
}));

jest.mock("../lib/executive/tenant-intelligence", () => ({
    buildTenantExecutiveDashboard: mockBuildTenantExecutiveDashboard,
}));

jest.mock("../lib/logger", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

import {
    createPublicContact,
    createPublicDeal,
    getPublicExecutivePulse,
    listPublicContacts,
    listPublicConversations,
    listPublicDeals,
} from "../lib/public-api/v1-service";

describe("public api v1 service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("lists contacts within the tenant scope", async () => {
        mockContactCount.mockResolvedValueOnce(2);
        mockContactFindMany.mockResolvedValueOnce([
            {
                id: "contact-1",
                name: "Ana",
                email: "ana@acme.com",
                phoneNumberE164: "5511999998888",
                lifecycle: "lead",
                tags: JSON.stringify(["vip"]),
                lastMessageAt: new Date("2026-03-18T09:00:00.000Z"),
                createdAt: new Date("2026-03-17T09:00:00.000Z"),
                updatedAt: new Date("2026-03-18T09:00:00.000Z"),
            },
        ]);

        const result = await listPublicContacts({
            organizationId: "org-1",
            offset: 1,
            limit: 1,
        });

        expect(mockContactCount).toHaveBeenCalledWith({
            where: { organizationId: "org-1" },
        });
        expect(mockContactFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { organizationId: "org-1" },
            skip: 1,
            take: 1,
        }));
        expect(result.pagination).toMatchObject({
            limit: 1,
            total: 2,
            returnedCount: 1,
            hasNextPage: false,
            nextCursor: null,
        });
        expect(result.items[0]).toMatchObject({
            phoneNumberE164: "5511999998888",
            tags: ["vip"],
        });
    });

    it("creates a contact with normalized phone data", async () => {
        mockContactUpsert.mockResolvedValueOnce({
            id: "contact-1",
            name: "Ana",
            email: "ana@acme.com",
            phoneNumberE164: "5511999998888",
            lifecycle: "lead",
            tags: JSON.stringify(["vip"]),
            lastMessageAt: null,
            createdAt: new Date("2026-03-17T09:00:00.000Z"),
            updatedAt: new Date("2026-03-18T09:00:00.000Z"),
        });

        const result = await createPublicContact({
            organizationId: "org-1",
            phoneNumberE164: "+55 11 99999-8888",
            name: "Ana",
            email: "ana@acme.com",
            tags: ["vip", "vip"],
        });

        expect(mockContactUpsert).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                organizationId_phoneNumberE164: {
                    organizationId: "org-1",
                    phoneNumberE164: "5511999998888",
                },
            },
            create: expect.objectContaining({
                phoneNumberE164: "5511999998888",
                tags: JSON.stringify(["vip"]),
            }),
        }));
        expect(result.phoneNumberE164).toBe("5511999998888");
    });

    it("rejects malformed contact phone numbers", async () => {
        await expect(createPublicContact({
            organizationId: "org-1",
            phoneNumberE164: "",
        })).rejects.toMatchObject({
            status: 400,
            code: "VALIDATION_ERROR",
        });
    });

    it("creates a deal in the default pipeline stage when no stage is provided", async () => {
        mockDealFindFirst
            .mockResolvedValueOnce({ id: "contact-1" })
            .mockResolvedValueOnce(null);
        mockEnsureDefaultCommercialPipelineStage.mockResolvedValueOnce({
            pipelineId: "pipeline-1",
            stageId: "stage-default",
        });
        mockPipelineStageFindUnique.mockResolvedValueOnce({
            id: "stage-default",
            name: "Novo",
            pipelineId: "pipeline-1",
        });
        mockDealCreate.mockResolvedValueOnce({
            id: "deal-1",
            contactId: "contact-1",
            contact: {
                id: "contact-1",
                name: "Ana",
                email: "ana@acme.com",
                phoneNumberE164: "5511999998888",
                lifecycle: "lead",
                tags: JSON.stringify([]),
            },
            stage: {
                id: "stage-default",
                name: "Novo",
                pipelineId: "pipeline-1",
            },
            value: 25000,
            status: "open",
            createdAt: new Date("2026-03-18T09:00:00.000Z"),
            _count: { activities: 0 },
        });

        const result = await createPublicDeal({
            organizationId: "org-1",
            contactId: "contact-1",
            value: 25000,
        });

        expect(mockDealFindFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({
            where: {
                id: "contact-1",
                organizationId: "org-1",
            },
        }));
        expect(mockEnsureDefaultCommercialPipelineStage).toHaveBeenCalledWith({
            organizationId: "org-1",
        });
        expect(mockDealCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                organizationId: "org-1",
                contactId: "contact-1",
                stageId: "stage-default",
            }),
        }));
        expect(result.created).toBe(true);
        expect(result.deal.stage.id).toBe("stage-default");
    });

    it("lists unified conversations across WhatsApp and email", async () => {
        mockWhatsAppConversationCount.mockResolvedValueOnce(1);
        mockEmailThreadCount.mockResolvedValueOnce(1);
        mockWhatsAppConversationFindMany.mockResolvedValueOnce([
            {
                id: "wa-1",
                status: "open",
                unreadCount: 2,
                lastMessageAt: new Date("2026-03-18T10:00:00.000Z"),
                lastMessagePreview: "Mensagem WhatsApp",
                slaDueAt: null,
                createdAt: new Date("2026-03-17T10:00:00.000Z"),
                updatedAt: new Date("2026-03-18T10:00:00.000Z"),
                contact: {
                    id: "contact-1",
                    name: "Ana",
                    email: null,
                    phoneNumberE164: "5511999998888",
                },
                user: {
                    id: "user-1",
                    email: "ceo@acme.com",
                },
            },
        ]);
        mockEmailThreadFindMany.mockResolvedValueOnce([
            {
                id: "em-1",
                status: "open",
                unreadCount: 0,
                lastMessageAt: new Date("2026-03-18T11:00:00.000Z"),
                lastMessagePreview: "Email preview",
                slaDueAt: null,
                subject: "Assunto importante",
                createdAt: new Date("2026-03-17T11:00:00.000Z"),
                updatedAt: new Date("2026-03-18T11:00:00.000Z"),
                contact: {
                    id: "contact-2",
                    name: "Bruno",
                    email: "bruno@acme.com",
                    phoneNumberE164: "5511888887777",
                },
                user: {
                    id: "user-2",
                    email: "ops@acme.com",
                },
            },
        ]);

        const result = await listPublicConversations({
            organizationId: "org-1",
            offset: 0,
            limit: 10,
        });

        expect(result.summary).toMatchObject({
            total: 2,
            whatsapp: 1,
            email: 1,
        });
        expect(result.items[0]).toMatchObject({
            channel: "email",
            title: "Assunto importante",
        });
        expect(result.items[1]).toMatchObject({
            channel: "whatsapp",
            title: "Ana",
        });
    });

    it("returns the executive pulse for the tenant slug", async () => {
        mockBuildTenantExecutiveDashboard.mockResolvedValueOnce({
            org: {
                id: "org-1",
                slug: "acme",
                name: "Acme",
                plan: "growth",
            },
            generatedAt: "2026-03-18T12:00:00.000Z",
            hasData: true,
            emptyReason: null,
            overview: {
                headline: "Executivo",
                subheadline: "Resumo",
            },
            prioritizedAlerts: [],
            decisionNarrative: {
                tone: "neutral",
                summary: "Resumo",
                stateOfPlay: "Estado",
                biggestRisk: "Risco",
                biggestOpportunity: "Oportunidade",
                focusNow: [],
            },
            warnings: [],
        });

        const result = await getPublicExecutivePulse({
            organizationSlug: "acme",
        });

        expect(mockBuildTenantExecutiveDashboard).toHaveBeenCalledWith("acme");
        expect(result.org.slug).toBe("acme");
        expect(result.hasData).toBe(true);
    });
});
