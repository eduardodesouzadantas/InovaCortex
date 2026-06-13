const requireOrgContextFromRequestMock = jest.fn();
const assertTenantRoleMock = jest.fn();
const orgContextErrorResponseMock = jest.fn((error: unknown) => new Response(String(error), { status: 403 }));
const resolveTenantRouteErrorMock = jest.fn((error: unknown) => new Response(String(error), { status: 500 }));
const getOrganizationAccountStatusMock = jest.fn();

const serviceMocks = {
    getEmailIntegrationView: jest.fn(),
    syncEmailIntegration: jest.fn(),
};

jest.mock("../lib/logger", () => ({
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

jest.mock("../lib/auth/org-context", () => ({
    requireOrgContextFromRequest: requireOrgContextFromRequestMock,
    orgContextErrorResponse: orgContextErrorResponseMock,
}));

jest.mock("../lib/auth/tenant-route", () => ({
    assertTenantRole: assertTenantRoleMock,
    resolveTenantRouteError: resolveTenantRouteErrorMock,
}));

jest.mock("../lib/billing/account-status", () => ({
    getOrganizationAccountStatus: getOrganizationAccountStatusMock,
    ORGANIZATION_BILLING_SUSPENDED_MESSAGE: "Conta suspensa. Regularize o billing para continuar.",
}));

jest.mock("../lib/integrations/email-oauth", () => ({
    getEmailIntegrationView: serviceMocks.getEmailIntegrationView,
}));

jest.mock("../lib/integrations/email/sync-service", () => ({
    syncEmailIntegration: serviceMocks.syncEmailIntegration,
}));

import { POST as refreshPOST } from "../app/api/org/[slug]/email/refresh/route";

describe("Email refresh route", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        requireOrgContextFromRequestMock.mockResolvedValue({
            orgId: "org-1",
            orgSlug: "acme",
            userId: "user-1",
            role: "admin",
        });
        getOrganizationAccountStatusMock.mockResolvedValue("trial");
        serviceMocks.getEmailIntegrationView.mockResolvedValue({
            id: "integration-1",
            provider: "google",
            status: "connected",
            ownerEmail: "admin@example.com",
            expiryAt: null,
            lastSyncAt: "2026-03-18T10:00:00.000Z",
            lastSyncStatus: "failed",
            lastSyncDurationMs: 500,
            lastError: "Timeout while syncing",
            updatedAt: "2026-03-18T10:00:00.000Z",
        });
        serviceMocks.syncEmailIntegration.mockResolvedValue({
            organizationId: "org-1",
            provider: "google",
            syncedThreads: 1,
            syncedMessages: 2,
            matchedContacts: 1,
            linkedDeals: 0,
            skipped: false,
            lastSyncAt: "2026-03-18T12:00:00.000Z",
            lastSyncStatus: "success",
            lastSyncDurationMs: 800,
        });
    });

    test("refreshes the connected Google integration in the tenant context", async () => {
        const response = await refreshPOST(
            new Request("http://localhost/api/org/acme/email/refresh", {
                method: "POST",
            }) as any,
            { params: Promise.resolve({ slug: "acme" }) },
        );

        expect(requireOrgContextFromRequestMock).toHaveBeenCalledWith(expect.any(Request), "acme");
        expect(assertTenantRoleMock).toHaveBeenCalledWith("admin", "admin");
        expect(serviceMocks.syncEmailIntegration).toHaveBeenCalledWith({
            organizationId: "org-1",
        });
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            data: {
                result: {
                    organizationId: "org-1",
                    provider: "google",
                    skipped: false,
                },
                integration: {
                    id: "integration-1",
                },
            },
        });
    });

    test("returns a safe error when sync is already in progress", async () => {
        serviceMocks.syncEmailIntegration.mockResolvedValueOnce({
            organizationId: "org-1",
            provider: "skipped",
            syncedThreads: 0,
            syncedMessages: 0,
            matchedContacts: 0,
            linkedDeals: 0,
            skipped: true,
            reason: "sync_in_progress",
            lastSyncAt: "2026-03-18T10:00:00.000Z",
            lastSyncStatus: "skipped",
            lastSyncDurationMs: 5,
        });

        const response = await refreshPOST(
            new Request("http://localhost/api/org/acme/email/refresh", {
                method: "POST",
            }) as any,
            { params: Promise.resolve({ slug: "acme" }) },
        );

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({
            success: false,
            error: "EMAIL_SYNC_IN_PROGRESS",
        });
    });

    test("rejects unauthorized context before refresh", async () => {
        requireOrgContextFromRequestMock.mockResolvedValueOnce(new Error("UNAUTHENTICATED"));

        const response = await refreshPOST(
            new Request("http://localhost/api/org/acme/email/refresh", {
                method: "POST",
            }) as any,
            { params: Promise.resolve({ slug: "acme" }) },
        );

        expect(orgContextErrorResponseMock).toHaveBeenCalled();
        expect(response.status).toBe(403);
        expect(serviceMocks.syncEmailIntegration).not.toHaveBeenCalled();
    });

    test("blocks manual refresh when the organization is suspended", async () => {
        getOrganizationAccountStatusMock.mockResolvedValueOnce("suspended");

        const response = await refreshPOST(
            new Request("http://localhost/api/org/acme/email/refresh", {
                method: "POST",
            }) as any,
            { params: Promise.resolve({ slug: "acme" }) },
        );

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({
            success: false,
            error: "FORBIDDEN",
        });
        expect(serviceMocks.syncEmailIntegration).not.toHaveBeenCalled();
    });

    test("keeps tenant scoping explicit even when the slug differs", async () => {
        const response = await refreshPOST(
            new Request("http://localhost/api/org/different-slug/email/refresh", {
                method: "POST",
            }) as any,
            { params: Promise.resolve({ slug: "different-slug" }) },
        );

        expect(serviceMocks.syncEmailIntegration).toHaveBeenCalledWith({
            organizationId: "org-1",
        });
        expect(response.status).toBe(200);
    });
});
