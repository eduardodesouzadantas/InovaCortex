import { createAuthSessionMock } from "./helpers/auth-session-mock";
import {
    AUTH_LOGIN_IDENTIFIER_LIMIT,
    AUTH_LOGIN_WINDOW_MS,
    clearAuthLoginRateLimitState,
} from "../lib/auth/login-rate-limit";

const mockAuthSession = createAuthSessionMock();
const verifyPasswordMock = mockAuthSession.verifyPassword;
const setSessionCookieMock = mockAuthSession.setSessionCookie;
const resolveAuthContextMock = mockAuthSession.resolveAuthContext;
const trackEventMock = jest.fn();

jest.mock("../lib/prisma", () => ({
    prisma: {
        user: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
    },
}));

jest.mock("../lib/auth/session", () => mockAuthSession);

jest.mock("../lib/logger", () => ({
    logger: {
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
    },
}));

jest.mock("../lib/system/db-check", () => ({
    isDatabaseUnavailableError: () => false,
}));

jest.mock("@/app/services/identityEvents/identityEvent.service", () => ({
    trackEvent: trackEventMock,
}));

import { prisma as prismaModule } from "../lib/prisma";
import { logger as loggerModule } from "../lib/logger";
import { loginWithPassword } from "../lib/auth/login-service";

const mockPrisma = prismaModule as unknown as {
    user: {
        findUnique: jest.Mock;
        update: jest.Mock;
    };
};
const mockLogger = jest.mocked(loggerModule);

