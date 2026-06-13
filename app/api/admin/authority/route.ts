import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import {
    applyLegacyAdminApiDeprecationHeaders,
} from "@/lib/auth/admin-api-guard";
import { guardLegacyAdminRequest } from "@/lib/api/legacy-admin-adapter";
import { listAuthorityAssetsHandler, runAuthorityActionHandler } from "@/lib/agency/authority/handlers";

export const runtime = "nodejs";

/**
 * Legacy adapter for /api/admin/authority -> /api/agency/authority
 */
async function POSTHandler(request: NextRequest) {
    const guarded = await guardLegacyAdminRequest(request, {
        successorPath: "/api/agency/authority",
        requiredRole: "admin",
        writeOperation: true,
    });
    if (!guarded.ok) return guarded.response;

    const body = await request.json();
    const response = await runAuthorityActionHandler(guarded.organizationId, guarded.userId, body);
    return applyLegacyAdminApiDeprecationHeaders(response, { successorPath: "/api/agency/authority" });
}

async function GETHandler(request: NextRequest) {
    const guarded = await guardLegacyAdminRequest(request, {
        successorPath: "/api/agency/authority",
        requiredRole: "viewer",
    });
    if (!guarded.ok) return guarded.response;

    const { searchParams } = new URL(request.url);
    const response = await listAuthorityAssetsHandler(guarded.organizationId, {
        type: searchParams.get("type"),
        status: searchParams.get("status"),
        page: Number(searchParams.get("page") ?? 1),
    });
    return applyLegacyAdminApiDeprecationHeaders(response, { successorPath: "/api/agency/authority" });
}

export const POST = withApiLogging("/api/admin/authority", "POST", POSTHandler);
export const GET = withApiLogging("/api/admin/authority", "GET", GETHandler);
