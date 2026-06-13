import { apiSuccess } from "@/lib/http/api-response";
import { logger, withApiLogging } from "@/lib/logger";
import { profileRequest } from "@/lib/request-profiler";
import { getSystemHealthStatus } from "@/lib/system/health";
import { requireAdminSessionFromRequest } from "@/lib/auth/admin-session";
import { authErrorResponse } from "@/lib/auth/auth-api-response";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function GETHandler(request: NextRequest) {
    return profileRequest({ route: "/api/system/health", method: "GET", targetMs: 500 }, async () => {
        try {
            await requireAdminSessionFromRequest(request);
        } catch (error) {
            return authErrorResponse(error);
        }

        const health = await getSystemHealthStatus();

        if (health.status === "ok") {
            logger.info("[SystemHealth] ok", health);
        } else {
            logger.warn("[SystemHealth] degraded", health);
        }

        return apiSuccess(request, health, {
            status: 200,
            headers: {
                "Cache-Control": "no-store",
                "x-health-status": health.status,
            },
        });
    });
}

export const GET = withApiLogging("/api/system/health", "GET", GETHandler);
