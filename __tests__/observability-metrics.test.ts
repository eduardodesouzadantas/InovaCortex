import { withApiLogging } from "@/lib/logger";
import { getObservabilityMetricsSnapshot, resetObservabilityMetrics } from "@/lib/observability/metrics";

describe("observability metrics", () => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    beforeEach(() => {
        resetObservabilityMetrics();
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

    it("records request counts, errors, and latency per route", async () => {
        const handler = withApiLogging("/api/metrics", "GET", async () => new Response("ok", { status: 200 }));
        const invoke = handler as unknown as (request: Request) => Promise<Response>;

        const response = await invoke(new Request("http://localhost/api/metrics"));

        expect(response.status).toBe(200);

        const snapshot = getObservabilityMetricsSnapshot();
        expect(snapshot.summary.totalRequests).toBe(1);
        expect(snapshot.summary.totalErrors).toBe(0);
        expect(snapshot.routes).toHaveLength(1);
        expect(snapshot.routes[0]).toMatchObject({
            route: "/api/metrics",
            method: "GET",
            requestCount: 1,
            errorCount: 0,
            lastStatus: 200,
        });
        expect(snapshot.routes[0].averageResponseMs).toBeGreaterThanOrEqual(0);
    });

    it("increments error counts for failing routes", async () => {
        const handler = withApiLogging("/api/metrics", "GET", async () => {
            throw new Error("boom");
        });
        const invoke = handler as unknown as (request: Request) => Promise<Response>;

        const response = await invoke(new Request("http://localhost/api/metrics"));

        expect(response.status).toBe(500);

        const snapshot = getObservabilityMetricsSnapshot();
        expect(snapshot.summary.totalRequests).toBe(1);
        expect(snapshot.summary.totalErrors).toBe(1);
        expect(snapshot.routes[0]).toMatchObject({
            route: "/api/metrics",
            method: "GET",
            requestCount: 1,
            errorCount: 1,
            lastStatus: 500,
        });
    });
});
