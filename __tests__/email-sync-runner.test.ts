import { runScheduledEmailSync, type EmailSyncRunnerDb } from "../lib/integrations/email/sync-runner";

type IntegrationSeed = {
    id: string;
    organizationId: string;
    provider: string;
    status: string;
    ownerEmail: string;
    lastSyncAt: Date | null;
    lastSyncStatus: string | null;
    lastSyncDurationMs: number | null;
    lastError: string | null;
    updatedAt: Date;
};

function createRunnerDb(integrations: IntegrationSeed[], respectQuery = true): EmailSyncRunnerDb & {
    state: { integrations: IntegrationSeed[] };
} {
    const state = {
        integrations,
    };

    return {
        state,
        emailIntegration: {
            findMany: jest.fn(async ({ where }) => {
                if (!respectQuery) {
                    return [...state.integrations];
                }

                return state.integrations.filter((integration) =>
                    integration.provider === where.provider &&
                    integration.status === where.status,
                );
            }),
        },
    };
}

function createIntegration(overrides: Partial<IntegrationSeed> & Pick<IntegrationSeed, "id" | "organizationId" | "provider" | "status">): IntegrationSeed {
    return {
        ownerEmail: "owner@example.com",
        lastSyncAt: null,
        lastSyncStatus: null,
        lastSyncDurationMs: null,
        lastError: null,
        updatedAt: new Date("2026-03-18T10:00:00.000Z"),
        ...overrides,
    };
}

function createLogger() {
    return {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    };
}

