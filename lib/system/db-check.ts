import { Prisma } from "@prisma/client";

import { ensurePrismaConnection, markPrismaDisconnected, prisma } from "@/lib/prisma";

type DatabaseStatus = "connected" | "disconnected";
type DatabaseUrlMode = "pooled" | "direct" | "unknown" | "missing";

export type DatabaseConfigDiagnostics = {
    databaseUrl: {
        configured: boolean;
        mode: DatabaseUrlMode;
        port: string | null;
    };
    directUrl: {
        configured: boolean;
        mode: DatabaseUrlMode;
        port: string | null;
    };
    warnings: string[];
};

export type DatabaseConnectionResult = {
    ok: boolean;
    status: DatabaseStatus;
    error: "DATABASE_UNAVAILABLE" | null;
    code: "SERVICE_UNAVAILABLE" | null;
    details?: {
        message: string;
        prismaCode?: string;
    };
    configuration: DatabaseConfigDiagnostics;
};

const PRISMA_CONNECTION_ERROR_CODES = new Set(["P1000", "P1001", "P1002", "P1008", "P1011", "P1017"]);

function hasValue(value: string | undefined): boolean {
    return Boolean(value?.trim());
}

function readDatabaseEnv(name: "DATABASE_URL" | "DIRECT_URL"): string | undefined {
    const value = process.env[name];
    if (typeof value !== "string") {
        return undefined;
    }

    const sanitized = value.trim();
    if (sanitized !== value) {
        process.env[name] = sanitized;
    }

    return sanitized;
}

function extractErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error ?? "Unknown database error");
}

function extractPrismaCode(error: unknown): string | undefined {
    if (!error || typeof error !== "object" || !("code" in error)) {
        return undefined;
    }

    const code = (error as { code?: unknown }).code;
    return typeof code === "string" && code.trim() ? code : undefined;
}

function inspectDatabaseUrl(urlValue: string | undefined) {
    if (!hasValue(urlValue)) {
        return {
            configured: false,
            mode: "missing" as DatabaseUrlMode,
            port: null,
            pgbouncerEnabled: false,
            connectionLimit: null as string | null,
        };
    }

    try {
        const parsed = new URL(urlValue!);
        const pgbouncerEnabled = parsed.searchParams.get("pgbouncer") === "true";
        const connectionLimit = parsed.searchParams.get("connection_limit");

        let mode: DatabaseUrlMode = "unknown";
        if (parsed.port === "6543" || pgbouncerEnabled) {
            mode = "pooled";
        } else if (parsed.port === "5432") {
            mode = "direct";
        }

        return {
            configured: true,
            mode,
            port: parsed.port || null,
            pgbouncerEnabled,
            connectionLimit,
        };
    } catch {
        return {
            configured: true,
            mode: "unknown" as DatabaseUrlMode,
            port: null,
            pgbouncerEnabled: false,
            connectionLimit: null as string | null,
        };
    }
}

export function inspectDatabaseConfiguration(): DatabaseConfigDiagnostics {
    const databaseUrl = inspectDatabaseUrl(readDatabaseEnv("DATABASE_URL"));
    const directUrl = inspectDatabaseUrl(readDatabaseEnv("DIRECT_URL"));
    const warnings: string[] = [];

    if (!databaseUrl.configured) {
        warnings.push("DATABASE_URL is missing.");
    } else {
        if (databaseUrl.port !== "6543") {
            warnings.push("DATABASE_URL should use the Supabase pooled port 6543.");
        }
        if (databaseUrl.mode !== "pooled") {
            warnings.push("DATABASE_URL should point to the pooled connection and include pgbouncer=true.");
        }
        if (!databaseUrl.pgbouncerEnabled) {
            warnings.push("DATABASE_URL should include pgbouncer=true.");
        }
        if (databaseUrl.connectionLimit !== "1") {
            warnings.push("DATABASE_URL should include connection_limit=1 for serverless Prisma.");
        }
    }

    if (!directUrl.configured) {
        warnings.push("DIRECT_URL is missing.");
    } else {
        if (directUrl.port !== "5432") {
            warnings.push("DIRECT_URL should use the direct Postgres port 5432.");
        }
        if (directUrl.mode !== "direct") {
            warnings.push("DIRECT_URL should point to the direct database connection.");
        }
    }

    return {
        databaseUrl: {
            configured: databaseUrl.configured,
            mode: databaseUrl.mode,
            port: databaseUrl.port,
        },
        directUrl: {
            configured: directUrl.configured,
            mode: directUrl.mode,
            port: directUrl.port,
        },
        warnings,
    };
}

export function isDatabaseUnavailableError(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientInitializationError) {
        return true;
    }

    const code = extractPrismaCode(error);
    if (code && PRISMA_CONNECTION_ERROR_CODES.has(code)) {
        return true;
    }

    const message = extractErrorMessage(error).toLowerCase();
    return [
        "can't reach database server",
        "database server",
        "error opening a tls connection",
        "tls connection",
        "server has closed the connection",
        "connection pool",
        "connection error",
        "connection refused",
        "connection terminated",
        "timeout",
        "pgbouncer",
        "certificate",
    ].some((needle) => message.includes(needle));
}

export async function verifyDatabaseConnection(): Promise<DatabaseConnectionResult> {
    const configuration = inspectDatabaseConfiguration();

    try {
        await ensurePrismaConnection();
        await prisma.$queryRaw`SELECT 1`;

        return {
            ok: true,
            status: "connected",
            error: null,
            code: null,
            configuration,
        };
    } catch (error) {
        markPrismaDisconnected();

        return {
            ok: false,
            status: "disconnected",
            error: "DATABASE_UNAVAILABLE",
            code: "SERVICE_UNAVAILABLE",
            details: {
                message: extractErrorMessage(error),
                ...(extractPrismaCode(error) ? { prismaCode: extractPrismaCode(error) } : {}),
            },
            configuration,
        };
    }
}
