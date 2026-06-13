import { prisma } from "@/lib/prisma";
import { getObservabilityMetricsSnapshot } from "@/lib/observability/metrics";
import { verifyDatabaseConnection } from "@/lib/system/db-check";

export type HealthStatus = "ok" | "degraded" | "down";

export type ServiceHealthSnapshot = {
    status: HealthStatus;
    checkedAt: string;
    details: Record<string, unknown>;
};

export type OperationalHealthReport = {
    status: HealthStatus;
    generatedAt: string;
    subsystems: {
        db: ServiceHealthSnapshot;
        emailSync: ServiceHealthSnapshot;
        webhooks: ServiceHealthSnapshot;
    };
    metrics: ReturnType<typeof getObservabilityMetricsSnapshot>;
};

const EMAIL_SYNC_RUNNING_STALE_MS = 30 * 60 * 1000;
const EMAIL_SYNC_SUCCESS_STALE_MS = 2 * 60 * 60 * 1000;
const WEBHOOK_FAILURE_STALE_MS = 24 * 60 * 60 * 1000;
const HEALTH_CACHE_TTL_MS = 15_000;

let operationalHealthCache: { expiresAt: number; value: OperationalHealthReport } | null = null;

function pickWorstStatus(statuses: HealthStatus[]): HealthStatus {
    if (statuses.includes("down")) return "down";
    if (statuses.includes("degraded")) return "degraded";
    return "ok";
}

function toIso(value: Date | null | undefined): string | null {
    return value ? value.toISOString() : null;
}

function buildDbSnapshot(status: HealthStatus, details: Record<string, unknown> = {}): ServiceHealthSnapshot {
    return {
        status,
        checkedAt: new Date().toISOString(),
        details,
    };
}

function buildFallbackSnapshot(
    status: HealthStatus,
    details: Record<string, unknown>,
): ServiceHealthSnapshot {
    return {
        status,
        checkedAt: new Date().toISOString(),
        details,
    };
}

async function evaluateEmailSyncHealth(dbConnected: boolean): Promise<ServiceHealthSnapshot> {
    if (!dbConnected) {
        return buildFallbackSnapshot("down", {
            reason: "database_unavailable",
        });
    }

    const connectedCount = await prisma.emailIntegration.count({
        where: { status: "connected" },
    });

    const latest = await prisma.emailIntegration.findFirst({
        where: { status: "connected" },
        orderBy: [{ updatedAt: "desc" }],
        select: {
            provider: true,
            status: true,
            lastSyncAt: true,
            lastSyncStatus: true,
            lastSyncDurationMs: true,
            lastError: true,
            updatedAt: true,
        },
    });

    if (!latest) {
        return buildFallbackSnapshot("degraded", {
            connectedIntegrations: connectedCount,
            reason: "no_connected_email_integration",
        });
    }

    const now = Date.now();
    const lastSyncAt = toIso(latest.lastSyncAt);
    const ageMs = latest.lastSyncAt ? now - latest.lastSyncAt.getTime() : null;
    let status: HealthStatus = "ok";

    if (latest.lastSyncStatus === "running") {
        status = ageMs !== null && ageMs > EMAIL_SYNC_RUNNING_STALE_MS ? "down" : "degraded";
    } else if (latest.lastSyncStatus === "failed" || latest.lastSyncStatus === "skipped") {
        status = "degraded";
    } else if (latest.lastSyncStatus !== "success") {
        status = "degraded";
    } else if (ageMs !== null && ageMs > EMAIL_SYNC_SUCCESS_STALE_MS) {
        status = "degraded";
    }

    return {
        status,
        checkedAt: new Date().toISOString(),
        details: {
            connectedIntegrations: connectedCount,
            provider: latest.provider,
            lastSyncAt,
            lastSyncStatus: latest.lastSyncStatus,
            lastSyncDurationMs: latest.lastSyncDurationMs,
            updatedAt: latest.updatedAt.toISOString(),
            ageMs,
        },
    };
}

