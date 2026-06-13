const writeAuditEventMock = jest.fn();
const sendWhatsAppTextForOrgMock = jest.fn();
const sendWhatsAppTemplateForOrgMock = jest.fn();

const mockPrisma = {
    organization: { findUnique: jest.fn() },
    whatsAppConversation: { findFirst: jest.fn(), update: jest.fn() },
    whatsAppMessage: { create: jest.fn() },
    contact: { update: jest.fn() },
    deal: { findFirst: jest.fn(), create: jest.fn() },
    pipeline: { findFirst: jest.fn() },
    pipelineStage: { findFirst: jest.fn(), createMany: jest.fn() },
    activity: { create: jest.fn() },
    whatsAppTemplate: { findFirst: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
};

jest.mock("../lib/audit", () => ({
    writeAuditEvent: writeAuditEventMock,
}));

jest.mock("../lib/whatsapp/meta-client", () => ({
    sendWhatsAppTextForOrg: sendWhatsAppTextForOrgMock,
    sendWhatsAppTemplateForOrg: sendWhatsAppTemplateForOrgMock,
}));

jest.mock("../lib/prisma", () => ({
    prisma: mockPrisma,
}));

jest.mock("../lib/whatsapp", () => ({
    normalizePhone: jest.fn((raw: string) => raw.replace(/\D/g, "").replace(/^(?!55)/, "55")),
}));

import { sendOutboundWhatsAppMessage } from "../lib/whatsapp/outbound-service";

describe("WhatsApp outbound pipeline", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPrisma.organization.findUnique.mockResolvedValue({ subscriptionStatus: "trial" });
        mockPrisma.$transaction.mockImplementation(async (input: unknown) => {
            if (Array.isArray(input)) {
                return Promise.all(input);
            }
            if (typeof input === "function") {
                return input(mockPrisma);
            }
            return input;
        });
    });

    test("denies closer when conversation belongs to another assignee", async () => {
        mockPrisma.whatsAppConversation.findFirst.mockResolvedValue({
            id: "conversation-1",
            organizationId: "org-1",
            contactId: "contact-1",
            assignedUserId: "user-other",
            status: "open",
            unreadCount: 0,
            lastMessageAt: new Date("2026-03-16T12:00:00.000Z"),
            lastMessagePreview: "Ultima mensagem",
            slaDueAt: new Date("2026-03-16T14:00:00.000Z"),
            contact: {
                id: "contact-1",
                organizationId: "org-1",
                phoneNumberE164: "5511999999999",
                name: "Maria",
                optedOutAt: null,
                sessionWindowUntil: new Date("2026-03-17T12:00:00.000Z"),
                lastInboundAt: new Date("2026-03-16T12:00:00.000Z"),
                lastOutboundAt: null,
                lastMessageAt: new Date("2026-03-16T12:00:00.000Z"),
            },
        });

        await expect(sendOutboundWhatsAppMessage({
            organizationId: "org-1",
            role: "closer",
            userId: "user-1",
            request: {
                conversationId: "conversation-1",
                type: "text",
                text: "Vou te enviar a proposta",
                templateName: "",
                templateLanguage: "",
            },
        })).rejects.toThrow("FORBIDDEN");
    });

    test("persists outbound message and reuses the canonical deal for the conversation contact", async () => {
        mockPrisma.whatsAppConversation.findFirst.mockResolvedValue({
            id: "conversation-2",
            organizationId: "org-1",
            contactId: "contact-2",
            assignedUserId: "user-1",
            status: "open",
            unreadCount: 1,
            lastMessageAt: new Date("2026-03-16T15:00:00.000Z"),
            lastMessagePreview: "Preciso de uma proposta",
            slaDueAt: new Date("2026-03-16T17:00:00.000Z"),
            contact: {
                id: "contact-2",
                organizationId: "org-1",
                phoneNumberE164: "5511888888888",
                name: "Joao",
                optedOutAt: null,
                sessionWindowUntil: new Date(Date.now() + 1000 * 60 * 60 * 24),
                lastInboundAt: new Date("2026-03-16T15:00:00.000Z"),
                lastOutboundAt: null,
                lastMessageAt: new Date("2026-03-16T15:00:00.000Z"),
            },
        });
        sendWhatsAppTextForOrgMock.mockResolvedValue({ messageId: "wamid-out-1" });
        mockPrisma.whatsAppMessage.create.mockResolvedValue({
            id: "message-out-1",
            organizationId: "org-1",
            conversationId: "conversation-2",
            contactId: "contact-2",
            messageId: "wamid-out-1",
            direction: "outbound",
            type: "text",
            text: "Segue a proposta",
            status: "sent",
            sentAt: new Date("2026-03-16T15:05:00.000Z"),
            deliveredAt: null,
            readAt: null,
            failedAt: null,
            createdAt: new Date("2026-03-16T15:05:00.000Z"),
        });
        mockPrisma.contact.update.mockResolvedValue({
            id: "contact-2",
            organizationId: "org-1",
            phoneNumberE164: "5511888888888",
            name: "Joao",
            optedOutAt: null,
            sessionWindowUntil: new Date("2026-03-17T15:00:00.000Z"),
            lastInboundAt: new Date("2026-03-16T15:00:00.000Z"),
            lastOutboundAt: new Date("2026-03-16T15:05:00.000Z"),
            lastMessageAt: new Date("2026-03-16T15:05:00.000Z"),
        });
        mockPrisma.whatsAppConversation.update.mockResolvedValue({
            id: "conversation-2",
            organizationId: "org-1",
            contactId: "contact-2",
            assignedUserId: "user-1",
            status: "open",
            unreadCount: 1,
            lastMessageAt: new Date("2026-03-16T15:05:00.000Z"),
            lastMessagePreview: "Segue a proposta",
            slaDueAt: new Date("2026-03-16T17:00:00.000Z"),
        });
        mockPrisma.deal.findFirst.mockResolvedValue({
            id: "deal-existing",
            stage: { id: "stage-existing", pipelineId: "pipeline-existing" },
        });
        mockPrisma.activity.create.mockResolvedValue({ id: "activity-outbound-message" });
        writeAuditEventMock.mockResolvedValue(undefined);

        const result = await sendOutboundWhatsAppMessage({
            organizationId: "org-1",
            role: "admin",
            userId: "user-1",
            request: {
                conversationId: "conversation-2",
                type: "text",
                text: "Segue a proposta",
                templateName: "",
                templateLanguage: "",
            },
        });

        expect(result).toMatchObject({
            ok: true,
            result: {
                deal: {
                    dealId: "deal-existing",
                    reused: true,
                    messageActivityId: "activity-outbound-message",
                },
            },
        });
        expect(sendWhatsAppTextForOrgMock).toHaveBeenCalledWith("org-1", "5511888888888", "Segue a proposta");
        expect(mockPrisma.whatsAppMessage.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                organizationId: "org-1",
                conversationId: "conversation-2",
                contactId: "contact-2",
                direction: "outbound",
            }),
        }));
        expect(writeAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
            organizationId: "org-1",
            action: "whatsappMessageSent",
        }));
    });

    test("blocks outbound WhatsApp when billing is suspended", async () => {
        mockPrisma.organization.findUnique.mockResolvedValueOnce({ subscriptionStatus: "suspended" });
        mockPrisma.whatsAppConversation.findFirst.mockResolvedValueOnce({
            id: "conversation-3",
            organizationId: "org-1",
            contactId: "contact-3",
            assignedUserId: "user-1",
            status: "open",
            unreadCount: 0,
            lastMessageAt: new Date("2026-03-16T12:00:00.000Z"),
            lastMessagePreview: "Preciso de ajuda",
            slaDueAt: new Date("2026-03-16T14:00:00.000Z"),
            contact: {
                id: "contact-3",
                organizationId: "org-1",
                phoneNumberE164: "5511999999999",
                name: "Maria",
                optedOutAt: null,
                sessionWindowUntil: new Date(Date.now() + 1000 * 60 * 60 * 24),
                lastInboundAt: null,
                lastOutboundAt: null,
                lastMessageAt: null,
            },
        });

        const result = await sendOutboundWhatsAppMessage({
            organizationId: "org-1",
            role: "admin",
            userId: "user-1",
            request: {
                conversationId: "conversation-3",
                type: "text",
                text: "Olá",
                templateName: "",
                templateLanguage: "",
            },
        });

        expect(result).toMatchObject({
            ok: false,
            code: "FORBIDDEN",
            status: 403,
        });
        expect(sendWhatsAppTextForOrgMock).not.toHaveBeenCalled();
    });
});
