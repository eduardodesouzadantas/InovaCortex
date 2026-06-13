import { Prisma, PrismaClient } from "@prisma/client";

import { recordPrismaQuery } from "@/lib/request-profiler";

function sanitizeDatabaseEnvVar(name: "DATABASE_URL" | "DIRECT_URL"): string | undefined {
    const rawValue = process.env[name];
    if (typeof rawValue !== "string") {
        return undefined;
    }

    const sanitized = rawValue.trim();
    if (sanitized !== rawValue) {
        process.env[name] = sanitized;
    }

    return sanitized;
}

sanitizeDatabaseEnvVar("DATABASE_URL");
sanitizeDatabaseEnvVar("DIRECT_URL");

const globalForPrisma = globalThis as typeof globalThis & {
    prisma?: PrismaClient;
    __prismaConnectPromise?: Promise<void>;
    __prismaConnected?: boolean;
    __prismaQueryListenerAttached?: boolean;
};

const prismaLogConfig: Prisma.PrismaClientOptions["log"] = [
    { emit: "event", level: "query" },
    { emit: "stdout", level: "error" },
    { emit: "stdout", level: "warn" },
];

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: prismaLogConfig,
    });

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

if (!globalForPrisma.__prismaQueryListenerAttached) {
    const prismaWithQueryEvents = prisma as PrismaClient & {
        $on(eventType: "query", callback: (event: Prisma.QueryEvent) => void): void;
    };

    prismaWithQueryEvents.$on("query", (event: Prisma.QueryEvent) => {
        recordPrismaQuery({
            duration: event.duration,
            query: event.query,
            target: typeof event.target === "string" ? event.target : undefined,
        });
    });
    globalForPrisma.__prismaQueryListenerAttached = true;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
    const value = Number(raw ?? "");
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function markPrismaDisconnected(): void {
    globalForPrisma.__prismaConnected = false;
    globalForPrisma.__prismaConnectPromise = undefined;
}

export async function ensurePrismaConnection(): Promise<void> {
    if (globalForPrisma.__prismaConnected) {
        return;
    }

    if (!globalForPrisma.__prismaConnectPromise) {
        const maxRetries = parsePositiveInt(process.env.PRISMA_CONNECT_RETRIES, 2);
        const baseDelayMs = parsePositiveInt(process.env.PRISMA_CONNECT_RETRY_DELAY_MS, 250);

        globalForPrisma.__prismaConnectPromise = (async () => {
            let attempt = 0;
            let lastError: unknown;

            while (attempt <= maxRetries) {
                try {
                    await prisma.$connect();
                    await prisma.$queryRaw`SELECT 1`;
                    globalForPrisma.__prismaConnected = true;
                    return;
                } catch (error) {
                    lastError = error;
                    markPrismaDisconnected();

                    if (attempt >= maxRetries) {
                        break;
                    }

                    const delayMs = Math.min(baseDelayMs * (attempt + 1), 1_500);
                    await sleep(delayMs);
                    attempt += 1;
                }
            }

            throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "Prisma connection failed"));
        })();
    }

    try {
        await globalForPrisma.__prismaConnectPromise;
    } catch (error) {
        markPrismaDisconnected();
        throw error;
    }
}
