const requireAdminApiAccessMock = jest.fn();
const createOrganizationInviteMock = jest.fn();
const revokeOrganizationInviteMock = jest.fn();
const acceptOrganizationInviteMock = jest.fn();

jest.mock("../lib/auth/admin-api-guard", () => ({
    requireAdminApiAccess: requireAdminApiAccessMock,
}));

jest.mock("../lib/auth/invite-service", () => ({
    createOrganizationInvite: createOrganizationInviteMock,
    revokeOrganizationInvite: revokeOrganizationInviteMock,
    acceptOrganizationInvite: acceptOrganizationInviteMock,
}));

jest.mock("../lib/logger", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
    },
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
}));

import { clearAuthRateLimitState } from "../lib/auth/auth-rate-limit";
import { GET as inviteAcceptGET, POST as inviteAcceptPOST } from "../app/api/auth/invite/accept/route";
import { POST as inviteCreatePOST } from "../app/api/agency/invites/create/route";
import { POST as inviteRevokePOST } from "../app/api/agency/invites/revoke/route";

describe("invite routes", () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        await clearAuthRateLimitState();
    });

    test("create route returns the controlled invite url in non-production", async () => {
        requireAdminApiAccessMock.mockResolvedValue({
            ok: true,
            mode: "session",
            auth: {
                organizationId: "agency-org",
                userId: "agency-user-1",
                role: "admin",
            },
        });
        createOrganizationInviteMock.mockResolvedValue({
            ok: true,
            data: {
                organizationId: "org-1",
                organizationName: "Acme",
                invite: {
                    id: "invite-1",
                    organizationId: "org-1",
                    email: "invitee@acme.com",
                    role: "viewer",
                    status: "pending",
                    expiresAt: "2026-03-31T10:00:00.000Z",
                    acceptedAt: null,
                    revokedAt: null,
                    createdByUserId: "agency-user-1",
                    createdAt: "2026-03-24T10:00:00.000Z",
                },
                inviteUrl: "http://localhost/api/auth/invite/accept?token=invite-token",
            },
        });

        const response = await inviteCreatePOST(
            new Request("http://localhost/api/agency/invites/create", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    organizationId: "org-1",
                    email: "invitee@acme.com",
                    role: "viewer",
                }),
            }) as unknown as import("next/server").NextRequest,
        );

        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json).toEqual(expect.objectContaining({
            success: true,
            data: expect.objectContaining({
                organizationId: "org-1",
                inviteUrl: "http://localhost/api/auth/invite/accept?token=invite-token",
            }),
        }));
        expect(createOrganizationInviteMock).toHaveBeenCalledWith(expect.objectContaining({
            organizationId: "org-1",
            email: "invitee@acme.com",
            role: "viewer",
            actorUserId: "agency-user-1",
            actorRole: "admin",
            source: "agency_surface",
        }));
    });

    test("revoke route revokes a pending invite", async () => {
        requireAdminApiAccessMock.mockResolvedValue({
            ok: true,
            mode: "session",
            auth: {
                organizationId: "agency-org",
                userId: "agency-user-1",
                role: "admin",
            },
        });
        revokeOrganizationInviteMock.mockResolvedValue({
            ok: true,
            organizationId: "org-1",
            organizationName: "Acme",
            invite: {
                id: "invite-1",
                organizationId: "org-1",
                email: "invitee@acme.com",
                role: "viewer",
                status: "revoked",
                expiresAt: "2026-03-31T10:00:00.000Z",
                acceptedAt: null,
                revokedAt: "2026-03-24T12:00:00.000Z",
                createdByUserId: "agency-user-1",
                createdAt: "2026-03-24T10:00:00.000Z",
            },
            changed: true,
        });

        const response = await inviteRevokePOST(
            new Request("http://localhost/api/agency/invites/revoke", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    organizationId: "org-1",
                    inviteId: "invite-1",
                }),
            }) as unknown as import("next/server").NextRequest,
        );

        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json).toEqual(expect.objectContaining({
            success: true,
            data: expect.objectContaining({
                organizationId: "org-1",
                changed: true,
            }),
        }));
        expect(revokeOrganizationInviteMock).toHaveBeenCalledWith(expect.objectContaining({
            organizationId: "org-1",
            inviteId: "invite-1",
            actorUserId: "agency-user-1",
            actorRole: "admin",
            source: "agency_surface",
        }));
    });

    test("accept route renders the invite form from a browser link", async () => {
        const response = await inviteAcceptGET(
            new Request("http://localhost/api/auth/invite/accept?token=invite-token", {
                method: "GET",
            }) as unknown as import("next/server").NextRequest,
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("text/html");
        const html = await response.text();
        expect(html).toContain("Aceitar convite");
        expect(html).toContain('name="token"');
        expect(html).toContain("invite-token");
    });

    test("accept route redirects to the company login page after success", async () => {
        acceptOrganizationInviteMock.mockResolvedValue({
            ok: true,
            organizationId: "org-1",
            organizationName: "Acme",
            userId: "user-1",
            email: "invitee@acme.com",
        });

        const response = await inviteAcceptPOST(
            new Request("http://localhost/api/auth/invite/accept", {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    token: "invite-token",
                    name: "Invitee Acme",
                    password: "newSecret123",
                    confirmPassword: "newSecret123",
                }),
            }) as unknown as import("next/server").NextRequest,
        );

        expect(response.status).toBe(303);
        expect(response.headers.get("location")).toContain("/empresa/login?invite=accepted");
        expect(response.headers.get("location")).toContain("email=invitee%40acme.com");
        expect(acceptOrganizationInviteMock).toHaveBeenCalledWith({
            token: "invite-token",
            name: "Invitee Acme",
            password: "newSecret123",
        });
    });

    test("accept route rejects invalid tokens through the API path", async () => {
        acceptOrganizationInviteMock.mockResolvedValue({
            ok: false,
            reason: "invalid_token",
        });

        const response = await inviteAcceptPOST(
            new Request("http://localhost/api/auth/invite/accept", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    token: "bad-token",
                    name: "Invitee Acme",
                    password: "newSecret123",
                }),
            }) as unknown as import("next/server").NextRequest,
        );

        expect(response.status).toBe(400);
        const json = await response.json();
        expect(json).toEqual(expect.objectContaining({
            success: false,
            error: "INVALID_INVITE_TOKEN",
        }));
    });

    test("create route rate limits repeated invite requests", async () => {
        requireAdminApiAccessMock.mockResolvedValue({
            ok: true,
            mode: "session",
            auth: {
                organizationId: "agency-org",
                userId: "agency-user-1",
                role: "admin",
            },
        });
        createOrganizationInviteMock.mockResolvedValue({
            ok: true,
            data: {
                organizationId: "org-1",
                organizationName: "Acme",
                invite: {
                    id: "invite-1",
                    organizationId: "org-1",
                    email: "invitee@acme.com",
                    role: "viewer",
                    status: "pending",
                    expiresAt: "2026-03-31T10:00:00.000Z",
                    acceptedAt: null,
                    revokedAt: null,
                    createdByUserId: "agency-user-1",
                    createdAt: "2026-03-24T10:00:00.000Z",
                },
            },
        });

        const buildRequest = () => new Request("http://localhost/api/agency/invites/create", {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                organizationId: "org-1",
                email: "invitee@acme.com",
                role: "viewer",
            }),
        }) as unknown as import("next/server").NextRequest;

        for (let attempt = 0; attempt < 5; attempt += 1) {
            const response = await inviteCreatePOST(buildRequest());
            expect(response.status).toBe(200);
        }

        const rateLimited = await inviteCreatePOST(buildRequest());

        expect(rateLimited.status).toBe(429);
        expect(rateLimited.headers.get("Retry-After")).toBe("600");
        await expect(rateLimited.json()).resolves.toEqual({
            success: false,
            error: "TOO_MANY_ATTEMPTS",
            code: "TOO_MANY_REQUESTS",
        });
    });
});
