import { prisma } from "@/lib/prisma";
import { logger as defaultLogger } from "@/lib/logger";
import { type EmailOAuthProvider } from "@/lib/integrations/email-oauth-types";
import { createRequestId, getRequestContext, setRequestContext } from "@/lib/observability/request-context";
import { syncEmailIntegration } from "./sync-service";

const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_CONCURRENCY = 2;
const SUPPORTED_RUNNER_PROVIDER: EmailOAuthProvider = "google";

type RunnerIntegrationRecord = {
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

export type EmailSyncRunnerDb = {
    emailIntegration: {
        findMany: (args: {
            where: {
                provider: EmailOAuthProvider;
                status: string;
            };
            select: {
                id: true;
                organizationId: true;
                provider: true;
                status: true;
                ownerEmail: true;
                lastSyncAt: true;
                lastSyncStatus: true;
                lastSyncDurationMs: true;
                lastError: true;
                updatedAt: true;
            };
            orderBy: Array<{
                updatedAt?: "asc" | "desc";
                organizationId?: "asc" | "desc";
            }>;
        }) => Promise<RunnerIntegrationRecord[]>;
    };
};

export type EmailSyncRunnerSummary = {
    provider: EmailOAuthProvider;
    batchSize: number;
    concurrency: number;
    totalEligible: number;
    processed: number;
    succeeded: number;
    failed: number;
    skipped: number;
    durationMs: number;
    results: Array<{
        integrationId: string;
        organizationId: string;
        provider: string;
        status: "success" | "failed" | "skipped";
        syncedThreads: number;
        syncedMessages: number;
        skipped: boolean;
        reason?: string;
    }>;
};

export type RunScheduledEmailSyncInput = {
    db?: EmailSyncRunnerDb;
    syncEmailIntegration?: typeof syncEmailIntegration;
    logger?: Pick<typeof defaultLogger, "info" | "warn" | "error">;
    batchSize?: number;
    concurrency?: number;
    provider?: EmailOAuthProvider;
};

function sanitizeRunnerError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.replace(/[\r\n]+/g, " ").trim().slice(0, 240) || "EMAIL_SYNC_RUNNER_FAILED";
}

function chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}

async function processWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    handler: (item: T) => Promise<R>,
): Promise<R[]> {
    const results: R[] = [];

    for (let index = 0; index < items.length; index += concurrency) {
        const slice = items.slice(index, index + concurrency);
        const sliceResults = await Promise.all(slice.map((item) => handler(item)));
        results.push(...sliceResults);
    }

    return results;
}

export async function runScheduledEmailSync(input: RunScheduledEmailSyncInput = {}): Promise<EmailSyncRunnerSummary> {
    const db = input.db ?? (prisma as unknown as EmailSyncRunnerDb);
    const syncEmail = input.syncEmailIntegration ?? syncEmailIntegration;
    const log = input.logger ?? defaultLogger;
    const batchSize = Math.max(1, input.batchSize ?? DEFAULT_BATCH_SIZE);
    const concurrency = Math.max(1, Math.min(input.concurrency ?? DEFAULT_CONCURRENCY, batchSize));
    const startedAt = Date.now();
    const currentContext = getRequestContext();
    setRequestContext({
        requestId: currentContext.requestId ?? createRequestId("job"),
        operation: "email_sync_runner",
    });

    const integrations = await db.emailIntegration.findMany({
        where: {
            provider: SUPPORTED_RUNNER_PROVIDER,
            status: "connected",
        },
        select: {
            id: true,
            organizationId: true,
            provider: true,
            status: true,
            ownerEmail: true,
            lastSyncAt: true,
            lastSyncStatus: true,
            lastSyncDurationMs: true,
            lastError: true,
            updatedAt: true,
        },
        orderBy: [
            { updatedAt: "asc" },
            { organizationId: "asc" },
        ],
    });

    const batches = chunk(integrations, batchSize);
    const results: EmailSyncRunnerSummary["results"] = [];

    log.info("[Email Sync Cron] Starting scheduled email sync", {
        provider: SUPPORTED_RUNNER_PROVIDER,
        totalEligible: integrations.length,
        batchSize,
        concurrency,
    });

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
        const batch = batches[batchIndex] ?? [];
        if (batch.length === 0) {
            continue;
        }

        log.info("[Email Sync Cron] Processing email sync batch", {
            provider: SUPPORTED_RUNNER_PROVIDER,
            batchIndex: batchIndex + 1,
            batchSize: batch.length,
            concurrency,
        });

        const batchResults = await processWithConcurrency(batch, concurrency, async (integration) => {
            if (integration.provider !== SUPPORTED_RUNNER_PROVIDER) {
                log.info("[Email Sync Cron] Skipping unsupported provider", {
                    integrationId: integration.id,
                    orgId: integration.organizationId,
                    provider: integration.provider,
                });

                return {
                    integrationId: integration.id,
                    organizationId: integration.organizationId,
                    provider: integration.provider,
                    status: "skipped" as const,
                    syncedThreads: 0,
                    syncedMessages: 0,
                    skipped: true,
                    reason: "unsupported_provider",
                };
            }

            log.info("[Email Sync Cron] Syncing connected email integration", {
                integrationId: integration.id,
                orgId: integration.organizationId,
                provider: integration.provider,
            });

            try {
                const result = await syncEmail({
                    organizationId: integration.organizationId,
                });

                log.info("[Email Sync Cron] Email integration sync completed", {
                    integrationId: integration.id,
                    orgId: integration.organizationId,
                    provider: integration.provider,
                    syncedThreads: result.syncedThreads,
                    syncedMessages: result.syncedMessages,
                    skipped: result.skipped,
                    reason: result.reason,
                });

                return {
                    integrationId: integration.id,
                    organizationId: integration.organizationId,
                    provider: integration.provider,
                    status: result.skipped ? "skipped" as const : "success" as const,
                    syncedThreads: result.syncedThreads,
                    syncedMessages: result.syncedMessages,
                    skipped: result.skipped,
                    reason: result.reason,
                };
            } catch (error) {
                const message = sanitizeRunnerError(error);

                log.warn("[Email Sync Cron] Email integration sync failed", {
                    integrationId: integration.id,
                    orgId: integration.organizationId,
                    provider: integration.provider,
                    error: message,
                });

                return {
                    integrationId: integration.id,
                    organizationId: integration.organizationId,
                    provider: integration.provider,
                    status: "failed" as const,
                    syncedThreads: 0,
                    syncedMessages: 0,
                    skipped: false,
                    reason: message,
                };
            }
        });

        results.push(...batchResults);
    }

    const succeeded = results.filter((result) => result.status === "success").length;
    const failed = results.filter((result) => result.status === "failed").length;
    const skipped = results.filter((result) => result.status === "skipped").length;
    const durationMs = Date.now() - startedAt;

    log.info("[Email Sync Cron] Completed scheduled email sync", {
        provider: SUPPORTED_RUNNER_PROVIDER,
        totalEligible: integrations.length,
        succeeded,
        failed,
        skipped,
        durationMs,
    });

    return {
        provider: SUPPORTED_RUNNER_PROVIDER,
        batchSize,
        concurrency,
        totalEligible: integrations.length,
        processed: results.length,
        succeeded,
        failed,
        skipped,
        durationMs,
        results,
    };
}
