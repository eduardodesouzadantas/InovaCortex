import { z } from "zod";

/**
 * Zod schema to enforce mandatory environment variables at runtime.
 */
const envSchema = z.object({
    DATABASE_URL: z.string().url("A DATABASE_URL PostgreSQL válida é obrigatória"),
    APP_ENCRYPTION_KEY: z.string().min(16, "A chave JWT deve ter no mínimo 16 caracteres"),
    META_APP_SECRET: z.string().min(5, "A secret do Meta Webhook é obrigatória"),
    META_WHATSAPP_TOKEN: z.string().min(5, "O token do WhatsApp API é obrigatório"),
    META_VERIFY_TOKEN: z.string().min(3, "O Verify Token do Meta é obrigatório para o Webhook"),
    NEXT_PUBLIC_BASE_URL: z.string().url("A URL pública base é mandatória"),
});

const validateEnv = () => {
    // Em build time de CI/CD (ex: Vercel build step), nem sempre temos acesso pleno as envs.
    // Bypass durante o next build para permitir a compilação do typescript.
    if (process.env.npm_lifecycle_event === "build" || process.env.NEXT_PHASE === "phase-production-build") {
        return process.env as any;
    }

    try {
        const parsed = envSchema.parse(process.env);
        return parsed;
    } catch (err) {
        if (err instanceof z.ZodError) {
            console.error("❌ ALERTA CRÍTICO: Variáveis de ambiente obrigatórias estão ausentes ou inválidas");
            err.issues.forEach((e) => {
                console.error(`  - ${e.path.join(".")}: ${e.message}`);
            });
            console.error("🔒 Abortando inicialização. Corrija as variáveis acima para fazer o deploy.");
            process.exit(1);
        }
        throw err;
    }
};

export const env = validateEnv();
