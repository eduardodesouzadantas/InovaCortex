const mockPublicApiKeyFindFirst = jest.fn();
const mockPublicApiKeyCreate = jest.fn();
const mockPublicApiKeyUpdate = jest.fn();

jest.mock("../lib/prisma", () => ({
    prisma: {
        publicApiKey: {
            findFirst: mockPublicApiKeyFindFirst,
            create: mockPublicApiKeyCreate,
            update: mockPublicApiKeyUpdate,
        },
    },
}));

jest.mock("../lib/logger", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

import {
    authenticateAndRateLimitPublicApiRequest,
    authenticatePublicApiRequest,
    clearPublicApiRateLimitState,
    enforcePublicApiRateLimit,
    generatePublicApiKeyValue,
    hashPublicApiKey,
    provisionPublicApiKey,
    PublicApiError,
    publicApiErrorResponse,
} from "../lib/public-api/v1-auth";

describe("public api v1 auth", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearPublicApiRateLimitState();
    });

    it("hashes keys deterministically", () => {
        expect(hashPublicApiKey("abc")).toBe(hashPublicApiKey("abc"));
        expect(hashPublicApiKey("abc")).not.toBe(hashPublicApiKey("xyz"));
    });

    it("provisions a key once and never exposes the stored hash", async () => {
        const token = generatePublicApiKeyValue("icx_pub");
        mockPublicApiKeyCreate.mockResolvedValueOnce({
            id: "key-1",
            organizationId: "org-1",
            name: "Primary",
            keyPrefix: token.keyPrefix,
            lastUsedAt: null,
            revokedAt: null,
            createdAt: new Date("2026-03-18T10:00:00.000Z"),
            updatedAt: new Date("2026-03-18T10:00:00.000Z"),
        });

        const result = await provisionPublicApiKey({
            organizationId: "org-1",
            name: "Primary",
        });

        expect(mockPublicApiKeyCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                organizationId: "org-1",
                name: "Primary",
                keyPrefix: expect.any(String),
                keyHash: expect.any(String),
            }),
        }));
        expect(result.rawKey).toContain("icx_pub");
        expect(result.key.lastUsedAt).toBeNull();
        expect(result.key.revokedAt).toBeNull();
        expect(result.key.name).toBe("Primary");
    });

    it("authenticates a bearer API key and updates lastUsedAt", async () => {
        const token = generatePublicApiKeyValue("icx_pub");
        mockPublicApiKeyFindFirst.mockResolvedValueOnce({
            id: "key-1",
            name: "Primary",
            keyPrefix: token.keyPrefix,
            organization: {
                id: "org-1",
                slug: "acme",
                name: "Acme",
                subscriptionStatus: "active",
            },
        });
        mockPublicApiKeyUpdate.mockResolvedValueOnce({
            id: "key-1",
        });

        const context = await authenticatePublicApiRequest(new Request("http://localhost/api/public/v1", {
            headers: {
                Authorization: `Bearer ${token.rawKey}`,
            },
        }));

        expect(context).toMatchObject({
            organizationId: "org-1",
            organizationSlug: "acme",
            organizationName: "Acme",
            apiKeyId: "key-1",
            apiKeyName: "Primary",
        });
        expect(mockPublicApiKeyFindFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                keyHash: hashPublicApiKey(token.rawKey),
                revokedAt: null,
            },
        }));
        expect(mockPublicApiKeyUpdate).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "key-1" },
            data: expect.objectContaining({
                lastUsedAt: expect.any(Date),
            }),
        }));
    });

    it("rejects missing bearer tokens", async () => {
        await expect(authenticatePublicApiRequest(new Request("http://localhost/api/public/v1"))).rejects.toBeInstanceOf(PublicApiError);
        await expect(authenticatePublicApiRequest(new Request("http://localhost/api/public/v1"))).rejects.toMatchObject({
            status: 401,
            code: "UNAUTHORIZED",
        });
    });

    it("rate limits per tenant, key and route", () => {
        const first = enforcePublicApiRateLimit({
            organizationId: "org-1",
            apiKeyId: "key-1",
            routeKey: "contacts:get",
            limit: 1,
            windowMs: 60_000,
        });

        expect(first).toMatchObject({
            limit: 1,
            remaining: 0,
        });

        expect(() => enforcePublicApiRateLimit({
            organizationId: "org-1",
            apiKeyId: "key-1",
            routeKey: "contacts:get",
            limit: 1,
            windowMs: 60_000,
        })).toThrow(PublicApiError);
    });

    it("authenticates and returns rate limit metadata in one step", async () => {
        const token = generatePublicApiKeyValue("icx_pub");
        mockPublicApiKeyFindFirst.mockResolvedValueOnce({
            id: "key-1",
            name: "Primary",
            keyPrefix: token.keyPrefix,
            organization: {
                id: "org-1",
                slug: "acme",
                name: "Acme",
                subscriptionStatus: "active",
            },
        });
        mockPublicApiKeyUpdate.mockResolvedValueOnce({
            id: "key-1",
        });

        const result = await authenticateAndRateLimitPublicApiRequest(new Request("http://localhost/api/public/v1", {
            headers: {
                Authorization: `Bearer ${token.rawKey}`,
            },
        }), {
            routeKey: "contacts:get",
            limit: 2,
        });

        expect(result.context.organizationId).toBe("org-1");
        expect(result.rateLimit).toMatchObject({
            limit: 2,
            remaining: 1,
        });
        expect(result.rateLimit.resetAt).toBeInstanceOf(Date);
    });

    it("blocks suspended organizations from using the public API", async () => {
        const token = generatePublicApiKeyValue("icx_pub");
        mockPublicApiKeyFindFirst.mockResolvedValueOnce({
            id: "key-1",
            name: "Primary",
            keyPrefix: token.keyPrefix,
            organization: {
                id: "org-1",
                slug: "acme",
                name: "Acme",
                subscriptionStatus: "suspended",
            },
        });

        await expect(authenticatePublicApiRequest(new Request("http://localhost/api/public/v1", {
            headers: {
                Authorization: `Bearer ${token.rawKey}`,
            },
        }))).rejects.toMatchObject({
            status: 403,
            code: "FORBIDDEN",
        });
    });

    it("preserves public api error status and code in the response envelope", async () => {
        const response = publicApiErrorResponse(
            new Request("http://localhost/api/public/v1"),
            new PublicApiError("Too many requests. Try again later.", 429, "TOO_MANY_REQUESTS", { retryAfterSeconds: 60 }),
            {
                requestId: "req_test",
                rateLimit: {
                    limit: 60,
                    remaining: 0,
                    resetAt: new Date("2026-03-18T10:01:00.000Z"),
                },
            },
        );

        expect(response.status).toBe(429);
        expect(response.headers.get("x-request-id")).toBe("req_test");
        expect(response.headers.get("x-ratelimit-limit")).toBe("60");
        expect(response.headers.get("x-ratelimit-remaining")).toBe("0");
        expect(response.headers.get("x-ratelimit-reset")).toBe(String(Math.ceil(new Date("2026-03-18T10:01:00.000Z").getTime() / 1000)));
        await expect(response.json()).resolves.toMatchObject({
            data: null,
            meta: {
                requestId: "req_test",
                version: "v1",
            },
            error: {
                code: "rate_limited",
                message: "Too many requests. Try again later.",
                details: {
                    retryAfterSeconds: 60,
                },
            },
        });
    });
});