type Deferred<T> = {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve, reject };
}

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("email sync runner", () => {
    test("selects only connected Google integrations", async () => {
        const db = createRunnerDb([
            createIntegration({
                id: "integration-1",
                organizationId: "org-1",
                provider: "google",
                status: "connected",
            }),
            createIntegration({
                id: "integration-2",
                organizationId: "org-2",
                provider: "google",
                status: "connected",
            }),
            createIntegration({
                id: "integration-3",
                organizationId: "org-3",
                provider: "google",
                status: "disconnected",
            }),
            createIntegration({
                id: "integration-4",
                organizationId: "org-4",
                provider: "microsoft",
                status: "connected",
            }),
        ]);
        const logger = createLogger();
        const syncMock = jest.fn(async ({ organizationId }: { organizationId: string }) => ({
            organizationId,
            provider: "google",
            syncedThreads: 1,
            syncedMessages: 1,
            matchedContacts: 0,
            linkedDeals: 0,
            skipped: false,
            lastSyncAt: new Date("2026-03-18T11:00:00.000Z").toISOString(),
            lastSyncStatus: "success",
            lastSyncDurationMs: 10,
        }));

        const result = await runScheduledEmailSync({
            db,
            syncEmailIntegration: syncMock as never,
            logger,
            batchSize: 5,
            concurrency: 2,
        });

        expect(db.emailIntegration.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                provider: "google",
                status: "connected",
            },
        }));
        expect(syncMock).toHaveBeenCalledTimes(2);
        expect(syncMock).toHaveBeenCalledWith({ organizationId: "org-1" });
        expect(syncMock).toHaveBeenCalledWith({ organizationId: "org-2" });
        expect(syncMock).not.toHaveBeenCalledWith({ organizationId: "org-3" });
        expect(syncMock).not.toHaveBeenCalledWith({ organizationId: "org-4" });
        expect(result.totalEligible).toBe(2);
        expect(result.processed).toBe(2);
        expect(result.succeeded).toBe(2);
        expect(result.failed).toBe(0);
        expect(result.skipped).toBe(0);
    });

    test("processes batches with bounded concurrency", async () => {
        const db = createRunnerDb([
            createIntegration({
                id: "integration-1",
                organizationId: "org-1",
                provider: "google",
                status: "connected",
                updatedAt: new Date("2026-03-18T09:00:00.000Z"),
            }),
            createIntegration({
                id: "integration-2",
                organizationId: "org-2",
                provider: "google",
                status: "connected",
                updatedAt: new Date("2026-03-18T10:00:00.000Z"),
            }),
            createIntegration({
                id: "integration-3",
                organizationId: "org-3",
                provider: "google",
                status: "connected",
                updatedAt: new Date("2026-03-18T11:00:00.000Z"),
            }),
        ]);
        const logger = createLogger();
        const gates = new Map<string, Deferred<void>>();
        const started: string[] = [];
        let active = 0;
        let maxActive = 0;

        const syncMock = jest.fn(async ({ organizationId }: { organizationId: string }) => {
            started.push(organizationId);
            active += 1;
            maxActive = Math.max(maxActive, active);
            const gate = createDeferred<void>();
            gates.set(organizationId, gate);
            await gate.promise;
            active -= 1;
            return {
                organizationId,
                provider: "google",
                syncedThreads: 1,
                syncedMessages: 1,
                matchedContacts: 0,
                linkedDeals: 0,
                skipped: false,
                lastSyncAt: new Date("2026-03-18T11:00:00.000Z").toISOString(),
                lastSyncStatus: "success",
                lastSyncDurationMs: 10,
            };
        });

        const runPromise = runScheduledEmailSync({
            db,
            syncEmailIntegration: syncMock as never,
            logger,
            batchSize: 2,
            concurrency: 2,
        });

        await flushMicrotasks();
        expect(started).toEqual(["org-1", "org-2"]);
        expect(maxActive).toBe(2);
        expect(syncMock).toHaveBeenCalledTimes(2);

        gates.get("org-1")?.resolve();
        gates.get("org-2")?.resolve();
        await flushMicrotasks();
        expect(started).toEqual(["org-1", "org-2", "org-3"]);

        gates.get("org-3")?.resolve();
        const result = await runPromise;

        expect(result.totalEligible).toBe(3);
        expect(result.processed).toBe(3);
        expect(maxActive).toBeLessThanOrEqual(2);
    });

    test("isolates failures so one integration does not abort the batch", async () => {
        const db = createRunnerDb([
            createIntegration({
                id: "integration-1",
                organizationId: "org-1",
                provider: "google",
                status: "connected",
            }),
            createIntegration({
                id: "integration-2",
                organizationId: "org-2",
                provider: "google",
                status: "connected",
            }),
            createIntegration({
                id: "integration-3",
                organizationId: "org-3",
                provider: "google",
                status: "connected",
            }),
        ]);
        const logger = createLogger();
        const syncMock = jest.fn(async ({ organizationId }: { organizationId: string }) => {
            if (organizationId === "org-2") {
                throw new Error("provider timeout");
            }

            return {
                organizationId,
                provider: "google",
                syncedThreads: 1,
                syncedMessages: 1,
                matchedContacts: 0,
                linkedDeals: 0,
                skipped: false,
                lastSyncAt: new Date("2026-03-18T11:00:00.000Z").toISOString(),
                lastSyncStatus: "success",
                lastSyncDurationMs: 10,
            };
        });

        const result = await runScheduledEmailSync({
            db,
            syncEmailIntegration: syncMock as never,
            logger,
            batchSize: 3,
            concurrency: 2,
        });

        expect(syncMock).toHaveBeenCalledTimes(3);
        expect(result.succeeded).toBe(2);
        expect(result.failed).toBe(1);
        expect(result.skipped).toBe(0);
        expect(result.results).toEqual(expect.arrayContaining([
            expect.objectContaining({ organizationId: "org-2", status: "failed", reason: "provider timeout" }),
        ]));
    });

    test("skips unsupported providers when they appear in a mixed dataset", async () => {
        const db = createRunnerDb([
            createIntegration({
                id: "integration-1",
                organizationId: "org-1",
                provider: "google",
                status: "connected",
            }),
            createIntegration({
                id: "integration-2",
                organizationId: "org-2",
                provider: "microsoft",
                status: "connected",
            }),
        ], false);
        const logger = createLogger();
        const syncMock = jest.fn(async ({ organizationId }: { organizationId: string }) => ({
            organizationId,
            provider: "google",
            syncedThreads: 1,
            syncedMessages: 1,
            matchedContacts: 0,
            linkedDeals: 0,
            skipped: false,
            lastSyncAt: new Date("2026-03-18T11:00:00.000Z").toISOString(),
            lastSyncStatus: "success",
            lastSyncDurationMs: 10,
        }));

        const result = await runScheduledEmailSync({
            db,
            syncEmailIntegration: syncMock as never,
            logger,
            batchSize: 5,
            concurrency: 2,
        });

        expect(syncMock).toHaveBeenCalledTimes(1);
        expect(syncMock).toHaveBeenCalledWith({ organizationId: "org-1" });
        expect(result.skipped).toBe(1);
        expect(result.results).toEqual(expect.arrayContaining([
            expect.objectContaining({
                organizationId: "org-2",
                status: "skipped",
                reason: "unsupported_provider",
            }),
        ]));
    });
});
