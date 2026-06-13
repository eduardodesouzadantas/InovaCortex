import { z } from "zod";

const coreEnvSchema = z.object({
    DATABASE_URL: z.string().url("A valid PostgreSQL DATABASE_URL is required"),
    DIRECT_URL: z.string().url("A valid PostgreSQL DIRECT_URL is required"),
    APP_ENCRYPTION_KEY: z.string().min(16, "APP_ENCRYPTION_KEY must have at least 16 characters"),
    NEXT_PUBLIC_BASE_URL: z.string().url("NEXT_PUBLIC_BASE_URL is required"),
});

const metaIntegrationSchema = z.object({
    META_APP_SECRET: z.string().min(5, "META_APP_SECRET is required"),
    META_WHATSAPP_TOKEN: z.string().min(5, "META_WHATSAPP_TOKEN is required"),
    META_VERIFY_TOKEN: z.string().min(3, "META_VERIFY_TOKEN is required"),
    META_PHONE_NUMBER_ID: z.string().min(5, "META_PHONE_NUMBER_ID is required"),
});

function isTruthyFlag(value: string | undefined): boolean {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function hasNonEmptyEnv(name: string): boolean {
    const value = process.env[name];
    return typeof value === "string" && value.trim().length > 0;
}

function collectMetaEnvState() {
    const keys = ["META_APP_SECRET", "META_WHATSAPP_TOKEN", "META_VERIFY_TOKEN", "META_PHONE_NUMBER_ID"] as const;
    const configuredKeys = keys.filter((key) => hasNonEmptyEnv(key));
    return {
        keys,
        configuredKeys,
        isConfigured: configuredKeys.length === keys.length,
        isPartiallyConfigured: configuredKeys.length > 0 && configuredKeys.length < keys.length,
    };
}

export function isProductionEnv(): boolean {
    return process.env.NODE_ENV === "production";
}

export function isTestEnv(): boolean {
    return process.env.NODE_ENV === "test";
}

export function isDevelopmentEnv(): boolean {
    return !isProductionEnv() && !isTestEnv();
}

export function allowInsecureSessionFallback(): boolean {
    return (isDevelopmentEnv() || isTestEnv()) && isTruthyFlag(process.env.ALLOW_INSECURE_SESSION_FALLBACK);
}

export function allowStubEmbeddings(): boolean {
    if (isTestEnv()) return true;
    if (isDevelopmentEnv()) return true;
    return isTruthyFlag(process.env.ALLOW_STUB_EMBEDDINGS);
}

export function allowIntegrationStubs(): boolean {
    if (isTestEnv()) return true;
    if (isDevelopmentEnv()) return true;
    return isTruthyFlag(process.env.ALLOW_INTEGRATION_STUBS);
}

function shouldFailFastForCoreEnv(): boolean {
    return isProductionEnv() || process.env.NEXT_PHASE === "phase-production-build";
}

function validateCoreEnv() {
    const parsed = coreEnvSchema.safeParse(process.env);
    if (parsed.success) {
        return parsed.data;
    }

    console.warn("[ENV WARNING] Required core environment variables are missing or invalid.");
    for (const issue of parsed.error.issues) {
        console.warn(`  - ${issue.path.join(".")}: ${issue.message}`);
    }

    if (shouldFailFastForCoreEnv()) {
        throw new Error("Critical environment configuration is invalid for build/production.");
    }

    return process.env;
}

function validateMetaIntegrationConfig(): void {
    const metaState = collectMetaEnvState();
    if (!metaState.isPartiallyConfigured) {
        return;
    }

    const parsed = metaIntegrationSchema.safeParse(process.env);
    console.warn("[ENV WARNING] Meta integration is partially configured.");

    if (!parsed.success) {
        for (const issue of parsed.error.issues) {
            console.warn(`  - ${issue.path.join(".")}: ${issue.message}`);
        }
    }

    if (isProductionEnv()) {
        throw new Error("Meta integration must be fully configured or fully disabled in production.");
    }
}

export const env = validateCoreEnv();

validateMetaIntegrationConfig();
