const prismaMock = {
    user: {
        findUnique: jest.fn(),
    },
};

const verifyPasswordMock = jest.fn();
const setSessionCookieMock = jest.fn();
const resolveAuthContextMock = jest.fn();

jest.mock("../lib/prisma", () => ({
    prisma: prismaMock,
}));

jest.mock("../lib/auth/session", () => ({
    verifyPassword: verifyPasswordMock,
    setSessionCookie: setSessionCookieMock,
    resolveAuthContext: resolveAuthContextMock,
}));

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

import { loginWithPassword } from "../lib/auth/login-service";

describe("login-service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("blocks inactive users from logging in", async () => {
        prismaMock.user.findUnique.mockResolvedValue({
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

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toMatchObject({
            code: "UNAUTHORIZED",
        });
        expect(verifyPasswordMock).not.toHaveBeenCalled();
        expect(setSessionCookieMock).not.toHaveBeenCalled();
    });
});
