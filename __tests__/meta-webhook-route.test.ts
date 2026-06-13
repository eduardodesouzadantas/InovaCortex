const processMetaWebhookBodyMock = jest.fn();
const verifyMetaSignatureMock = jest.fn();
const parseWebhookJsonMock = jest.fn();
const logWebhookFailureMock = jest.fn();
const logWebhookProcessedMock = jest.fn();
const logWebhookReceivedMock = jest.fn();
const logWebhookRejectedMock = jest.fn();

process.env.META_APP_SECRET = "app-secret";
process.env.META_VERIFY_TOKEN = "verify-token";

jest.mock("../lib/logger", () => ({
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
}));

jest.mock("../lib/whatsapp/meta-webhook-service", () => ({
    processMetaWebhookBody: processMetaWebhookBodyMock,
}));

jest.mock("../lib/webhooks/security", () => ({
    verifyMetaSignature: verifyMetaSignatureMock,
    parseWebhookJson: parseWebhookJsonMock,
    logWebhookFailure: logWebhookFailureMock,
    logWebhookProcessed: logWebhookProcessedMock,
    logWebhookReceived: logWebhookReceivedMock,
    logWebhookRejected: logWebhookRejectedMock,
}));

import { POST } from "../app/api/webhooks/meta/route";

describe("Meta webhook route", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("delegates provider webhook processing to the canonical service", async () => {
        verifyMetaSignatureMock.mockReturnValue(true);
        parseWebhookJsonMock.mockReturnValue({
            object: "whatsapp_business_account",
            entry: [],
        });
        processMetaWebhookBodyMock.mockResolvedValue({
            inboundResults: [],
            statusResults: [
                {
                    outcome: "applied",
                    organizationId: "org-1",
                    messageRecordId: "message-1",
                    externalMessageId: "wamid-1",
                    previousStatus: "sent",
                    nextStatus: "delivered",
                    lifecycleStatus: "delivered",
                    failureClass: null,
                    reason: "STATUS_APPLIED",
                    sideEffects: {
                        synchronous: ["message_status_reconciliation"],
                        asyncCandidates: [],
                    },
                },
            ],
        });

        const response = await POST(new Request("http://localhost/api/webhooks/meta", {
            method: "POST",
            headers: {
                "x-hub-signature-256": "sha256=valid",
            },
            body: JSON.stringify({ object: "whatsapp_business_account", entry: [] }),
        }));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            inboundCount: 0,
            statusCount: 1,
            statusSummary: { applied: 1 },
        });
        expect(processMetaWebhookBodyMock).toHaveBeenCalledTimes(1);
    });
});
