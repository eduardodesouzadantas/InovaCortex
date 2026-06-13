const requireAdminApiAccessMock = jest.fn();
const requestOrganizationUserPasswordResetMock = jest.fn();
const confirmPasswordResetMock = jest.fn();

jest.mock("../lib/auth/admin-api-guard", () => ({
    requireAdminApiAccess: requireAdminApiAccessMock,
}));

jest.mock("../lib/auth/password-reset-service", () => ({
    requestOrganizationUserPasswordReset: requestOrganizationUserPasswordResetMock,
    confirmPasswordReset: confirmPasswordResetMock,
}));

jest.mock("../lib/logger", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
    },
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
}));

import { POST as confirmPOST } from "../app/api/auth/reset/confirm/route";
import { POST as requestPOST } from "../app/api/auth/reset/request/route";

describe("auth reset routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("request route creates a reset token and returns a controlled reset link", async () => {
        requireAdminApiAccessMock.mockResolvedValue({
            ok: true,
            mode: "session",
            auth: {
                organizationId: "agency-org",
                userId: "agency-user-1",
                role: "admin",
            },
        });
        requestOrganizationUserPasswordResetMock.mockResolvedValue({
            ok: true,
            data: {
                organizationId: "org-1",
                organizationName: "Acme",
                user: {
                    id: "user-1",
                    name: "Admin Acme",
                    email: "admin@acme.com",
                    role: "owner",
                    active: true,
                    createdAt: "2026-03-22T10:00:00.000Z",
                    lastAccessAt: null,
                },
                token: "raw-reset-token",
                expiresAt: "2026-03-22T12:00:00.000Z",
            },
        });

        const response = await requestPOST(
            new Request("http://localhost/api/auth/reset/request", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    organizationId: "org-1",
                    userId: "user-1",
                }),
            }) as unknown as import("next/server").NextRequest,
        );

        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json).toEqual(expect.objectContaining({
            success: true,
            data: expect.objectContaining({
                organizationId: "org-1",
                organizationName: "Acme",
                expiresAt: "2026-03-22T12:00:00.000Z",
                resetUrl: expect.stringContaining("raw-reset-token"),
            }),
        }));
        expect(requestOrganizationUserPasswordResetMock).toHaveBeenCalledWith(expect.objectContaining({
            organizationId: "org-1",
            userId: "user-1",
            actorUserId: "agency-user-1",
            actorRole: "admin",
            source: "agency_surface",
        }));
    });

    test("confirm route updates the password with a valid token", async () => {
        confirmPasswordResetMock.mockResolvedValue({
            ok: true,
            organizationId: "org-1",
            organizationName: "Acme",
            userId: "user-1",
        });

        const response = await confirmPOST(
            new Request("http://localhost/api/auth/reset/confirm", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    token: "raw-reset-token",
                    password: "newSecret123",
                    confirmPassword: "newSecret123",
                }),
            }) as unknown as import("next/server").NextRequest,
        );

        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json).toEqual(expect.objectContaining({
            success: true,
            data: {
                organizationId: "org-1",
                organizationName: "Acme",
                userId: "user-1",
            },
        }));
        expect(confirmPasswordResetMock).toHaveBeenCalledWith({
            token: "raw-reset-token",
            password: "newSecret123",
        });
    });
});
