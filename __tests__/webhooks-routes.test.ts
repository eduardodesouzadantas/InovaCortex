const mockRequireOrgContext = jest.fn();
const mockListWebhookEndpoints = jest.fn();
const mockCreateWebhookEndpoint = jest.fn();
const mockUpdateWebhookEndpoint = jest.fn();
const mockDeleteWebhookEndpoint = jest.fn();
const mockGetOrganizationAccountStatus = jest.fn();

jest.mock("../lib/logger", () => ({
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

jest.mock("../lib/auth/org-context", () => ({
    requireOrgContext: mockRequireOrgContext,
}));

jest.mock("../lib/billing/account-status", () => ({
    getOrganizationAccountStatus: mockGetOrganizationAccountStatus,
    ORGANIZATION_BILLING_SUSPENDED_MESSAGE: "Conta suspensa. Regularize o billing para continuar.",
}));

jest.mock("../lib/auth/tenant-route", () => {
    const actual = jest.requireActual("../lib/auth/tenant-route");
    return {
        ...actual,
        resolveTenantRouteError: actual.resolveTenantRouteError,
        invalidTenantInputResponse: actual.invalidTenantInputResponse,
        tenantNotFoundResponse: actual.tenantNotFoundResponse,
        assertTenantRole: actual.assertTenantRole,
    };
});

jest.mock("../lib/public-api/webhooks", () => ({
    listWebhookEndpoints: mockListWebhookEndpoints,
    createWebhookEndpoint: mockCreateWebhookEndpoint,
    updateWebhookEndpoint: mockUpdateWebhookEndpoint,
    deleteWebhookEndpoint: mockDeleteWebhookEndpoint,
    parseWebhookSubscribedEvents: jest.requireActual("../lib/public-api/webhooks").parseWebhookSubscribedEvents,
}));

import { GET as webhookGET, POST as webhookPOST } from "../app/api/org/[slug]/webhooks/route";
import { DELETE as webhookDELETE, PATCH as webhookPATCH } from "../app/api/org/[slug]/webhooks/[id]/route";

describe("webhooks routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRequireOrgContext.mockResolvedValue({
            orgId: "org-1",
            orgSlug: "acme",
            userId: "user-1",
            role: "admin",
            plan: "pro",
            maxAssessmentsPerMonth: 100,
        });
        mockGetOrganizationAccountStatus.mockResolvedValue("trial");
    });

    it("lists webhook endpoints for the current tenant", async () => {
        mockListWebhookEndpoints.mockResolvedValueOnce({
            webhooks: [
                {
                    id: "wh_1",
                    url: "https://example.com/webhook",
                    isActive: true,
                    subscribedEvents: ["contact.created"],
                    lastDeliveryAt: null,
                    lastDeliveryStatus: null,
                    lastDeliveryError: null,
                    deliveryAttemptCount: 0,
                    createdAt: "2026-03-18T12:00:00.000Z",
                    updatedAt: "2026-03-18T12:00:00.000Z",
                    secretConfigured: true,
                },
            ],
            supportedEvents: ["contact.created", "deal.created"],
        });

        const response = await webhookGET(new Request("http://localhost/api/org/acme/webhooks"), {
            params: Promise.resolve({ slug: "acme" }),
        }) as Response;
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(mockListWebhookEndpoints).toHaveBeenCalledWith("org-1");
        expect(body).toMatchObject({
            success: true,
            webhooks: expect.arrayContaining([
                expect.objectContaining({ id: "wh_1" }),
            ]),
        });
    });

    it("creates a webhook endpoint and returns the secret once", async () => {
        mockCreateWebhookEndpoint.mockResolvedValueOnce({
            webhook: {
                id: "wh_1",
                url: "https://example.com/webhook",
                isActive: true,
                subscribedEvents: ["contact.created"],
                lastDeliveryAt: null,
                lastDeliveryStatus: null,
                lastDeliveryError: null,
                deliveryAttemptCount: 0,
                createdAt: "2026-03-18T12:00:00.000Z",
                updatedAt: "2026-03-18T12:00:00.000Z",
                secretConfigured: true,
            },
            secret: "whsec_test_secret",
        });

        const response = await webhookPOST(new Request("http://localhost/api/org/acme/webhooks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                url: "https://example.com/webhook",
                subscribedEvents: ["contact.created"],
            }),
        }), {
            params: Promise.resolve({ slug: "acme" }),
        }) as Response;
        const body = await response.json();

        expect(response.status).toBe(201);
        expect(mockCreateWebhookEndpoint).toHaveBeenCalledWith(expect.objectContaining({
            organizationId: "org-1",
            url: "https://example.com/webhook",
        }));
        expect(body).toMatchObject({
            success: true,
            secret: "whsec_test_secret",
        });
    });

    it("updates and deletes webhook endpoints", async () => {
        mockUpdateWebhookEndpoint.mockResolvedValueOnce({
            webhook: {
                id: "wh_1",
                url: "https://example.com/updated",
                isActive: false,
                subscribedEvents: ["deal.created"],
                lastDeliveryAt: null,
                lastDeliveryStatus: null,
                lastDeliveryError: null,
                deliveryAttemptCount: 0,
                createdAt: "2026-03-18T12:00:00.000Z",
                updatedAt: "2026-03-18T12:05:00.000Z",
                secretConfigured: true,
            },
            secret: "whsec_rotated",
        });

        const patchResponse = await webhookPATCH(new Request("http://localhost/api/org/acme/webhooks/wh_1", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                url: "https://example.com/updated",
                isActive: false,
                subscribedEvents: ["deal.created"],
                rotateSecret: true,
            }),
        }), {
            params: Promise.resolve({ slug: "acme", id: "wh_1" }),
        }) as Response;
        const patchBody = await patchResponse.json();

        expect(patchResponse.status).toBe(200);
        expect(patchBody).toMatchObject({
            success: true,
            secret: "whsec_rotated",
        });

        mockDeleteWebhookEndpoint.mockResolvedValueOnce(undefined);
        const deleteResponse = await webhookDELETE(new Request("http://localhost/api/org/acme/webhooks/wh_1", {
            method: "DELETE",
        }), {
            params: Promise.resolve({ slug: "acme", id: "wh_1" }),
        }) as Response;

        expect(deleteResponse.status).toBe(200);
        expect(mockDeleteWebhookEndpoint).toHaveBeenCalledWith({
            organizationId: "org-1",
            endpointId: "wh_1",
        });
    });

    it("rejects non-admin access", async () => {
        mockRequireOrgContext.mockResolvedValueOnce({
            orgId: "org-1",
            orgSlug: "acme",
            userId: "user-1",
            role: "viewer",
            plan: "pro",
            maxAssessmentsPerMonth: 100,
        });

        const response = await webhookGET(new Request("http://localhost/api/org/acme/webhooks"), {
            params: Promise.resolve({ slug: "acme" }),
        }) as Response;
        expect(response.status).toBe(403);
        expect(mockListWebhookEndpoints).not.toHaveBeenCalled();
    });

    it("blocks webhook creation when the organization is suspended", async () => {
        mockGetOrganizationAccountStatus.mockResolvedValueOnce("suspended");

        const response = await webhookPOST(new Request("http://localhost/api/org/acme/webhooks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                url: "https://example.com/webhook",
                subscribedEvents: ["contact.created"],
            }),
        }), {
            params: Promise.resolve({ slug: "acme" }),
        }) as Response;

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({
            success: false,
            error: "FORBIDDEN",
        });
        expect(mockCreateWebhookEndpoint).not.toHaveBeenCalled();
    });
});
