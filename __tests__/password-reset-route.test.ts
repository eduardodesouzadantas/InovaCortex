const requireAdminApiAccessMock = jest.fn();
const requestOrganizationUserPasswordResetMock = jest.fn();

jest.mock("../lib/auth/admin-api-guard", () => ({
    requireAdminApiAccess: requireAdminApiAccessMock,
}));

jest.mock("../lib/auth/password-reset-service", () => ({
    requestOrganizationUserPasswordReset: requestOrganizationUserPasswordResetMock,
}));

jest.mock("../lib/logger", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
    },
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
}));

import { clearAuthRateLimitState } from "../lib/auth/auth-rate-limit";
import { POST as passwordResetRequestPOST } from "../app/api/auth/reset/request/route";

describe("password reset request route", () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        await clearAuthRateLimitState();
    });

    it("returns 429 with Retry-After after repeated requests", async () => {
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
                    createdAt: "2026-03-24T10:00:00.000Z",
                    lastAccessAt: null,
                },
                token: "reset-token",
                expiresAt: "2026-03-24T11:00:00.000Z",
            },
        });

        const requestFactory = () => new Request("http://localhost/api/auth/reset/request", {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                organizationId: "org-1",
                userId: "user-1",
            }),
        });

        for (let attempt = 0; attempt < 5; attempt += 1) {
            const response = await passwordResetRequestPOST(requestFactory() as unknown as import("next/server").NextRequest);
            expect(response.status).toBe(200);
        }

        const rateLimited = await passwordResetRequestPOST(requestFactory() as unknown as import("next/server").NextRequest);

        expect(rateLimited.status).toBe(429);
        expect(rateLimited.headers.get("Retry-After")).toBe("600");
        await expect(rateLimited.json()).resolves.toEqual({
            success: false,
            error: "TOO_MANY_ATTEMPTS",
            code: "TOO_MANY_REQUESTS",
        });
    });
});
