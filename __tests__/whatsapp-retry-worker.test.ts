const sendWhatsAppTextForOrgMock = jest.fn();
const sendWhatsAppTemplateForOrgMock = jest.fn();
const createSystemEventMock = jest.fn();

const mockPrisma = {
    actionQueue: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
    },
    whatsAppMessage: {
        findFirst: jest.fn(),
        update: jest.fn(),
    },
};

jest.mock("../lib/prisma", () => ({
    prisma: mockPrisma,
}));

jest.mock("../lib/logger", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

jest.mock("../lib/system-events", () => ({
    createSystemEvent: createSystemEventMock,
}));

jest.mock("../lib/whatsapp/meta-client", () => ({
    sendWhatsAppTextForOrg: sendWhatsAppTextForOrgMock,
    sendWhatsAppTemplateForOrg: sendWhatsAppTemplateForOrgMock,
}));

import { runDueWhatsAppRetryDispatch } from "../lib/whatsapp/retry-worker";

describe("WhatsApp retry worker", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        createSystemEventMock.mockResolvedValue(undefined);
        mockPrisma.actionQueue.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.actionQueue.update.mockResolvedValue(undefined);
    });

    test("retries a message in the correct tenant and updates the ledger", async () => {
        mockPrisma.actionQueue.findMany
            .mockResolvedValueOnce([{ id: "queue-1" }])
            .mockResolvedValueOnce([
                {
                    id: "queue-1",
                    organizationId: "org-1",
                    payloadJson: JSON.stringify({
                        jobType: "whatsapp_retry_message",
                        organizationId: "org-1",
                        messageRecordId: "message-1",
                        sourceExternalMessageId: "wamid-old",
                        sourceStatus: "failed",
                        failureClass: "retryable",
                        queuedAt: "2026-03-16T13:00:00.000Z",
                        delaySeconds: 300,
                        reason: "TRANSIENT_PROVIDER_FAILURE",
                    }),
                    attempts: 1,
                },
            ]);
        mockPrisma.whatsAppMessage.findFirst.mockResolvedValue({
            id: "message-1",
            organizationId: "org-1",
            messageId: "wamid-old",
            type: "text",
            text: "oi",
            errorJson: JSON.stringify({
                outboundRequest: { type: "text", text: "oi" },
            }),
            contact: {
                id: "contact-1",
                phoneNumberE164: "5511999999999",
            },
        });
        sendWhatsAppTextForOrgMock.mockResolvedValue({ messageId: "wamid-new" });

        const processed = await runDueWhatsAppRetryDispatch({ organizationId: "org-1" });

        expect(processed).toBe(1);
        expect(sendWhatsAppTextForOrgMock).toHaveBeenCalledWith("org-1", "5511999999999", "oi");
        expect(mockPrisma.whatsAppMessage.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "message-1" },
            data: expect.objectContaining({
                messageId: "wamid-new",
                status: "sent",
            }),
        }));
        const lastUpdateCall = mockPrisma.whatsAppMessage.update.mock.calls.at(-1);
        const updatePayload = lastUpdateCall?.[0].data.errorJson as string;
        expect(JSON.parse(updatePayload)).toMatchObject({
            statusLedger: {
                currentExternalMessageId: "wamid-new",
                currentStatus: "sent",
                retry: {
                    pendingQueueId: null,
                    totalExecuted: 1,
                    totalSucceeded: 1,
                },
            },
        });
        expect(mockPrisma.actionQueue.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "queue-1" },
            data: expect.objectContaining({
                status: "executed",
            }),
        }));
    });

    test("requeues transient execution failures without duplicating queue items", async () => {
        mockPrisma.actionQueue.findMany
            .mockResolvedValueOnce([{ id: "queue-2" }])
            .mockResolvedValueOnce([
                {
                    id: "queue-2",
                    organizationId: "org-1",
                    payloadJson: JSON.stringify({
                        jobType: "whatsapp_retry_message",
                        organizationId: "org-1",
                        messageRecordId: "message-2",
                        sourceExternalMessageId: "wamid-failed",
                        sourceStatus: "failed",
                        failureClass: "retryable",
                        queuedAt: "2026-03-16T13:00:00.000Z",
                        delaySeconds: 300,
                        reason: "TRANSIENT_PROVIDER_FAILURE",
                    }),
                    attempts: 1,
                },
            ]);
        mockPrisma.whatsAppMessage.findFirst.mockResolvedValue({
            id: "message-2",
            organizationId: "org-1",
            messageId: "wamid-failed",
            type: "text",
            text: "oi",
            errorJson: JSON.stringify({
                outboundRequest: { type: "text", text: "oi" },
            }),
            contact: {
                id: "contact-1",
                phoneNumberE164: "5511999999999",
            },
        });
        sendWhatsAppTextForOrgMock.mockResolvedValue({ messageId: null, error: "timeout" });

        const processed = await runDueWhatsAppRetryDispatch({ organizationId: "org-1" });

        expect(processed).toBe(1);
        expect(mockPrisma.actionQueue.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "queue-2" },
            data: expect.objectContaining({
                status: "pending",
            }),
        }));
        const requeueCall = mockPrisma.actionQueue.update.mock.calls.find(
            (call) => call[0].where.id === "queue-2" && call[0].data.status === "pending",
        );
        expect(requeueCall).toBeDefined();
    });

    test("rejects stale retry items when tenant context does not match", async () => {
        mockPrisma.actionQueue.findMany
            .mockResolvedValueOnce([{ id: "queue-3" }])
            .mockResolvedValueOnce([
                {
                    id: "queue-3",
                    organizationId: "org-1",
                    payloadJson: JSON.stringify({
                        jobType: "whatsapp_retry_message",
                        organizationId: "org-other",
                        messageRecordId: "message-3",
                        sourceExternalMessageId: "wamid-old",
                        sourceStatus: "failed",
                        failureClass: "retryable",
                        queuedAt: "2026-03-16T13:00:00.000Z",
                        delaySeconds: 300,
                        reason: "TRANSIENT_PROVIDER_FAILURE",
                    }),
                    attempts: 1,
                },
            ]);
        mockPrisma.whatsAppMessage.findFirst.mockResolvedValue({
            id: "message-3",
            organizationId: "org-1",
            messageId: "wamid-old",
            type: "text",
            text: "oi",
            errorJson: JSON.stringify({
                outboundRequest: { type: "text", text: "oi" },
            }),
            contact: {
                id: "contact-1",
                phoneNumberE164: "5511999999999",
            },
        });

        const processed = await runDueWhatsAppRetryDispatch({ organizationId: "org-1" });

        expect(processed).toBe(1);
        expect(sendWhatsAppTextForOrgMock).not.toHaveBeenCalled();
        expect(mockPrisma.actionQueue.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "queue-3" },
            data: expect.objectContaining({
                status: "rejected",
            }),
        }));
    });
});
