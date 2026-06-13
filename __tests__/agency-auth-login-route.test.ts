const loginWithPasswordMock = jest.fn();

jest.mock("../lib/auth/login-service", () => ({
    loginWithPassword: loginWithPasswordMock,
}));

jest.mock("../lib/logger", () => ({
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
}));

import { POST as agencyAuthLoginPOST } from "../app/api/agency/auth/login/route";

describe("agency auth login route", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test.each([
        [400, { error: "INVALID_PAYLOAD", code: "BAD_REQUEST" }],
        [401, { error: "INVALID_CREDENTIALS", code: "UNAUTHORIZED" }],
        [403, { error: "INACTIVE_USER", code: "FORBIDDEN" }],
        [429, { error: "TOO_MANY_ATTEMPTS", code: "TOO_MANY_REQUESTS" }],
        [500, { error: "INTERNAL_ERROR", code: "INTERNAL_ERROR" }],
    ])("returns %i when the login service returns a %i response", async (status, payload) => {
        loginWithPasswordMock.mockResolvedValueOnce(
            new Response(JSON.stringify(payload), {
                status,
                headers: {
                    "content-type": "application/json",
                },
            }),
        );

        const response = await agencyAuthLoginPOST(
            new Request("http://localhost/api/agency/auth/login", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    email: "agency@inovacortex.com",
                    password: "secret",
                }),
            }) as unknown as import("next/server").NextRequest,
        );

        expect(response.status).toBe(status);
        await expect(response.json()).resolves.toMatchObject(payload);
        expect(loginWithPasswordMock).toHaveBeenCalledWith(expect.any(Request), {
            endpoint: "agency",
            requireScope: "agency",
        });
    });
});
