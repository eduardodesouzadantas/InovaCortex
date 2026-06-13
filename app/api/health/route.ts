import { apiSuccess, resolveRequestId } from "@/lib/http/api-response";
import { logger } from "@/lib/logger";
import { recordRequestMetric } from "@/lib/observability/metrics";
import { runWithRequestContext } from "@/lib/observability/request-context";
import { getOperationalHealthReport } from "@/lib/system/operational-health";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function GETHandler(request: NextRequest) {
    try {
        if (!process.env.APP_ENCRYPTION_KEY) {
            return new Response("Config Error: APP_ENCRYPTION_KEY_MISSING", { status: 500 });
        }

        const requestId = resolveRequestId(request);
        const startedAt = Date.now();

        return runWithRequestContext({
            requestId,
            route: "/api/health",
            method: "GET",
            operation: "/api/health:GET",
        }, async () => {
            try {
                const health = await getOperationalHealthReport();
                const statusCode = health.status === "down" ? 503 : 200;

                return apiSuccess(request, health, {
                    status: statusCode,
                    requestId,
                    headers: {
                        "Cache-Control": "no-store",
                        "x-health-status": health.status,
                    },
                });
            } catch (innerError) {
                console.error("[Health] Inner Error", innerError);
                return new Response("Inner Error: " + (innerError instanceof Error ? innerError.message : String(innerError)), { status: 500 });
            }
        });
    } catch (outerError) {
        console.error("[Health] Outer Error", outerError);
        return new Response("Outer Error: " + (outerError instanceof Error ? outerError.message : String(outerError)), { status: 500 });
    }
}

export const GET = GETHandler;
