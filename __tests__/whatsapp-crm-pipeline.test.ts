const resolveInboundTenantContextMock = jest.fn();
const mapSenderToTenantActorMock = jest.fn();
const createSystemEventMock = jest.fn();
const routeInboundMock = jest.fn();
const processCopilotMessageMock = jest.fn();

const txMock = {
    contact: { upsert: jest.fn() },
    whatsAppConversation: { upsert: jest.fn(), update: jest.fn() },
    whatsAppMessage: { create: jest.fn() },
};

const mockPrisma = {
    contact: { findFirst: jest.fn() },
    whatsAppMessage: { findUnique: jest.fn() },
    deal: { findFirst: jest.fn(), create: jest.fn() },
    pipeline: { findFirst: jest.fn() },
    pipelineStage: { findFirst: jest.fn(), createMany: jest.fn() },
    activity: { create: jest.fn() },
    whatsAppConversation: { update: jest.fn() },
    $transaction: jest.fn(),
};

jest.mock("../lib/whatsapp/context-service", () => ({
    resolveInboundTenantContext: resolveInboundTenantContextMock,
    mapSenderToTenantActor: mapSenderToTenantActorMock,
}));

jest.mock("../lib/system-events", () => ({
    createSystemEvent: createSystemEventMock,
}));

jest.mock("../lib/whatsapp/engines/assignment-engine", () => ({
    routeInbound: routeInboundMock,
}));

jest.mock("../lib/ai/whatsapp-copilot", () => ({
    processCopilotMessage: processCopilotMessageMock,
}));

