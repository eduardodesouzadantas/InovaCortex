jest.mock("../lib/prisma", () => ({
    prisma: {
        $queryRaw: jest.fn(async () => {
            throw new Error("database unavailable");
        }),
        $executeRaw: jest.fn(async () => 0),
    },
}));

jest.mock("../lib/logger", () => ({
    logger: {
        warn: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
    },
}));

import { logger as loggerModule } from "../lib/logger";
import {
    AUTH_RATE_LIMIT_WINDOW_MS,
    consumeAuthLoginRateLimit,
    resetAuthRateLimitStoreForTesting,
} from "../lib/auth/auth-rate-limit";

const mockLogger = jest.mocked(loggerModule);

describe("auth rate limit fallback", () => {
    const originalStore = process.env.AUTH_RATE_LIMIT_STORE;

    beforeEach(() => {
        jest.clearAllMocks();
        resetAuthRateLimitStoreForTesting();
        process.env.AUTH_RATE_LIMIT_STORE = "database";
    });

    afterEach(() => {
        if (typeof originalStore === "undefined") {
            delete process.env.AUTH_RATE_LIMIT_STORE;
        } else {
            process.env.AUTH_RATE_LIMIT_STORE = originalStore;
        }
        resetAuthRateLimitStoreForTesting();
    });

    it("logs a structured degraded-mode warning when the shared store fails", async () => {
        const decision = await consumeAuthLoginRateLimit({
            request: new Request("http://localhost/api/auth/login", {
                headers: {
                    "x-forwarded-for": "203.0.113.10",
                },
            }),
            endpoint: "auth",
            identifier: "admin@acme.com",
        });

        expect(decision.allowed).toBe(true);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            "Auth rate limit shared store unavailable; falling back to memory",
            expect.objectContaining({
                operation: "auth_rate_limit_store_fallback",
                result: "degraded",
                fallbackMode: "memory",
                sharedStore: "prisma",
                scope: "login",
                windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
                error: "database unavailable",
            }),
        );
    });
});

