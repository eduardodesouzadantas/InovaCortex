const requireOrgContextFromRequestMock = jest.fn();
const assertTenantRoleMock = jest.fn();
const orgContextErrorResponseMock = jest.fn((error: unknown) => new Response(String(error), { status: 403 }));
const resolveTenantRouteErrorMock = jest.fn((error: unknown) => new Response(String(error), { status: 500 }));
const getOrganizationAccountStatusMock = jest.fn();

const serviceMocks = {
    buildEmailOAuthStartUrl: jest.fn(),
    createEmailOAuthState: jest.fn(),
    disconnectEmailIntegration: jest.fn(),
    exchangeEmailOAuthCode: jest.fn(),
    isEmailOAuthProviderConfigured: jest.fn(),
    parseEmailOAuthConnectInput: jest.fn(),
    parseEmailOAuthState: jest.fn(),
    saveEmailOAuthIntegration: jest.fn(),
    syncEmailIntegration: jest.fn(),
};

jest.mock("../lib/logger", () => ({
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
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

jest.mock("../lib/integrations/email-oauth", () => serviceMocks);
jest.mock("../lib/integrations/email/sync-service", () => ({
    syncEmailIntegration: serviceMocks.syncEmailIntegration,
}));

import { GET as callbackGET } from "../app/api/org/[slug]/email/callback/route";
import { POST as connectPOST } from "../app/api/org/[slug]/email/connect/route";
import { POST as disconnectPOST } from "../app/api/org/[slug]/email/disconnect/route";

describe("Email OAuth routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        requireOrgContextFromRequestMock.mockResolvedValue({
            orgId: "org-1",
            orgSlug: "acme",
            userId: "user-1",
            role: "admin",
        });
        getOrganizationAccountStatusMock.mockResolvedValue("trial");
        serviceMocks.isEmailOAuthProviderConfigured.mockReturnValue(true);
        serviceMocks.parseEmailOAuthConnectInput.mockReturnValue({ provider: "google" });
        serviceMocks.createEmailOAuthState.mockReturnValue("encrypted-state");
        serviceMocks.buildEmailOAuthStartUrl.mockReturnValue("https://accounts.google.com/o/oauth2/auth?state=encrypted-state");
        serviceMocks.parseEmailOAuthState.mockReturnValue({
            organizationId: "org-1",
            organizationSlug: "acme",
            userId: "user-1",
            provider: "google",
            issuedAt: "2026-03-18T10:00:00.000Z",
        });
        serviceMocks.exchangeEmailOAuthCode.mockResolvedValue({
            provider: "google",
            ownerEmail: "admin@example.com",
            accessToken: "access-token",
            refreshToken: "refresh-token",
            expiryAt: new Date("2026-03-19T10:00:00.000Z"),
        });
        serviceMocks.saveEmailOAuthIntegration.mockResolvedValue({
            id: "integration-1",
            provider: "google",
            status: "connected",
            ownerEmail: "admin@example.com",
            expiryAt: "2026-03-19T10:00:00.000Z",
            lastSyncAt: "2026-03-18T10:00:00.000Z",
            lastSyncStatus: "success",
            lastSyncDurationMs: 1000,
            lastError: null,
            updatedAt: "2026-03-18T10:00:00.000Z",
        });
        serviceMocks.syncEmailIntegration.mockResolvedValue({
            organizationId: "org-1",
            provider: "google",
            syncedThreads: 1,
            syncedMessages: 2,
            matchedContacts: 1,
            linkedDeals: 1,
            skipped: false,
            lastSyncAt: "2026-03-18T10:00:00.000Z",
        });
        serviceMocks.disconnectEmailIntegration.mockResolvedValue({
            id: "integration-1",
            provider: "google",
            status: "disconnected",
            ownerEmail: "admin@example.com",
            expiryAt: null,
            lastSyncAt: "2026-03-18T10:00:00.000Z",
            lastSyncStatus: "skipped",
            lastSyncDurationMs: 10,
            lastError: null,
            updatedAt: "2026-03-18T10:00:00.000Z",
        });
    });

    test("starts OAuth with a signed state and redirect URL", async () => {
        const response = await connectPOST(
            new Request("http://localhost/api/org/acme/email/connect", {
                method: "POST",
                body: JSON.stringify({ provider: "google" }),
                headers: { "Content-Type": "application/json" },
            }) as any,
            { params: Promise.resolve({ slug: "acme" }) },
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            data: {
                authorizationUrl: "https://accounts.google.com/o/oauth2/auth?state=encrypted-state",
                provider: "google",
            },
        });
        expect(serviceMocks.createEmailOAuthState).toHaveBeenCalledWith({
            organizationId: "org-1",
            organizationSlug: "acme",
            userId: "user-1",
            provider: "google",
        });
        expect(serviceMocks.buildEmailOAuthStartUrl).toHaveBeenCalledWith({
            provider: "google",
            state: "encrypted-state",
            orgSlug: "acme",
        });
    });

    test("rejects connect when OAuth provider is not configured", async () => {
        serviceMocks.isEmailOAuthProviderConfigured.mockReturnValue(false);

        const response = await connectPOST(
            new Request("http://localhost/api/org/acme/email/connect", {
                method: "POST",
                body: JSON.stringify({ provider: "google" }),
                headers: { "Content-Type": "application/json" },
            }) as any,
            { params: Promise.resolve({ slug: "acme" }) },
        );

        expect(response.status).toBe(424);
        await expect(response.json()).resolves.toMatchObject({
            success: false,
            error: "EMAIL_OAUTH_NOT_CONFIGURED",
        });
    });

    test("handles OAuth callback and redirects back to admin email", async () => {
        const response = await callbackGET(
            new Request("http://localhost/api/org/acme/email/callback?code=auth-code&state=encrypted-state", {
                method: "GET",
            }) as any,
            { params: Promise.resolve({ slug: "acme" }) },
        );

        expect(serviceMocks.parseEmailOAuthState).toHaveBeenCalledWith("encrypted-state");
        expect(serviceMocks.exchangeEmailOAuthCode).toHaveBeenCalledWith({
            provider: "google",
            code: "auth-code",
            orgSlug: "acme",
        });
        expect(serviceMocks.saveEmailOAuthIntegration).toHaveBeenCalledWith("org-1", expect.objectContaining({
            provider: "google",
            ownerEmail: "admin@example.com",
        }));
        expect(serviceMocks.syncEmailIntegration).toHaveBeenCalledWith({
            organizationId: "org-1",
        });
        expect(response.status).toBe(307);
        const location = response.headers.get("location");
        expect(location).toContain("/org/acme/admin/email");
        expect(location).toContain("connected=1");
        expect(location).toContain("provider=google");
    });

    test("disconnects and clears local state", async () => {
        const response = await disconnectPOST(
            new Request("http://localhost/api/org/acme/email/disconnect", {
                method: "POST",
            }) as any,
            { params: Promise.resolve({ slug: "acme" }) },
        );

        expect(serviceMocks.disconnectEmailIntegration).toHaveBeenCalledWith("org-1");
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            data: {
                integration: {
                    status: "disconnected",
                },
            },
        });
    });

    test("rejects callback when the organization is suspended", async () => {
        getOrganizationAccountStatusMock.mockResolvedValueOnce("suspended");

        const response = await callbackGET(
            new Request("http://localhost/api/org/acme/email/callback?code=auth-code&state=encrypted-state", {
                method: "GET",
            }) as any,
            { params: Promise.resolve({ slug: "acme" }) },
        );

        expect(response.status).toBe(307);
        expect(serviceMocks.exchangeEmailOAuthCode).not.toHaveBeenCalled();
        expect(response.headers.get("location")).toContain("/org/acme/admin/email");
        expect(response.headers.get("location")).toContain("error=account_suspended");
    });
});
