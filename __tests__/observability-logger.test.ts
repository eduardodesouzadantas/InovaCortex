import { logger } from "@/lib/observability/logger";
import { runWithRequestContext } from "@/lib/observability/request-context";

describe("observability logger", () => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    beforeEach(() => {
        console.log = jest.fn();
        console.warn = jest.fn();
        console.error = jest.fn();
    });

    afterEach(() => {
        console.log = originalLog;
        console.warn = originalWarn;
        console.error = originalError;
        jest.clearAllMocks();
    });

    it("writes structured JSON with the active request context", async () => {
        await runWithRequestContext({
            requestId: "req_999",
            organizationId: "org-1",
            userId: "user-1",
            route: "/api/test",
        }, async () => {
            logger.info("observability_check", {
                token: "secret",
                nested: {
                    password: "hidden",
                    note: "safe",
                },
            });
        });

        expect(console.log).toHaveBeenCalledTimes(1);
        const payload = JSON.parse((console.log as jest.Mock).mock.calls[0][0] as string);

        expect(payload).toMatchObject({
            level: "info",
            message: "observability_check",
            requestId: "req_999",
            organizationId: "org-1",
            userId: "user-1",
            route: "/api/test",
        });
        expect(payload.ctx.token).toBe("[REDACTED]");
        expect(payload.ctx.nested.password).toBe("[REDACTED]");
        expect(payload.ctx.nested.note).toBe("safe");
    });

    it("logs errors with the same structured envelope", async () => {
        await runWithRequestContext({
            requestId: "req_error",
            organizationId: "org-1",
        }, async () => {
            logger.error("observability_failed", {
                error: "boom",
            });
        });

        expect(console.error).toHaveBeenCalledTimes(1);
        const payload = JSON.parse((console.error as jest.Mock).mock.calls[0][0] as string);

        expect(payload).toMatchObject({
            level: "error",
            message: "observability_failed",
            requestId: "req_error",
            organizationId: "org-1",
        });
    });
});
