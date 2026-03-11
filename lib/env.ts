import { z } from "zod";
import { config } from "dotenv";
import path from "path";

// Load .env explicitly for local development/scripts if not already loaded
config({ path: path.resolve(process.cwd(), ".env") });

/**
 * Zod schema for environment validation.
 * Runtime must never terminate because of missing env vars; warnings only.
 */
const envSchema = z.object({
    DATABASE_URL: z.string().url("A valid PostgreSQL DATABASE_URL is required"),
    APP_ENCRYPTION_KEY: z.string().min(16, "APP_ENCRYPTION_KEY must have at least 16 characters"),
    META_APP_SECRET: z.string().min(5, "META_APP_SECRET is required"),
    META_WHATSAPP_TOKEN: z.string().min(5, "META_WHATSAPP_TOKEN is required"),
    META_VERIFY_TOKEN: z.string().min(3, "META_VERIFY_TOKEN is required"),
    NEXT_PUBLIC_BASE_URL: z.string().url("NEXT_PUBLIC_BASE_URL is required"),
});

const validateEnv = () => {
    // During build in CI/CD (for example Vercel build step), environment can be partial.
    if (process.env.npm_lifecycle_event === "build" || process.env.NEXT_PHASE === "phase-production-build") {
        return process.env as any;
    }

    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
        console.warn("[ENV WARNING] Required environment variables are missing or invalid.");
        for (const issue of parsed.error.issues) {
            console.warn(`  - ${issue.path.join(".")}: ${issue.message}`);
        }
        // Never terminate runtime because of env mismatch; run in degraded mode.
        return process.env as any;
    }
    return parsed.data;
};

export const env = validateEnv();
