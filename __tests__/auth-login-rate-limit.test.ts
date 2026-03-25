import {
    AUTH_LOGIN_IDENTIFIER_LIMIT,
    AUTH_LOGIN_IP_LIMIT,
    AUTH_LOGIN_WINDOW_MS,
    clearAuthLoginRateLimitState,
    consumeAuthLoginRateLimit,
    resolveAuthLoginClientIp,
} from "../lib/auth/login-rate-limit";

describe("auth login rate limit", () => {
    beforeEach(async () => {
        await clearAuthLoginRateLimitState();
    });

    function buildRequest(headers: Record<string, string> = {}): Request {
        return new Request("http://localhost/api/auth/login", {
            headers,
        });
    }

    it("resolves the client IP from forwarded headers", () => {
        expect(resolveAuthLoginClientIp(buildRequest({ "x-forwarded-for": "203.0.113.10, 10.0.0.1" }))).toBe("203.0.113.10");
        expect(resolveAuthLoginClientIp(buildRequest({ "x-real-ip": "198.51.100.20" }))).toBe("198.51.100.20");
        expect(resolveAuthLoginClientIp(buildRequest({ "x-vercel-forwarded-for": "198.51.100.30" }))).toBe("198.51.100.30");
        expect(resolveAuthLoginClientIp(buildRequest({ forwarded: 'for="[2001:db8::1]";proto=https' }))).toBe("2001:db8::1");
    });

    it("blocks repeated attempts for the same identifier", async () => {
        const request = buildRequest({ "x-forwarded-for": "203.0.113.10" });

        for (let attempt = 0; attempt < AUTH_LOGIN_IDENTIFIER_LIMIT; attempt += 1) {
            const decision = await consumeAuthLoginRateLimit({
                request,
                endpoint: "auth",
                identifier: "admin@acme.com",
                now: 0,
            });

            expect(decision.allowed).toBe(true);
        }

        const blocked = await consumeAuthLoginRateLimit({
            request,
            endpoint: "auth",
            identifier: "admin@acme.com",
            now: 0,
        });

        expect(blocked.allowed).toBe(false);
        expect(blocked.exceededBucket).toBe("identifier");
        expect(blocked.retryAfterSeconds).toBe(Math.ceil(AUTH_LOGIN_WINDOW_MS / 1000));
    });

    it("blocks repeated attempts by IP even when identifiers change", async () => {
        const request = buildRequest({ "x-forwarded-for": "203.0.113.20" });

        for (let attempt = 0; attempt < AUTH_LOGIN_IP_LIMIT; attempt += 1) {
            const decision = await consumeAuthLoginRateLimit({
                request,
                endpoint: "auth",
                identifier: `user-${attempt}@acme.com`,
                now: 0,
            });

            expect(decision.allowed).toBe(true);
        }

        const blocked = await consumeAuthLoginRateLimit({
            request,
            endpoint: "auth",
            identifier: "final-user@acme.com",
            now: 0,
        });

        expect(blocked.allowed).toBe(false);
        expect(blocked.exceededBucket).toBe("ip");
    });

    it("resets after the window elapses", async () => {
        const request = buildRequest({ "x-forwarded-for": "203.0.113.30" });

        for (let attempt = 0; attempt < AUTH_LOGIN_IDENTIFIER_LIMIT; attempt += 1) {
            await consumeAuthLoginRateLimit({
                request,
                endpoint: "auth",
                identifier: "admin@acme.com",
                now: 0,
            });
        }

        const blocked = await consumeAuthLoginRateLimit({
            request,
            endpoint: "auth",
            identifier: "admin@acme.com",
            now: 0,
        });
        expect(blocked.allowed).toBe(false);

        const reset = await consumeAuthLoginRateLimit({
            request,
            endpoint: "auth",
            identifier: "admin@acme.com",
            now: AUTH_LOGIN_WINDOW_MS + 1,
        });

        expect(reset.allowed).toBe(true);
        expect(reset.exceededBucket).toBe(null);
    });
});
