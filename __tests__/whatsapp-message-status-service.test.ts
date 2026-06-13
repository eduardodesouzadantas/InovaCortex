const createSystemEventMock = jest.fn();
const enqueueWhatsAppRetryMock = jest.fn();
const reconcileLegacyMessageLogMock = jest.fn();

const mockPrisma = {
    whatsAppMessage: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
    },
};

jest.mock("../lib/system-events", () => ({
    createSystemEvent: createSystemEventMock,
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

jest.mock("../lib/whatsapp/retry-service", () => ({
    enqueueWhatsAppRetry: enqueueWhatsAppRetryMock,
}));

jest.mock("../lib/whatsapp/legacy-message-log-adapter", () => ({
    reconcileLegacyMessageLog: reconcileLegacyMessageLogMock,
}));

import { reconcileMetaMessageStatusEvent } from "../lib/whatsapp/message-status-service";

describe("WhatsApp message status reconciliation", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        createSystemEventMock.mockResolvedValue(undefined);
        enqueueWhatsAppRetryMock.mockResolvedValue({
            queueId: "retry-queue-1",
            queued: true,
            state: "scheduled",
            scheduledFor: "2026-03-16T13:05:00.000Z",
            reason: "TRANSIENT_PROVIDER_FAILURE",
        });
        reconcileLegacyMessageLogMock.mockResolvedValue(false);
        mockPrisma.whatsAppMessage.findFirst.mockResolvedValue(null);
        mockPrisma.whatsAppMessage.update.mockResolvedValue(undefined);
    });

    test("applies delivered status in the correct tenant context", async () => {
        mockPrisma.whatsAppMessage.findUnique.mockResolvedValue({
            id: "message-1",
            organizationId: "org-1",
            messageId: "wamid-1",
            status: "sent",
            errorJson: null,
            sentAt: new Date("2026-03-16T12:00:00.000Z"),
            deliveredAt: null,
            readAt: null,
            failedAt: null,
            createdAt: new Date("2026-03-16T11:59:00.000Z"),
        });

        const result = await reconcileMetaMessageStatusEvent({
            id: "wamid-1",
            status: "delivered",
            timestamp: "1763001000",
        });

        expect(result).toMatchObject({
            outcome: "applied",
            organizationId: "org-1",
            lifecycleStatus: "delivered",
            nextStatus: "delivered",
            retryExecution: {
                state: "not_applicable",
            },
        });
        expect(mockPrisma.whatsAppMessage.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "message-1" },
            data: expect.objectContaining({ status: "delivered" }),
        }));
        expect(createSystemEventMock).toHaveBeenCalledWith(expect.objectContaining({
            organizationId: "org-1",
            type: "whatsapp_status_reconciled",
        }));
        expect(enqueueWhatsAppRetryMock).not.toHaveBeenCalled();
    });

    test("applies read after delivered", async () => {
        mockPrisma.whatsAppMessage.findUnique.mockResolvedValue({
            id: "message-2",
            organizationId: "org-1",
            messageId: "wamid-2",
            status: "delivered",
            errorJson: null,
            sentAt: new Date("2026-03-16T12:00:00.000Z"),
            deliveredAt: new Date("2026-03-16T12:01:00.000Z"),
            readAt: null,
            failedAt: null,
            createdAt: new Date("2026-03-16T11:59:00.000Z"),
        });

        const result = await reconcileMetaMessageStatusEvent({
            id: "wamid-2",
            status: "read",
            timestamp: "1763001060",
        });

        expect(result).toMatchObject({
            outcome: "applied",
            lifecycleStatus: "read",
            nextStatus: "read",
        });
    });

    test("classifies retryable failures and schedules retry execution", async () => {
        mockPrisma.whatsAppMessage.findUnique.mockResolvedValue({
            id: "message-3",
            organizationId: "org-2",
            messageId: "wamid-3",
            status: "sent",
            errorJson: JSON.stringify({
                outboundRequest: { type: "text", text: "oi" },
            }),
            sentAt: new Date("2026-03-16T13:00:00.000Z"),
            deliveredAt: null,
            readAt: null,
            failedAt: null,
            createdAt: new Date("2026-03-16T12:59:00.000Z"),
        });

        const result = await reconcileMetaMessageStatusEvent({
            id: "wamid-3",
            status: "failed",
            timestamp: "1763002000",
            errors: [{ code: 130429, message: "Rate limit hit" }],
        });

        expect(result).toMatchObject({
            outcome: "applied",
            lifecycleStatus: "failed",
            failureClass: "retryable",
            retryDecision: {
                eligible: true,
                delaySeconds: 300,
                reason: "TRANSIENT_PROVIDER_FAILURE",
            },
            retryExecution: {
                queueId: "retry-queue-1",
                state: "scheduled",
            },
        });
        expect(enqueueWhatsAppRetryMock).toHaveBeenCalledWith({
            organizationId: "org-2",
            messageRecordId: "message-3",
            sourceExternalMessageId: "wamid-3",
            sourceStatus: "failed",
            failureClass: "retryable",
            delaySeconds: 300,
            reason: "TRANSIENT_PROVIDER_FAILURE",
        });
        expect(createSystemEventMock).toHaveBeenCalledWith(expect.objectContaining({
            severity: "warn",
        }));
    });

    test("classifies terminal failures without retry scheduling", async () => {
        mockPrisma.whatsAppMessage.findUnique.mockResolvedValue({
            id: "message-4",
            organizationId: "org-2",
            messageId: "wamid-4",
            status: "sent",
            errorJson: null,
            sentAt: new Date("2026-03-16T13:00:00.000Z"),
            deliveredAt: null,
            readAt: null,
            failedAt: null,
            createdAt: new Date("2026-03-16T12:59:00.000Z"),
        });

        const result = await reconcileMetaMessageStatusEvent({
            id: "wamid-4",
            status: "failed",
            timestamp: "1763002001",
            errors: [{ code: 999999, message: "Permanent policy error" }],
        });

        expect(result).toMatchObject({
            outcome: "applied",
            lifecycleStatus: "failed",
            failureClass: "terminal",
            retryDecision: {
                eligible: false,
                delaySeconds: null,
                reason: "TERMINAL_PROVIDER_FAILURE",
            },
            retryExecution: {
                state: "not_applicable",
            },
        });
        expect(enqueueWhatsAppRetryMock).not.toHaveBeenCalled();
        expect(createSystemEventMock).toHaveBeenCalledWith(expect.objectContaining({
            severity: "error",
        }));
    });

    test("ignores duplicate events", async () => {
        mockPrisma.whatsAppMessage.findUnique.mockResolvedValue({
            id: "message-5",
            organizationId: "org-3",
            messageId: "wamid-5",
            status: "delivered",
            errorJson: null,
            sentAt: new Date("2026-03-16T14:00:00.000Z"),
            deliveredAt: new Date("2026-03-16T14:01:00.000Z"),
            readAt: null,
            failedAt: null,
            createdAt: new Date("2026-03-16T13:59:00.000Z"),
        });

        const result = await reconcileMetaMessageStatusEvent({
            id: "wamid-5",
            status: "delivered",
            timestamp: "1763002860",
        });

        expect(result.outcome).toBe("duplicate");
        expect(mockPrisma.whatsAppMessage.update).not.toHaveBeenCalled();
        expect(enqueueWhatsAppRetryMock).not.toHaveBeenCalled();
    });

    test("ignores out-of-order events", async () => {
        mockPrisma.whatsAppMessage.findUnique.mockResolvedValue({
            id: "message-6",
            organizationId: "org-4",
            messageId: "wamid-6",
            status: "delivered",
            errorJson: null,
            sentAt: new Date("2026-03-16T14:00:00.000Z"),
            deliveredAt: new Date("2026-03-16T14:02:00.000Z"),
            readAt: null,
            failedAt: null,
            createdAt: new Date("2026-03-16T13:59:00.000Z"),
        });

        const result = await reconcileMetaMessageStatusEvent({
            id: "wamid-6",
            status: "sent",
            timestamp: "1763002800",
        });

        expect(result.outcome).toBe("ignored_out_of_order");
        expect(mockPrisma.whatsAppMessage.update).not.toHaveBeenCalled();
    });
});
