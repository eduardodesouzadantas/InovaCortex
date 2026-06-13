import { apiSuccess } from "@/lib/http/api-response";
import { logger } from "@/lib/logger";
import { withApiLogging } from "@/lib/logger";
import { profileRequest } from "@/lib/request-profiler";
import { getSystemEnginesStatus } from "@/lib/system/engines";
import { requireAdminSessionFromRequest } from "@/lib/auth/admin-session";
import { authErrorResponse } from "@/lib/auth/auth-api-response";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function GETHandler(request: NextRequest) {
    return profileRequest({ route: "/api/system/engines", method: "GET", targetMs: 500 }, async () => {
        try {
            await requireAdminSessionFromRequest(request);
        } catch (error) {
            return authErrorResponse(error);
        }

        const engines = await getSystemEnginesStatus();
        const hasError = Object.values(engines).includes("error");

        if (hasError) {
            logger.warn("[SystemEngines] error", engines);
        } else {
            logger.info("[SystemEngines] ok", engines);
        }

        return apiSuccess(request, engines, {
            status: 200,
            headers: {
                "Cache-Control": "no-store",
                "x-engine-status": hasError ? "error" : "ok",
            },
        });
    });
}

export const GET = withApiLogging("/api/system/engines", "GET", GETHandler);