jest.mock("../lib/logger", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

jest.mock("../lib/prisma", () => ({
    prisma: mockPrisma,
}));

jest.mock("../lib/onboarding-status", () => ({
    recordOnboardingPipelineConfigured: jest.fn(async () => undefined),
    recordOnboardingFirstContact: jest.fn(async () => undefined),
    recordOnboardingFirstDeal: jest.fn(async () => undefined),
}));

jest.mock("../lib/whatsapp", () => ({
    normalizePhone: jest.fn((raw: string) => raw.replace(/\D/g, "").replace(/^(?!55)/, "55")),
}));

import { handleInboundWhatsAppMessage } from "../lib/whatsapp/inbound-pipeline";

describe("WhatsApp CRM inbound pipeline", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPrisma.$transaction.mockImplementation(async (input: unknown) => {
            if (typeof input === "function") {
                return input(txMock);
            }
            return input;
        });
        mockPrisma.contact.findFirst.mockResolvedValue(null);

        resolveInboundTenantContextMock.mockResolvedValue({
            organizationId: "org-1",
            orgSlug: "acme",
            phoneNumberId: "phone-number-id",
        });
        mapSenderToTenantActorMock.mockResolvedValue(null);
        createSystemEventMock.mockResolvedValue(undefined);
        routeInboundMock.mockResolvedValue(null);
        processCopilotMessageMock.mockResolvedValue(undefined);
    });

    test("first inbound persists contact, conversation, message and creates canonical deal plus activity", async () => {
        mockPrisma.whatsAppMessage.findUnique.mockResolvedValue(null);
        txMock.contact.upsert.mockResolvedValue({
            id: "contact-1",
            organizationId: "org-1",
            phoneNumberE164: "5511999999999",
            name: "Maria",
            optedOutAt: null,
            sessionWindowUntil: new Date("2026-03-17T12:00:00.000Z"),
            lastInboundAt: new Date("2026-03-16T12:00:00.000Z"),
            lastOutboundAt: null,
            lastMessageAt: new Date("2026-03-16T12:00:00.000Z"),
        });
        txMock.whatsAppConversation.upsert.mockResolvedValue({
            id: "conversation-1",
            organizationId: "org-1",
            contactId: "contact-1",
            assignedUserId: null,
            status: "open",
            unreadCount: 1,
            lastMessageAt: new Date("2026-03-16T12:00:00.000Z"),
            lastMessagePreview: "Oi, quero falar com vendas",
            slaDueAt: new Date("2026-03-16T14:00:00.000Z"),
        });
        txMock.whatsAppMessage.create.mockResolvedValue({
            id: "message-1",
            organizationId: "org-1",
            conversationId: "conversation-1",
            contactId: "contact-1",
            messageId: "wamid-1",
            direction: "inbound",
            type: "text",
            text: "Oi, quero falar com vendas",
            status: "received",
            sentAt: new Date("2026-03-16T12:00:00.000Z"),
            deliveredAt: new Date("2026-03-16T12:00:00.000Z"),
            readAt: null,
            failedAt: null,
            createdAt: new Date("2026-03-16T12:00:00.000Z"),
        });
        mockPrisma.deal.findFirst.mockResolvedValue(null);
        mockPrisma.pipeline.findFirst.mockResolvedValue({ id: "pipeline-1" });
        mockPrisma.pipelineStage.findFirst.mockResolvedValue({ id: "stage-1" });
        mockPrisma.deal.create.mockResolvedValue({ id: "deal-1" });
        mockPrisma.activity.create
            .mockResolvedValueOnce({ id: "activity-deal-created" })
            .mockResolvedValueOnce({ id: "activity-inbound-message" });

        const result = await handleInboundWhatsAppMessage({
            phoneNumberId: "phone-number-id",
            fromPhone: "5511999999999",
            profileName: "Maria",
            messageId: "wamid-1",
            messageText: "Oi, quero falar com vendas",
            timestamp: 1_763_000_000,
            type: "text",
            raw: { foo: "bar" },
        }, {
            organizationId: "org-1",
            orgSlug: "acme",
        });

        expect(result.contact.id).toBe("contact-1");
        expect(result.conversation.id).toBe("conversation-1");
        expect(result.message.id).toBe("message-1");
        expect(result.deal).toMatchObject({
            dealId: "deal-1",
            created: true,
            messageActivityId: "activity-inbound-message",
            dealCreatedActivityId: "activity-deal-created",
        });
        expect(result.sideEffects.synchronous).toContain("canonical_deal_link");
        expect(txMock.contact.upsert).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                organizationId_phoneNumberE164: {
                    organizationId: "org-1",
                    phoneNumberE164: "5511999999999",
                },
            },
        }));
        expect(txMock.whatsAppMessage.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                organizationId: "org-1",
                conversationId: "conversation-1",
                contactId: "contact-1",
                direction: "inbound",
            }),
        }));
    });

    test("subsequent inbound reuses the open canonical deal and only appends message activity", async () => {
        mockPrisma.whatsAppMessage.findUnique.mockResolvedValue(null);
        txMock.contact.upsert.mockResolvedValue({
            id: "contact-2",
            organizationId: "org-1",
            phoneNumberE164: "5511888888888",
            name: "Joao",
            optedOutAt: null,
            sessionWindowUntil: new Date("2026-03-17T15:00:00.000Z"),
            lastInboundAt: new Date("2026-03-16T15:00:00.000Z"),
            lastOutboundAt: null,
            lastMessageAt: new Date("2026-03-16T15:00:00.000Z"),
        });
        txMock.whatsAppConversation.upsert.mockResolvedValue({
            id: "conversation-2",
            organizationId: "org-1",
            contactId: "contact-2",
            assignedUserId: "user-1",
            status: "open",
            unreadCount: 3,
            lastMessageAt: new Date("2026-03-16T15:00:00.000Z"),
            lastMessagePreview: "Preciso de uma proposta",
            slaDueAt: new Date("2026-03-16T17:00:00.000Z"),
        });
        txMock.whatsAppMessage.create.mockResolvedValue({
            id: "message-2",
            organizationId: "org-1",
            conversationId: "conversation-2",
            contactId: "contact-2",
            messageId: "wamid-2",
            direction: "inbound",
            type: "text",
            text: "Preciso de uma proposta",
            status: "received",
            sentAt: new Date("2026-03-16T15:00:00.000Z"),
            deliveredAt: new Date("2026-03-16T15:00:00.000Z"),
            readAt: null,
            failedAt: null,
            createdAt: new Date("2026-03-16T15:00:00.000Z"),
        });
        mockPrisma.deal.findFirst.mockResolvedValue({
            id: "deal-existing",
            stage: { id: "stage-existing", pipelineId: "pipeline-existing" },
        });
        mockPrisma.activity.create.mockResolvedValue({ id: "activity-message-only" });

        const result = await handleInboundWhatsAppMessage({
            fromPhone: "5511888888888",
            profileName: "Joao",
            messageId: "wamid-2",
            messageText: "Preciso de uma proposta",
            timestamp: 1_763_010_000,
            type: "text",
            raw: { bar: "baz" },
        }, {
            organizationId: "org-1",
            orgSlug: "acme",
        });

        expect(result.deal).toMatchObject({
            dealId: "deal-existing",
            created: false,
            reused: true,
            messageActivityId: "activity-message-only",
            dealCreatedActivityId: null,
        });
        expect(mockPrisma.deal.create).not.toHaveBeenCalled();
        expect(mockPrisma.activity.create).toHaveBeenCalledTimes(1);
    });
});
