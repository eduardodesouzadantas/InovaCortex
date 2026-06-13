import { getLatestWarRoomSnapshot } from "@/lib/agency/war-room/war-room-engine";
import { ChatEngine } from "@/lib/ai/chat-engine";
import { generateTextCompletion } from "@/lib/ai/openai-client";
import { generateMarketingPlan } from "@/lib/agents/marketing-planner-agent";
import { prisma } from "@/lib/prisma";
import { checkPdfRendererHealth, generatePdfFromHtml } from "@/lib/report-engine/pdf-generator";
import { getLeaderboard } from "@/lib/sales/stats-engine";
import { verifyDatabaseConnection } from "@/lib/system/db-check";
import { runAlertEngine } from "@/lib/whatsapp/alert-engine";
import { inspectSystemSchedulerConfig } from "@/workers/system-scheduler";

export type EngineStatus = "running" | "stopped" | "error";

export type SystemEnginesStatus = {
    scheduler: EngineStatus;
    warRoomEngine: EngineStatus;
    aiEngine: EngineStatus;
    whatsappEngine: EngineStatus;
    pdfEngine: EngineStatus;
    salesEngine: EngineStatus;
    marketingEngine: EngineStatus;
};

const RECENT_SCHEDULER_WINDOW_MS = 24 * 60 * 60 * 1000;
const META_DB_KEYS = ["META_ACCESS_TOKEN", "META_PHONE_NUMBER_ID", "META_VERIFY_TOKEN"] as const;
const SYSTEM_ENGINES_CACHE_TTL_MS = 30_000;

let systemEnginesCache: { expiresAt: number; value: SystemEnginesStatus } | null = null;

function hasValue(value: string | undefined): boolean {
    return Boolean(value?.trim());
}

function hasEnvWhatsAppCredentials(): boolean {
    const accessToken = hasValue(process.env.META_ACCESS_TOKEN) || hasValue(process.env.META_WHATSAPP_TOKEN);
    return accessToken
        && hasValue(process.env.META_PHONE_NUMBER_ID)
        && hasValue(process.env.META_VERIFY_TOKEN)
        && hasValue(process.env.META_APP_SECRET);
}

async function ensureDatabaseReady(): Promise<boolean> {
    const result = await verifyDatabaseConnection();
    return result.ok;
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

        const keys = keysByOrg.get(row.organizationId) ?? new Set<string>();
        keys.add(row.key);
        keysByOrg.set(row.organizationId, keys);
    }

    return [...keysByOrg.values()].some((keys) => META_DB_KEYS.every((key) => keys.has(key)));
}

async function getSchedulerEngineStatus(databaseReady: boolean): Promise<EngineStatus> {
    try {
        const config = inspectSystemSchedulerConfig();
        if (config.enabledJobs.length === 0) {
            return "stopped";
        }

        if (!databaseReady) {
            return "error";
        }

        const latestSnapshot = await prisma.warRoomSnapshot.findFirst({
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
        });

        if (latestSnapshot) {
            const ageMs = Date.now() - latestSnapshot.createdAt.getTime();
            if (ageMs <= RECENT_SCHEDULER_WINDOW_MS) {
                return "running";
            }

            return process.env.NODE_ENV === "production" ? "error" : "running";
        }

        if (process.env.NODE_ENV === "production" && !config.env.hasCronSecret) {
            return "stopped";
        }

        return "running";
    } catch {
        return "error";
    }
}

async function getWarRoomEngineStatus(databaseReady: boolean): Promise<EngineStatus> {
    if (!databaseReady) {
        return "error";
    }

    try {
        const org = await prisma.organization.findFirst({
            select: { id: true },
            orderBy: { createdAt: "asc" },
        });

        if (!org) {
            return "stopped";
        }

        await getLatestWarRoomSnapshot(org.id);
        return "running";
    } catch {
        return "error";
    }
}

async function getAiEngineStatus(): Promise<EngineStatus> {
    try {
        if (!hasValue(process.env.OPENAI_API_KEY)) {
            return "stopped";
        }

        if (!ChatEngine || typeof ChatEngine.answerChat !== "function") {
            return "error";
        }

        if (typeof generateTextCompletion !== "function") {
            return "error";
        }

        return "running";
    } catch {
        return "error";
    }
}

async function getWhatsAppEngineStatus(databaseReady: boolean): Promise<EngineStatus> {
    try {
        if (!hasValue(process.env.META_APP_SECRET)) {
            return "stopped";
        }

        if (typeof runAlertEngine !== "function") {
            return "error";
        }

        if (hasEnvWhatsAppCredentials()) {
            return "running";
        }

        if (!databaseReady) {
            return "error";
        }

        return (await hasStoredWhatsAppCredentials()) ? "running" : "stopped";
    } catch {
        return "error";
    }
}

async function getPdfEngineStatus(): Promise<EngineStatus> {
    try {
        if (typeof generatePdfFromHtml !== "function") {
            return "error";
        }

        const health = await checkPdfRendererHealth();
        return health.ready ? "running" : "stopped";
    } catch {
        return "error";
    }
}

async function getSalesEngineStatus(databaseReady: boolean): Promise<EngineStatus> {
    if (!databaseReady) {
        return "error";
    }

    try {
        if (typeof getLeaderboard !== "function") {
            return "error";
        }

        await prisma.salesRep.findFirst({
            select: { id: true },
            orderBy: { createdAt: "asc" },
        });
        return "running";
    } catch {
        return "error";
    }
}

async function getMarketingEngineStatus(databaseReady: boolean): Promise<EngineStatus> {
    if (!databaseReady) {
        return "error";
    }

    try {
        if (typeof generateMarketingPlan !== "function") {
            return "error";
        }

        await prisma.marketingPlan.findFirst({
            select: { id: true },
            orderBy: { createdAt: "asc" },
        });
        return "running";
    } catch {
        return "error";
    }
}

export async function getSystemEnginesStatus(): Promise<SystemEnginesStatus> {
    if (systemEnginesCache && systemEnginesCache.expiresAt > Date.now()) {
        return systemEnginesCache.value;
    }

    const databaseReady = await ensureDatabaseReady();

    const [
        scheduler,
        warRoomEngine,
        aiEngine,
        whatsappEngine,
        pdfEngine,
        salesEngine,
        marketingEngine,
    ] = await Promise.all([
        getSchedulerEngineStatus(databaseReady),
        getWarRoomEngineStatus(databaseReady),
        getAiEngineStatus(),
        getWhatsAppEngineStatus(databaseReady),
        getPdfEngineStatus(),
        getSalesEngineStatus(databaseReady),
        getMarketingEngineStatus(databaseReady),
    ]);

    const result = {
        scheduler,
        warRoomEngine,
        aiEngine,
        whatsappEngine,
        pdfEngine,
        salesEngine,
        marketingEngine,
    };

    systemEnginesCache = {
        value: result,
        expiresAt: Date.now() + SYSTEM_ENGINES_CACHE_TTL_MS,
    };

    return result;
}
