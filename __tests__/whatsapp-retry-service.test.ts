const createSystemEventMock = jest.fn();
const enqueueSystemSchedulerJobsMock = jest.fn();
const triggerSystemSchedulerWorkerMock = jest.fn();

const mockPrisma = {
    whatsAppMessage: {
        findFirst: jest.fn(),
        update: jest.fn(),
    },
    actionQueue: {
        findFirst: jest.fn(),
        create: jest.fn(),
    },
};

jest.mock("../lib/prisma", () => ({
    prisma: mockPrisma,
}));

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

jest.mock("../workers/system-scheduler", () => ({
    enqueueSystemSchedulerJobs: enqueueSystemSchedulerJobsMock,
    triggerSystemSchedulerWorker: triggerSystemSchedulerWorkerMock,
}));

import { enqueueWhatsAppRetry } from "../lib/whatsapp/retry-service";

describe("WhatsApp retry enqueue", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        createSystemEventMock.mockResolvedValue(undefined);
        enqueueSystemSchedulerJobsMock.mockResolvedValue({ success: true });
        triggerSystemSchedulerWorkerMock.mockResolvedValue(undefined);
        mockPrisma.whatsAppMessage.update.mockResolvedValue(undefined);
    });

    test("schedules a retry queue item and triggers the worker pipeline", async () => {
        mockPrisma.whatsAppMessage.findFirst.mockResolvedValue({
            id: "message-1",
            organizationId: "org-1",
            errorJson: JSON.stringify({
                outboundRequest: { type: "text", text: "oi" },
            }),
        });
        mockPrisma.actionQueue.findFirst.mockResolvedValue(null);
        mockPrisma.actionQueue.create.mockResolvedValue({ id: "queue-1" });

        const result = await enqueueWhatsAppRetry({
            organizationId: "org-1",
            messageRecordId: "message-1",
            sourceExternalMessageId: "wamid-1",
            sourceStatus: "failed",
            failureClass: "retryable",
            delaySeconds: 300,
            reason: "TRANSIENT_PROVIDER_FAILURE",
        });

        expect(result).toMatchObject({
            queueId: "queue-1",
            queued: true,
            state: "scheduled",
        });
        expect(mockPrisma.actionQueue.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                organizationId: "org-1",
                type: "whatsapp_retry_message",
                relatedEntityType: "whatsapp_message",
                relatedEntityId: "message-1",
                status: "pending",
            }),
        }));
        expect(enqueueSystemSchedulerJobsMock).toHaveBeenCalledWith(expect.objectContaining({
            queueOrganizationId: "org-1",
            orgId: "org-1",
            jobs: ["whatsapp_retry_dispatch"],
        }));
        expect(triggerSystemSchedulerWorkerMock).toHaveBeenCalledTimes(1);
    });

    test("does not create duplicate retry queue items for the same message", async () => {
        mockPrisma.whatsAppMessage.findFirst.mockResolvedValue({
            id: "message-2",
            organizationId: "org-1",
            errorJson: JSON.stringify({
                outboundRequest: { type: "text", text: "oi" },
            }),
        });
        mockPrisma.actionQueue.findFirst.mockResolvedValue({
            id: "queue-existing",
            nextRetryAt: new Date("2026-03-16T13:05:00.000Z"),
        });

        const result = await enqueueWhatsAppRetry({
            organizationId: "org-1",
            messageRecordId: "message-2",
            sourceExternalMessageId: "wamid-2",
            sourceStatus: "failed",
            failureClass: "retryable",
            delaySeconds: 300,
            reason: "TRANSIENT_PROVIDER_FAILURE",
        });

        expect(result).toMatchObject({
            queueId: "queue-existing",
            queued: false,
            state: "duplicate_pending",
        });
        expect(mockPrisma.actionQueue.create).not.toHaveBeenCalled();
        expect(enqueueSystemSchedulerJobsMock).not.toHaveBeenCalled();
    });
});
