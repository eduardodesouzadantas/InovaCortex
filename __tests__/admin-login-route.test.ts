const loginWithPasswordMock = jest.fn();

jest.mock("../lib/auth/login-service", () => ({
    loginWithPassword: loginWithPasswordMock,
}));

jest.mock("../lib/logger", () => ({
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
}));

import { POST as adminLoginPOST } from "../app/api/admin/login/route";

describe("/api/admin/login route", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test.each([
        [400, { success: false, error: "INVALID_PAYLOAD", code: "BAD_REQUEST" }],
        [401, { success: false, error: "INVALID_CREDENTIALS", code: "UNAUTHORIZED" }],
        [403, { success: false, error: "INACTIVE_USER", code: "FORBIDDEN" }],
        [429, { success: false, error: "TOO_MANY_ATTEMPTS", code: "TOO_MANY_REQUESTS" }],
        [500, { success: false, error: "INTERNAL_ERROR", code: "INTERNAL_ERROR" }],
    ])("preserves %i responses and applies deprecation headers", async (status, payload) => {
        loginWithPasswordMock.mockResolvedValueOnce(
            new Response(JSON.stringify(payload), {
                status,
                headers: {
                    "content-type": "application/json",
                },
            }),
        );

        const response = await adminLoginPOST(
            new Request("http://localhost/api/admin/login", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    email: "admin@example.com",
                    password: "secret",
                }),
            }) as unknown as import("next/server").NextRequest,
        );

        expect(response.status).toBe(status);
        await expect(response.json()).resolves.toEqual(payload);
        expect(loginWithPasswordMock).toHaveBeenCalledWith(expect.any(Request), {
            endpoint: "admin_adapter",
            requireScope: "agency",
        });
        expect(response.headers.get("Deprecation")).toBe("Mon, 09 Mar 2026 00:00:00 GMT");
        expect(response.headers.get("Sunset")).toBe("Tue, 30 Jun 2026 23:59:59 GMT");
        expect(response.headers.get("Link")).toBe("</api/agency/auth/login>; rel=\"successor-version\"");
        expect(response.headers.get("Warning")).toBe('299 - "Deprecated endpoint. Use /api/agency/auth/login"');
        expect(response.headers.get("X-Deprecated-Endpoint")).toBe("/api/admin/login");
    });
});