describe("login-service", () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        await clearAuthLoginRateLimitState();
    });

    test("rejects invalid payloads with 400", async () => {
        const response = await loginWithPassword(
            new Request("http://localhost/api/agency/auth/login", {
                method: "POST",
                body: "{}",
                headers: {
                    "content-type": "application/json",
                },
            }),
            { endpoint: "agency", requireScope: "agency" },
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            code: "BAD_REQUEST",
        });
        expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    test("rejects invalid credentials with 401", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
            id: "user-1",
            passwordHash: "hashed-password",
            role: "admin",
            active: true,
            organizationId: "org-1",
            organization: {
                slug: "inovacortex",
            },
        });
        verifyPasswordMock.mockResolvedValue(false);

        const response = await loginWithPassword(
            new Request("http://localhost/api/agency/auth/login", {
                method: "POST",
                body: JSON.stringify({
                    email: "admin@acme.com",
                    password: "wrong-password",
                }),
                headers: {
                    "content-type": "application/json",
                },
            }),
            { endpoint: "agency", requireScope: "agency" },
        );

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({
            success: false,
            error: "INVALID_CREDENTIALS",
            code: "UNAUTHORIZED",
        });
        expect(setSessionCookieMock).not.toHaveBeenCalled();
    });

    test("blocks inactive users from logging in", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
            id: "user-1",
            passwordHash: "hashed-password",
            role: "admin",
            active: false,
            organizationId: "org-1",
            organization: {
                slug: "tenant-a",
            },
        });

        const response = await loginWithPassword(
            new Request("http://localhost/api/auth/login", {
                method: "POST",
                body: JSON.stringify({
                    email: "admin@acme.com",
                    password: "secret",
                }),
                headers: {
                    "content-type": "application/json",
                },
            }),
            { endpoint: "auth" },
        );

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toEqual({
            success: false,
            error: "INACTIVE_USER",
            code: "FORBIDDEN",
        });
        expect(verifyPasswordMock).not.toHaveBeenCalled();
        expect(setSessionCookieMock).not.toHaveBeenCalled();
    });

    test("blocks valid credentials for non-agency users on the agency endpoint with 403", async () => {
        verifyPasswordMock.mockResolvedValue(true);
        mockPrisma.user.findUnique.mockResolvedValue({
            id: "user-1",
            name: "Admin",
            passwordHash: "hashed-password",
            role: "admin",
            active: true,
            organizationId: "org-1",
            lastAccessAt: null,
            organization: {
                slug: "tenant-a",
            },
        });

        const response = await loginWithPassword(
            new Request("http://localhost/api/agency/auth/login", {
                method: "POST",
                body: JSON.stringify({
                    email: "admin@acme.com",
                    password: "secret",
                }),
                headers: {
                    "content-type": "application/json",
                },
            }),
            { endpoint: "agency", requireScope: "agency" },
        );

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toEqual({
            success: false,
            error: "FORBIDDEN",
            code: "FORBIDDEN",
        });
        expect(setSessionCookieMock).not.toHaveBeenCalled();
    });

    test("returns 500 for unexpected database failures", async () => {
        mockPrisma.user.findUnique.mockRejectedValueOnce(new Error("boom"));

        const response = await loginWithPassword(
            new Request("http://localhost/api/agency/auth/login", {
                method: "POST",
                body: JSON.stringify({
                    email: "admin@acme.com",
                    password: "secret",
                }),
                headers: {
                    "content-type": "application/json",
                },
            }),
            { endpoint: "agency", requireScope: "agency" },
        );

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({
            success: false,
            error: "INTERNAL_ERROR",
            code: "INTERNAL_ERROR",
        });
        expect(mockLogger.error).toHaveBeenCalledWith("Login error", expect.objectContaining({
            endpoint: "agency",
        }));
    });

    test("rate limits repeated login failures with 429", async () => {
        verifyPasswordMock.mockResolvedValue(false);
        mockPrisma.user.findUnique.mockResolvedValue({
            id: "user-1",
            passwordHash: "hashed-password",
            role: "admin",
            active: true,
            organizationId: "org-1",
            organization: {
                slug: "inovacortex",
            },
        });

        const buildRequest = () => new Request("http://localhost/api/auth/login", {
            method: "POST",
            body: JSON.stringify({
                email: "admin@acme.com",
                password: "wrong-password",
            }),
            headers: {
                "content-type": "application/json",
                "x-forwarded-for": "203.0.113.10",
            },
        });

        for (let attempt = 0; attempt < AUTH_LOGIN_IDENTIFIER_LIMIT; attempt += 1) {
            const response = await loginWithPassword(buildRequest(), { endpoint: "auth" });
            expect(response.status).toBe(401);
        }

        const rateLimitedResponse = await loginWithPassword(buildRequest(), { endpoint: "auth" });

        expect(rateLimitedResponse.status).toBe(429);
        await expect(rateLimitedResponse.json()).resolves.toEqual({
            success: false,
            error: "TOO_MANY_ATTEMPTS",
            code: "TOO_MANY_REQUESTS",
        });
        expect(rateLimitedResponse.headers.get("Retry-After")).toBe(String(AUTH_LOGIN_WINDOW_MS / 1000));
        expect(verifyPasswordMock).toHaveBeenCalledTimes(AUTH_LOGIN_IDENTIFIER_LIMIT);
        expect(trackEventMock).toHaveBeenCalledWith(expect.objectContaining({
            type: "LOGIN_FAILED",
            metadata: expect.objectContaining({
                reason: "rate_limited",
                endpoint: "auth",
            }),
        }));
    });

    test("updates lastAccessAt after a successful login", async () => {
        verifyPasswordMock.mockResolvedValue(true);
        resolveAuthContextMock.mockReturnValue({
            isAuthenticated: true,
            authScope: "tenant",
            organizationId: "org-1",
            organizationSlug: "tenant-a",
            userId: "user-1",
            role: "admin",
            session: {
                userId: "user-1",
                orgId: "org-1",
                orgSlug: "tenant-a",
                role: "admin",
            },
        });
        mockPrisma.user.findUnique.mockResolvedValue({
            id: "user-1",
            name: "Admin",
            passwordHash: "hashed-password",
            role: "admin",
            active: true,
            organizationId: "org-1",
            lastAccessAt: null,
            organization: {
                slug: "tenant-a",
            },
        });
        mockPrisma.user.update.mockResolvedValue({
            id: "user-1",
        });

        const response = await loginWithPassword(
            new Request("http://localhost/api/auth/login", {
                method: "POST",
                body: JSON.stringify({
                    email: "admin@acme.com",
                    password: "secret",
                }),
                headers: {
                    "content-type": "application/json",
                },
            }),
            { endpoint: "auth" },
        );

        expect(response.status).toBe(200);
        expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "user-1" },
            data: {
                lastAccessAt: expect.any(Date),
            },
        }));
        expect(setSessionCookieMock).toHaveBeenCalledWith(expect.objectContaining({
            userId: "user-1",
            orgId: "org-1",
            orgSlug: "tenant-a",
        }));
    });
});
