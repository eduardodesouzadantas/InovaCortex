import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import {
    applyLegacyAdminApiDeprecationHeaders,
} from "@/lib/auth/admin-api-guard";
import { guardLegacyAdminRequest } from "@/lib/api/legacy-admin-adapter";
import {
    generateContentHandler,
    listContentArtifactsHandler,
    updateContentArtifactStatusHandler,
} from "@/lib/agency/content/handlers";

export const runtime = "nodejs";

/**
 * Legacy adapter for /api/admin/content -> /api/agency/content
 */
async function POSTHandler(request: NextRequest) {
    const guarded = await guardLegacyAdminRequest(request, {
        successorPath: "/api/agency/content",
        requiredRole: "admin",
        writeOperation: true,
    });
    if (!guarded.ok) return guarded.response;

    const body = await request.json();
    const response = await generateContentHandler(guarded.organizationId, guarded.userId, body);
    return applyLegacyAdminApiDeprecationHeaders(response, { successorPath: "/api/agency/content" });
}

async function GETHandler(request: NextRequest) {
    const guarded = await guardLegacyAdminRequest(request, {
        successorPath: "/api/agency/content",
        requiredRole: "viewer",
    });
    if (!guarded.ok) return guarded.response;

    const { searchParams } = new URL(request.url);
    const response = await listContentArtifactsHandler(guarded.organizationId, {
        type: searchParams.get("type"),
        status: searchParams.get("status"),
        page: Number(searchParams.get("page") ?? 1),
    });
    return applyLegacyAdminApiDeprecationHeaders(response, { successorPath: "/api/agency/content" });
}

async function PATCHHandler(request: NextRequest) {
    const guarded = await guardLegacyAdminRequest(request, {
        successorPath: "/api/agency/content",
        requiredRole: "admin",
        writeOperation: true,
    });
    if (!guarded.ok) return guarded.response;

    const body = await request.json();
    const response = await updateContentArtifactStatusHandler(guarded.organizationId, guarded.userId, body);
    return applyLegacyAdminApiDeprecationHeaders(response, { successorPath: "/api/agency/content" });
}

export const POST = withApiLogging("/api/admin/content", "POST", POSTHandler);
export const GET = withApiLogging("/api/admin/content", "GET", GETHandler);
export const PATCH = withApiLogging("/api/admin/content", "PATCH", PATCHHandler);
