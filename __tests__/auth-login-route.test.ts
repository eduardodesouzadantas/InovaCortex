const loginWithPasswordMock = jest.fn();

jest.mock("../lib/auth/login-service", () => ({
    loginWithPassword: loginWithPasswordMock,
}));

jest.mock("../lib/logger", () => ({
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
}));

import { POST as authLoginPOST } from "../app/api/auth/login/route";

describe("/api/auth/login route", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test.each([
        [400, { success: false, error: "INVALID_PAYLOAD", code: "BAD_REQUEST" }],
        [401, { success: false, error: "INVALID_CREDENTIALS", code: "UNAUTHORIZED" }],
        [403, { success: false, error: "INACTIVE_USER", code: "FORBIDDEN" }],
        [429, { success: false, error: "TOO_MANY_ATTEMPTS", code: "TOO_MANY_REQUESTS" }],
        [500, { success: false, error: "INTERNAL_ERROR", code: "INTERNAL_ERROR" }],
    ])("preserves %i responses from the login service", async (status, payload) => {
        loginWithPasswordMock.mockResolvedValueOnce(
            new Response(JSON.stringify(payload), {
                status,
                headers: {
                    "content-type": "application/json",
                },
            }),
        );

        const response = await authLoginPOST(
            new Request("http://localhost/api/auth/login", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    email: "user@example.com",
                    password: "secret",
                }),
            }) as unknown as import("next/server").NextRequest,
        );

        expect(response.status).toBe(status);
        await expect(response.json()).resolves.toEqual(payload);
        expect(loginWithPasswordMock).toHaveBeenCalledWith(expect.any(Request), {
            endpoint: "auth",
        });
    });
});
