const mockWebhookEndpointFindMany = jest.fn();
const mockWebhookEndpointUpdate = jest.fn();
const mockWebhookDeliveryUpsert = jest.fn();
const mockWebhookDeliveryUpdate = jest.fn();

jest.mock("../lib/prisma", () => ({
    prisma: {
        webhookEndpoint: {
            findMany: mockWebhookEndpointFindMany,
            update: mockWebhookEndpointUpdate,
        },
        webhookDelivery: {
            upsert: mockWebhookDeliveryUpsert,
            update: mockWebhookDeliveryUpdate,
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

import { encrypt } from "../lib/security/crypto";
import { dispatchWebhookEvent } from "../lib/public-api/webhook-delivery";
import { verifyWebhookPayloadSignature } from "../lib/public-api/webhook-signature";

type EndpointState = {
    id: string;
    organizationId: string;
    url: string;
    secretEncrypted: string;
    isActive: boolean;
    subscribedEvents: string[];
    lastDeliveryAt: Date | null;
    lastDeliveryStatus: string | null;
    lastDeliveryError: string | null;
    deliveryAttemptCount: number;
};

type DeliveryState = {
    id: string;
    organizationId: string;
    webhookEndpointId: string;
    eventId: string;
    eventType: string;
    payloadJson: string;
    attemptCount: number;
    status: string;
    responseCode: number | null;
    errorSummary: string | null;
    lastAttemptAt: Date | null;
    deliveredAt: Date | null;
};

function createMockDb(seed?: Partial<EndpointState>) {
    const endpoints: EndpointState[] = [
        {
            id: "wh_1",
            organizationId: "org-1",
            url: "https://example.com/webhook",
            secretEncrypted: encrypt("whsec_test_secret"),
            isActive: true,
            subscribedEvents: ["contact.created"],
            lastDeliveryAt: null,
            lastDeliveryStatus: null,
            lastDeliveryError: null,
            deliveryAttemptCount: 0,
            ...seed,
        },
    ];

    const deliveries: DeliveryState[] = [];

    mockWebhookEndpointFindMany.mockImplementation(async ({ where }) => {
        return endpoints.filter((endpoint) =>
            endpoint.organizationId === where.organizationId &&
            (!where.isActive || endpoint.isActive === where.isActive) &&
            (!where.subscribedEvents || endpoint.subscribedEvents.includes(where.subscribedEvents.has)),
        );
    });

    mockWebhookEndpointUpdate.mockImplementation(async ({ where, data }) => {
        const endpoint = endpoints.find((item) => item.id === where.id);
        if (!endpoint) {
            throw new Error("WEBHOOK_ENDPOINT_NOT_FOUND");
        }
        if (typeof data.lastDeliveryAt !== "undefined") endpoint.lastDeliveryAt = data.lastDeliveryAt;
        if (typeof data.lastDeliveryStatus !== "undefined") endpoint.lastDeliveryStatus = data.lastDeliveryStatus;
        if (typeof data.lastDeliveryError !== "undefined") endpoint.lastDeliveryError = data.lastDeliveryError;
        if (typeof data.deliveryAttemptCount !== "undefined") {
            if (typeof data.deliveryAttemptCount === "number") {
                endpoint.deliveryAttemptCount = data.deliveryAttemptCount;
            } else {
                endpoint.deliveryAttemptCount += data.deliveryAttemptCount.increment;
            }
        }
        return endpoint;
    });

    mockWebhookDeliveryUpsert.mockImplementation(async ({ where, create, update }) => {
        const existing = deliveries.find((item) => item.webhookEndpointId === where.webhookEndpointId_eventId.webhookEndpointId && item.eventId === where.webhookEndpointId_eventId.eventId);
        if (existing) {
            if (typeof update.eventType !== "undefined") existing.eventType = update.eventType;
            if (typeof update.payloadJson !== "undefined") existing.payloadJson = update.payloadJson;
            if (typeof update.status !== "undefined") existing.status = update.status;
            return existing;
        }
        const next: DeliveryState = {
            id: `delivery-${deliveries.length + 1}`,
            organizationId: create.organizationId,
            webhookEndpointId: create.webhookEndpointId,
            eventId: create.eventId,
            eventType: create.eventType,
            payloadJson: create.payloadJson,
            attemptCount: create.attemptCount,
            status: create.status,
            responseCode: null,
            errorSummary: null,
            lastAttemptAt: null,
            deliveredAt: null,
        };
        deliveries.push(next);
        return next;
    });

    mockWebhookDeliveryUpdate.mockImplementation(async ({ where, data }) => {
        const delivery = deliveries.find((item) => item.webhookEndpointId === where.webhookEndpointId_eventId.webhookEndpointId && item.eventId === where.webhookEndpointId_eventId.eventId);
        if (!delivery) {
            throw new Error("WEBHOOK_DELIVERY_NOT_FOUND");
        }
        if (typeof data.attemptCount !== "undefined") {
            if (typeof data.attemptCount === "number") {
                delivery.attemptCount = data.attemptCount;
            } else {
                delivery.attemptCount += data.attemptCount.increment;
            }
        }
        if (typeof data.status !== "undefined") delivery.status = data.status;
        if (typeof data.responseCode !== "undefined") delivery.responseCode = data.responseCode;
        if (typeof data.errorSummary !== "undefined") delivery.errorSummary = data.errorSummary;
        if (typeof data.lastAttemptAt !== "undefined") delivery.lastAttemptAt = data.lastAttemptAt;
        if (typeof data.deliveredAt !== "undefined") delivery.deliveredAt = data.deliveredAt;
        return delivery;
    });

    return { endpoints, deliveries };
}

describe("webhook delivery", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("delivers a signed payload to subscribed endpoints", async () => {
        const { deliveries, endpoints } = createMockDb();
        const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
            expect(url).toBe("https://example.com/webhook");
            expect(init?.method).toBe("POST");
            const body = typeof init?.body === "string" ? init.body : "";
            const headers = new Headers(init?.headers);
            expect(headers.get("X-InovaCortex-Event")).toBe("contact.created");
            expect(headers.get("X-InovaCortex-Event-Id")).toBe("evt_contact_1");
            expect(headers.get("X-InovaCortex-Webhook-Id")).toBe("wh_1");
            expect(verifyWebhookPayloadSignature(
                "whsec_test_secret",
                headers.get("X-InovaCortex-Timestamp") ?? "",
                body,
                headers.get("X-InovaCortex-Signature"),
            )).toBe(true);
            return new Response("ok", { status: 200 });
        });

        global.fetch = fetchMock as unknown as typeof fetch;

        const result = await dispatchWebhookEvent({
            organizationId: "org-1",
            eventType: "contact.created",
            eventId: "evt_contact_1",
            data: {
                contact: {
                    id: "contact-1",
                    email: "lead@example.com",
                },
            },
            db: {
                webhookEndpoint: {
                    findMany: mockWebhookEndpointFindMany,
                    update: mockWebhookEndpointUpdate,
                },
                webhookDelivery: {
                    upsert: mockWebhookDeliveryUpsert,
                    update: mockWebhookDeliveryUpdate,
                },
            } as never,
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({
            attempted: 1,
            delivered: 1,
            failed: 0,
            skipped: false,
            event: {
                id: "evt_contact_1",
                type: "contact.created",
                organizationId: "org-1",
            },
        });
        expect(deliveries[0]?.status).toBe("delivered");
        expect(endpoints[0]?.lastDeliveryStatus).toBe("delivered");
        expect(endpoints[0]?.deliveryAttemptCount).toBe(1);
    });

    it("retries transient failures before succeeding", async () => {
        const { endpoints } = createMockDb();
        const fetchMock = jest.fn()
            .mockResolvedValueOnce(new Response("temporarily unavailable", { status: 503 }))
            .mockResolvedValueOnce(new Response("ok", { status: 200 }));
        global.fetch = fetchMock as unknown as typeof fetch;

        const result = await dispatchWebhookEvent({
            organizationId: "org-1",
            eventType: "contact.created",
            eventId: "evt_contact_2",
            data: { contact: { id: "contact-2" } },
            db: {
                webhookEndpoint: {
                    findMany: mockWebhookEndpointFindMany,
                    update: mockWebhookEndpointUpdate,
                },
                webhookDelivery: {
                    upsert: mockWebhookDeliveryUpsert,
                    update: mockWebhookDeliveryUpdate,
                },
            } as never,
        });

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result.attempted).toBe(1);
        expect(result.delivered).toBe(1);
        expect(result.failed).toBe(0);
        expect(endpoints[0]?.deliveryAttemptCount).toBe(2);
    });

    it("marks permanent failures and respects event subscriptions", async () => {
        createMockDb({ subscribedEvents: ["deal.created"] });
        const fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;

        const skipped = await dispatchWebhookEvent({
            organizationId: "org-1",
            eventType: "contact.created",
            eventId: "evt_contact_3",
            data: { contact: { id: "contact-3" } },
            db: {
                webhookEndpoint: {
                    findMany: mockWebhookEndpointFindMany,
                    update: mockWebhookEndpointUpdate,
                },
                webhookDelivery: {
                    upsert: mockWebhookDeliveryUpsert,
                    update: mockWebhookDeliveryUpdate,
                },
            } as never,
        });

        expect(skipped.attempted).toBe(0);
        expect(fetchMock).not.toHaveBeenCalled();

        createMockDb();
        fetchMock.mockResolvedValueOnce(new Response("bad request", { status: 400 }));

        const failure = await dispatchWebhookEvent({
            organizationId: "org-1",
            eventType: "contact.created",
            eventId: "evt_contact_4",
            data: { contact: { id: "contact-4" } },
            db: {
                webhookEndpoint: {
                    findMany: mockWebhookEndpointFindMany,
                    update: mockWebhookEndpointUpdate,
                },
                webhookDelivery: {
                    upsert: mockWebhookDeliveryUpsert,
                    update: mockWebhookDeliveryUpdate,
                },
            } as never,
        });

        expect(failure.attempted).toBe(1);
        expect(failure.delivered).toBe(0);
        expect(failure.failed).toBe(1);
        expect(failure.event.type).toBe("contact.created");
    });
});
