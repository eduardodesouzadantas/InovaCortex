const mockWebhookEndpointFindMany = jest.fn();
const mockWebhookEndpointCreate = jest.fn();
const mockWebhookEndpointFindFirst = jest.fn();
const mockWebhookEndpointUpdate = jest.fn();
const mockWebhookEndpointDelete = jest.fn();

jest.mock("../lib/prisma", () => ({
    prisma: {
        webhookEndpoint: {
            findMany: mockWebhookEndpointFindMany,
            create: mockWebhookEndpointCreate,
            findFirst: mockWebhookEndpointFindFirst,
            update: mockWebhookEndpointUpdate,
            delete: mockWebhookEndpointDelete,
        },
    },
}));

jest.mock("../lib/logger", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

jest.mock("../lib/public-api/webhook-delivery", () => ({
    dispatchWebhookEvent: jest.fn(),
    generateWebhookEndpointSecret: jest.fn(() => "whsec_test_secret"),
}));

import {
    createWebhookEndpoint,
    deleteWebhookEndpoint,
    listWebhookEndpoints,
    parseWebhookSubscribedEvents,
    updateWebhookEndpoint,
    validateWebhookDestinationUrl,
} from "../lib/public-api/webhooks";

describe("webhooks service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockWebhookEndpointFindMany.mockResolvedValue([]);
    });

    it("creates a webhook endpoint with a private secret", async () => {
        mockWebhookEndpointCreate.mockResolvedValueOnce({
            id: "wh_1",
            url: "https://example.com/webhook",
            isActive: true,
            subscribedEvents: ["contact.created", "deal.updated"],
            lastDeliveryAt: null,
            lastDeliveryStatus: null,
            lastDeliveryError: null,
            deliveryAttemptCount: 0,
            createdAt: new Date("2026-03-18T12:00:00.000Z"),
            updatedAt: new Date("2026-03-18T12:00:00.000Z"),
            secretEncrypted: "encrypted",
        });

        const result = await createWebhookEndpoint({
            organizationId: "org-1",
            url: "https://example.com/webhook",
            subscribedEvents: ["contact.created", "deal.updated"],
        });

        expect(result.secret).toBe("whsec_test_secret");
        expect(result.webhook.secretConfigured).toBe(true);
        expect(mockWebhookEndpointCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                organizationId: "org-1",
                url: "https://example.com/webhook",
                subscribedEvents: ["contact.created", "deal.updated"],
            }),
        }));
    });

    it("lists webhook endpoints within tenant scope", async () => {
        mockWebhookEndpointFindMany.mockResolvedValueOnce([
            {
                id: "wh_1",
                url: "https://example.com/webhook",
                isActive: true,
                subscribedEvents: ["contact.created"],
                lastDeliveryAt: new Date("2026-03-18T12:00:00.000Z"),
                lastDeliveryStatus: "delivered",
                lastDeliveryError: null,
                deliveryAttemptCount: 2,
                createdAt: new Date("2026-03-18T11:00:00.000Z"),
                updatedAt: new Date("2026-03-18T12:00:00.000Z"),
                secretEncrypted: "encrypted",
            },
        ]);

        const result = await listWebhookEndpoints("org-1");

        expect(mockWebhookEndpointFindMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { organizationId: "org-1" },
        }));
        expect(result.webhooks[0]?.lastDeliveryStatus).toBe("delivered");
        expect(result.supportedEvents).toContain("message.received");
    });

    it("updates and deletes webhook endpoints within tenant scope", async () => {
        mockWebhookEndpointFindFirst.mockResolvedValueOnce({
            id: "wh_1",
            url: "https://example.com/webhook",
            isActive: true,
            subscribedEvents: ["contact.created"],
            lastDeliveryAt: null,
            lastDeliveryStatus: null,
            lastDeliveryError: null,
            deliveryAttemptCount: 0,
            createdAt: new Date("2026-03-18T11:00:00.000Z"),
            updatedAt: new Date("2026-03-18T11:00:00.000Z"),
            secretEncrypted: "encrypted",
        });
        mockWebhookEndpointUpdate.mockResolvedValueOnce({
            id: "wh_1",
            url: "https://example.com/new-webhook",
            isActive: false,
            subscribedEvents: ["deal.created"],
            lastDeliveryAt: null,
            lastDeliveryStatus: null,
            lastDeliveryError: null,
            deliveryAttemptCount: 0,
            createdAt: new Date("2026-03-18T11:00:00.000Z"),
            updatedAt: new Date("2026-03-18T12:00:00.000Z"),
            secretEncrypted: "encrypted",
        });

        const updateResult = await updateWebhookEndpoint({
            organizationId: "org-1",
            endpointId: "wh_1",
            url: "https://example.com/new-webhook",
            subscribedEvents: ["deal.created"],
            isActive: false,
            rotateSecret: true,
        });

        expect(updateResult.secret).toBe("whsec_test_secret");
        expect(mockWebhookEndpointFindFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                id: "wh_1",
                organizationId: "org-1",
            },
        }));
        expect(mockWebhookEndpointUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "wh_1" },
        }));

        mockWebhookEndpointFindFirst.mockResolvedValueOnce({ id: "wh_1" });
        await deleteWebhookEndpoint({
            organizationId: "org-1",
            endpointId: "wh_1",
        });

        expect(mockWebhookEndpointDelete).toHaveBeenCalledWith({
            where: { id: "wh_1" },
        });
    });

    it("validates webhook urls and subscribed events", () => {
        expect(validateWebhookDestinationUrl("https://example.com/webhook")).toBe("https://example.com/webhook");
        expect(() => validateWebhookDestinationUrl("ftp://example.com")).toThrow("WEBHOOK_URL_INVALID");
        expect(parseWebhookSubscribedEvents(["contact.created", "deal.created"])).toEqual(["contact.created", "deal.created"]);
        expect(() => parseWebhookSubscribedEvents([])).toThrow("WEBHOOK_EVENTS_REQUIRED");
    });
});

