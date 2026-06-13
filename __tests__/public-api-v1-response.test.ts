import { publicApiErrorResponse, publicApiSuccessResponse, resolvePublicApiRequestId } from "../lib/public-api/v1-response";

describe("public api v1 response", () => {
    it("builds a success envelope with request and rate limit headers", async () => {
        const response = publicApiSuccessResponse(new Request("http://localhost/api/public/v1", {
            headers: {
                "x-request-id": "req_custom",
            },
        }), {
            ok: true,
        }, {
            status: 201,
            requestId: "req_custom",
            rateLimit: {
                limit: 60,
                remaining: 59,
                resetAt: new Date("2026-03-18T10:01:00.000Z"),
            },
            pagination: {
                limit: 10,
                total: 20,
                returnedCount: 10,
                hasNextPage: true,
                nextCursor: "cursor_1",
            },
        });

        expect(response.status).toBe(201);
        expect(response.headers.get("x-request-id")).toBe("req_custom");
        expect(response.headers.get("x-ratelimit-limit")).toBe("60");
        expect(response.headers.get("x-ratelimit-remaining")).toBe("59");
        await expect(response.json()).resolves.toMatchObject({
            data: {
                ok: true,
            },
            meta: {
                requestId: "req_custom",
                version: "v1",
                pagination: {
                    limit: 10,
                    total: 20,
                    returnedCount: 10,
                    hasNextPage: true,
                    nextCursor: "cursor_1",
                },
            },
            error: null,
        });
    });

    it("builds a safe error envelope", async () => {
        const response = publicApiErrorResponse(new Request("http://localhost/api/public/v1"), {
            code: "VALIDATION_ERROR",
            message: "Invalid payload.",
            details: {
                field: "phoneNumberE164",
            },
        }, {
            requestId: "req_error",
        });

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toMatchObject({
            data: null,
            meta: {
                requestId: "req_error",
                version: "v1",
            },
            error: {
                code: "invalid_request",
                message: "Invalid payload.",
                details: {
                    field: "phoneNumberE164",
                },
            },
        });
    });

    it("resolves request ids from headers when available", () => {
        expect(resolvePublicApiRequestId(new Request("http://localhost/api/public/v1", {
            headers: {
                "x-request-id": "req_header",
            },
        }))).toBe("req_header");
    });
});