async function evaluateWebhookHealth(dbConnected: boolean): Promise<ServiceHealthSnapshot> {
    if (!dbConnected) {
        return buildFallbackSnapshot("down", {
            reason: "database_unavailable",
        });
    }

    const activeCount = await prisma.webhookEndpoint.count({
        where: { isActive: true },
    });

    const latestActive = await prisma.webhookEndpoint.findFirst({
        where: { isActive: true },
        orderBy: [{ lastDeliveryAt: "desc" }, { updatedAt: "desc" }],
        select: {
            url: true,
            isActive: true,
            subscribedEvents: true,
            lastDeliveryAt: true,
            lastDeliveryStatus: true,
            lastDeliveryError: true,
            deliveryAttemptCount: true,
            updatedAt: true,
        },
    });

    if (!latestActive) {
        return buildFallbackSnapshot("degraded", {
            activeEndpoints: activeCount,
            reason: "no_active_webhook_endpoints",
        });
    }

    const now = Date.now();
    const lastDeliveryAt = toIso(latestActive.lastDeliveryAt);
    const ageMs = latestActive.lastDeliveryAt ? now - latestActive.lastDeliveryAt.getTime() : null;
    let status: HealthStatus = "ok";

    if (latestActive.lastDeliveryStatus === "failed") {
        status = ageMs !== null && ageMs > WEBHOOK_FAILURE_STALE_MS ? "degraded" : "down";
    } else if (latestActive.lastDeliveryStatus === "delivered") {
        status = "ok";
    } else if (activeCount > 0) {
        status = "ok";
    } else {
        status = "degraded";
    }

    return {
        status,
        checkedAt: new Date().toISOString(),
        details: {
            activeEndpoints: activeCount,
            subscribedEvents: latestActive.subscribedEvents,
            lastDeliveryAt,
            lastDeliveryStatus: latestActive.lastDeliveryStatus,
            deliveryAttemptCount: latestActive.deliveryAttemptCount,
            updatedAt: latestActive.updatedAt.toISOString(),
            ageMs,
        },
    };
}

async function safeProbe(
    probeName: "emailSync" | "webhooks",
    fn: () => Promise<ServiceHealthSnapshot>,
): Promise<ServiceHealthSnapshot> {
    try {
        return await fn();
    } catch (error) {
        return buildFallbackSnapshot("down", {
            reason: `${probeName}_probe_failed`,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

export function clearOperationalHealthCache(): void {
    operationalHealthCache = null;
}

export async function getOperationalHealthReport(): Promise<OperationalHealthReport> {
    if (operationalHealthCache && operationalHealthCache.expiresAt > Date.now()) {
        return operationalHealthCache.value;
    }

    const metrics = getObservabilityMetricsSnapshot();
    const dbResult = await verifyDatabaseConnection();
    const dbStatus: HealthStatus = dbResult.ok ? "ok" : "down";
    const db = buildDbSnapshot(dbStatus, {
        configurationWarnings: dbResult.configuration.warnings,
        ...(dbResult.details ? { details: dbResult.details } : {}),
    });

    let emailSync: ServiceHealthSnapshot;
    let webhooks: ServiceHealthSnapshot;

    if (dbResult.ok) {
        [emailSync, webhooks] = await Promise.all([
            safeProbe("emailSync", () => evaluateEmailSyncHealth(true)),
            safeProbe("webhooks", () => evaluateWebhookHealth(true)),
        ]);
    } else {
        emailSync = buildFallbackSnapshot("down", {
            reason: "database_unavailable",
        });
        webhooks = buildFallbackSnapshot("down", {
            reason: "database_unavailable",
        });
    }

    const status = pickWorstStatus([db.status, emailSync.status, webhooks.status]);
    const report: OperationalHealthReport = {
        status,
        generatedAt: new Date().toISOString(),
        subsystems: {
            db,
            emailSync,
            webhooks,
        },
        metrics,
    };

    operationalHealthCache = {
        value: report,
        expiresAt: Date.now() + HEALTH_CACHE_TTL_MS,
    };

    return report;
}
