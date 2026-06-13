import { checkPdfRendererHealth } from "@/lib/report-engine/pdf-generator";
import { getStripeClient } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { verifyDatabaseConnection } from "@/lib/system/db-check";
import { inspectSystemSchedulerConfig } from "@/workers/system-scheduler";

export type SystemHealthStatus = {
    status: "ok" | "degraded";
    database: "connected" | "disconnected";
    engines: "operational" | "degraded";
    scheduler: "running" | "stopped";
    ai: "available" | "unavailable";
    whatsapp: "connected" | "disconnected";
    stripe: "connected" | "disconnected";
    pdf: "ready" | "unavailable";
};

const RECENT_SCHEDULER_WINDOW_MS = 24 * 60 * 60 * 1000;
const META_DB_KEYS = ["META_ACCESS_TOKEN", "META_PHONE_NUMBER_ID", "META_VERIFY_TOKEN"] as const;
const SYSTEM_HEALTH_CACHE_TTL_MS = 30_000;

let systemHealthCache: { expiresAt: number; value: SystemHealthStatus } | null = null;

function hasValue(value: string | undefined): boolean {
    return Boolean(value?.trim());
}

function hasOpenAIKey(): boolean {
    return hasValue(process.env.OPENAI_API_KEY);
}

function hasEnvWhatsAppCredentials(): boolean {
    const accessToken = hasValue(process.env.META_ACCESS_TOKEN) || hasValue(process.env.META_WHATSAPP_TOKEN);
    return accessToken
        && hasValue(process.env.META_PHONE_NUMBER_ID)
        && hasValue(process.env.META_VERIFY_TOKEN)
        && hasValue(process.env.META_APP_SECRET);
}

async function hasStoredWhatsAppCredentials(): Promise<boolean> {
    if (!hasValue(process.env.META_APP_SECRET)) {
        return false;
    }

    const rows = await prisma.systemSetting.findMany({
        where: {
            key: { in: [...META_DB_KEYS] },
        },
        select: {
            organizationId: true,
            key: true,
            value: true,
        },
    });

    const keysByOrg = new Map<string, Set<string>>();
    for (const row of rows) {
        if (!hasValue(row.value)) continue;

        const keySet = keysByOrg.get(row.organizationId) ?? new Set<string>();
        keySet.add(row.key);
        keysByOrg.set(row.organizationId, keySet);
    }

    return [...keysByOrg.values()].some((keySet) => META_DB_KEYS.every((key) => keySet.has(key)));
}

async function getDatabaseStatus(): Promise<SystemHealthStatus["database"]> {
    const result = await verifyDatabaseConnection();
    return result.status;
}

async function getSchedulerStatus(databaseStatus: SystemHealthStatus["database"]): Promise<SystemHealthStatus["scheduler"]> {
    const config = inspectSystemSchedulerConfig();
    if (config.enabledJobs.length === 0) {
        return "stopped";
    }

    if (databaseStatus === "connected") {
        try {
            const latestSnapshot = await prisma.warRoomSnapshot.findFirst({
                orderBy: { createdAt: "desc" },
                select: { createdAt: true },
            });

            if (latestSnapshot) {
                const ageMs = Date.now() - latestSnapshot.createdAt.getTime();
                if (ageMs <= RECENT_SCHEDULER_WINDOW_MS) {
                    return "running";
                }
            }
        } catch {
            // Fall back to config-based readiness below.
        }
    }

    if (process.env.NODE_ENV !== "production") {
        return "running";
    }

    return config.env.hasCronSecret ? "running" : "stopped";
}

async function getWhatsAppStatus(databaseStatus: SystemHealthStatus["database"]): Promise<SystemHealthStatus["whatsapp"]> {
    if (hasEnvWhatsAppCredentials()) {
        return "connected";
    }

    if (databaseStatus !== "connected") {
        return "disconnected";
    }

    try {
        return (await hasStoredWhatsAppCredentials()) ? "connected" : "disconnected";
    } catch {
        return "disconnected";
    }
}

function getStripeStatus(): SystemHealthStatus["stripe"] {
    try {
        return getStripeClient() ? "connected" : "disconnected";
    } catch {
        return "disconnected";
    }
}

async function getPdfStatus(): Promise<SystemHealthStatus["pdf"]> {
    try {
        const health = await checkPdfRendererHealth();
        return health.ready ? "ready" : "unavailable";
    } catch {
        return "unavailable";
    }
}

export async function getSystemHealthStatus(): Promise<SystemHealthStatus> {
    if (systemHealthCache && systemHealthCache.expiresAt > Date.now()) {
        return systemHealthCache.value;
    }

    const database = await getDatabaseStatus();

    const [scheduler, whatsapp, pdf] = await Promise.all([
        getSchedulerStatus(database),
        getWhatsAppStatus(database),
        getPdfStatus(),
    ]);

    const ai: SystemHealthStatus["ai"] = hasOpenAIKey() ? "available" : "unavailable";
    const stripe = getStripeStatus();

    const status: SystemHealthStatus["status"] =
        database === "connected"
            && scheduler === "running"
            && pdf === "ready"
            ? "ok"
            : "degraded";

    const engines: SystemHealthStatus["engines"] = status === "ok" ? "operational" : "degraded";

    const result: SystemHealthStatus = {
        status,
        database,
        engines,
        scheduler,
        ai,
        whatsapp,
        stripe,
        pdf,
    };

    systemHealthCache = {
        value: result,
        expiresAt: Date.now() + SYSTEM_HEALTH_CACHE_TTL_MS,
    };

    return result;
}
