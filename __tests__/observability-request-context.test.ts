import {
    createRequestId,
    getRequestContext,
    resolveRequestIdFromHeaders,
    runWithRequestContext,
    setRequestContext,
} from "@/lib/observability/request-context";

describe("observability request context", () => {
    it("propagates request context through async work", async () => {
        await runWithRequestContext({
            requestId: "req_123",
            organizationId: "org-1",
            route: "/api/test",
        }, async () => {
            setRequestContext({
                userId: "user-1",
                operation: "unit_test",
            });

            expect(getRequestContext()).toMatchObject({
                requestId: "req_123",
                organizationId: "org-1",
                route: "/api/test",
                userId: "user-1",
                operation: "unit_test",
            });
        });

        expect(getRequestContext()).toEqual({});
    });

    it("resolves or generates request ids from headers", () => {
        expect(resolveRequestIdFromHeaders(new Headers({
            "x-request-id": " req_custom ",
        }))).toBe("req_custom");
        expect(resolveRequestIdFromHeaders(new Headers({
            "x-correlation-id": " corr_custom ",
        }))).toBe("corr_custom");
        expect(resolveRequestIdFromHeaders(new Headers())).toMatch(/^req_/);
        expect(createRequestId()).toMatch(/^req_/);
    });
});
