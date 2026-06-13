const mockRunScheduledEmailSync = jest.fn();

jest.mock("../lib/logger", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
    withApiLogging: (_route: string, _method: string, handler: unknown) => handler,
}));

jest.mock("../lib/integrations/email/sync-runner", () => ({
    runScheduledEmailSync: mockRunScheduledEmailSync,
}));

import { GET as emailSyncCronGET, POST as emailSyncCronPOST } from "../app/api/cron/email-sync/route";

describe("email sync cron route", () => {
    const originalCronSecret = process.env.CRON_SECRET;
    const originalVercelEnv = process.env.VERCEL_ENV;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.CRON_SECRET = "cron-secret";
        process.env.VERCEL_ENV = "preview";
    });

    afterAll(() => {
        process.env.CRON_SECRET = originalCronSecret;
        process.env.VERCEL_ENV = originalVercelEnv;
    });

    test("rejects requests without the cron secret", async () => {
        const response = await emailSyncCronGET(new Request("http://localhost/api/cron/email-sync") as any);

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toMatchObject({
            success: false,
            error: "Unauthorized",
        });
        expect(mockRunScheduledEmailSync).not.toHaveBeenCalled();
    });

    test("fails safely in production when CRON_SECRET is missing", async () => {
        process.env.CRON_SECRET = "";
        process.env.VERCEL_ENV = "production";

        const response = await emailSyncCronGET(new Request("http://localhost/api/cron/email-sync") as any);

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toMatchObject({
            success: false,
            error: "CRON_SECRET is not configured",
        });
        expect(mockRunScheduledEmailSync).not.toHaveBeenCalled();
    });

    test("accepts authorization bearer cron secret and runs the job", async () => {
        mockRunScheduledEmailSync.mockResolvedValue({
            provider: "google",
            batchSize: 5,
            concurrency: 2,
            totalEligible: 2,
            processed: 2,
            succeeded: 2,
            failed: 0,
            skipped: 0,
            durationMs: 25,
            results: [],
        });

        const response = await emailSyncCronPOST(
            new Request("http://localhost/api/cron/email-sync", {
                method: "POST",
                headers: {
                    authorization: "Bearer cron-secret",
                },
            }) as any,
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            success: true,
            data: {
                provider: "google",
                succeeded: 2,
                failed: 0,
            },
        });
        expect(mockRunScheduledEmailSync).toHaveBeenCalledTimes(1);
    });

    test("accepts x-cron-secret and runs the job", async () => {
        mockRunScheduledEmailSync.mockResolvedValue({
            provider: "google",
            batchSize: 5,
            concurrency: 2,
            totalEligible: 1,
            processed: 1,
            succeeded: 1,
            failed: 0,
            skipped: 0,
            durationMs: 10,
            results: [],
        });

        const response = await emailSyncCronGET(
            new Request("http://localhost/api/cron/email-sync", {
                headers: {
                    "x-cron-secret": "cron-secret",
                },
            }) as any,
        );

        expect(response.status).toBe(200);
        expect(mockRunScheduledEmailSync).toHaveBeenCalledTimes(1);
    });
});
