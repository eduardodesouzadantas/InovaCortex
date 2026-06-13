const mockGetOperationalHealthReport = jest.fn();

jest.mock("../lib/logger", () => ({
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

jest.mock("../lib/system/operational-health", () => ({
    getOperationalHealthReport: mockGetOperationalHealthReport,
}));

import { GET as healthGET } from "../app/api/health/route";

describe("health route", () => {
    const invoke = healthGET as unknown as (request: Request) => Promise<Response>;

    const origEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...origEnv, APP_ENCRYPTION_KEY: "test-key" };
    });

    afterEach(() => {
        process.env = origEnv;
    });

    it("returns the operational health payload with status headers", async () => {
        mockGetOperationalHealthReport.mockResolvedValueOnce({
            status: "degraded",
            generatedAt: "2026-03-19T12:00:00.000Z",
            subsystems: {
                db: {
                    status: "ok",
                    checkedAt: "2026-03-19T12:00:00.000Z",
                    details: {},
                },
                emailSync: {
                    status: "degraded",
                    checkedAt: "2026-03-19T12:00:00.000Z",
                    details: {
                        reason: "no_connected_email_integration",
                    },
                },
                webhooks: {
                    status: "ok",
                    checkedAt: "2026-03-19T12:00:00.000Z",
                    details: {
                        activeEndpoints: 1,
                    },
                },
            },
            metrics: {
                summary: {
                    totalRequests: 10,
                    totalErrors: 1,
                    averageResponseMs: 42,
                },
                routes: [],
            },
        });

        const response = await invoke(new Request("http://localhost/api/health", {
            headers: {
                "x-request-id": "req-health",
            },
        })) as Response;

        expect(response.status).toBe(200);
        expect(response.headers.get("x-request-id")).toBe("req-health");
        expect(response.headers.get("x-health-status")).toBe("degraded");
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            data: {
                status: "degraded",
                subsystems: {
                    emailSync: {
                        status: "degraded",
                    },
                },
                metrics: {
                    summary: {
                        totalRequests: 10,
                        totalErrors: 1,
                    },
                },
            },
            meta: {
                requestId: "req-health",
            },
        });
    });

    it("returns 503 when the system is down", async () => {
        mockGetOperationalHealthReport.mockResolvedValueOnce({
            status: "down",
            generatedAt: "2026-03-19T12:00:00.000Z",
            subsystems: {
                db: {
                    status: "down",
                    checkedAt: "2026-03-19T12:00:00.000Z",
                    details: {},
                },
                emailSync: {
                    status: "down",
                    checkedAt: "2026-03-19T12:00:00.000Z",
                    details: {},
                },
                webhooks: {
                    status: "down",
                    checkedAt: "2026-03-19T12:00:00.000Z",
                    details: {},
                },
            },
            metrics: {
                summary: {
                    totalRequests: 0,
                    totalErrors: 0,
                    averageResponseMs: 0,
                },
                routes: [],
            },
        });

        const response = await invoke(new Request("http://localhost/api/health")) as Response;

        expect(response.status).toBe(503);
        expect(response.headers.get("x-health-status")).toBe("down");
    });
});
