import { logger } from "@/lib/logger";
import { verifyDatabaseConnection } from "@/lib/system/db-check";
import { getSystemEnginesStatus } from "@/lib/system/engines";
import { getSystemHealthStatus } from "@/lib/system/health";

let backendActivationPromise: Promise<void> | null = null;

export async function ensureBackendActivation(): Promise<void> {
    if (backendActivationPromise) {
        return backendActivationPromise;
    }

    backendActivationPromise = (async () => {
        try {
            const database = await verifyDatabaseConnection();
            if (!database.ok) {
                logger.warn("[BackendActivation] database degraded", {
                    status: database.status,
                    code: database.code,
                    error: database.error,
                    details: database.details,
                    configWarnings: database.configuration.warnings,
                });
            } else if (database.configuration.warnings.length > 0) {
                logger.warn("[BackendActivation] database configuration warnings", {
                    configWarnings: database.configuration.warnings,
                });
            }

            const [health, engines] = await Promise.all([
                getSystemHealthStatus(),
                getSystemEnginesStatus(),
            ]);

            logger.info("[BackendActivation] completed", {
                health,
                engines,
            });
        } catch (error) {
            logger.error("[BackendActivation] failed", {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    })();

    return backendActivationPromise;
}
