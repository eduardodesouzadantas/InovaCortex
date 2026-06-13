import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { profileRequest } from "@/lib/request-profiler";
import {
    generateContentHandler,
    listContentArtifactsHandler,
    updateContentArtifactStatusHandler,
} from "@/lib/agency/content/handlers";

export const runtime = "nodejs";

async function POSTHandler(request: NextRequest) {
    return profileRequest({ route: "/api/agency/content", method: "POST", targetMs: 500 }, async () => {
        const access = await requireAdminApiAccess(request, {
            requiredRole: "admin",
            allowLegacyTokenFallback: false,
        });
        if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
        if (!access.auth?.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const body = await request.json();
        return generateContentHandler(access.auth.organizationId, access.auth.userId, body);
    });
}

async function GETHandler(request: NextRequest) {
    return profileRequest({ route: "/api/agency/content", method: "GET", targetMs: 500 }, async () => {
        const access = await requireAdminApiAccess(request, {
            requiredRole: "viewer",
            allowLegacyTokenFallback: false,
        });
        if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
        if (!access.auth?.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const { searchParams } = new URL(request.url);
        return listContentArtifactsHandler(access.auth.organizationId, {
            type: searchParams.get("type"),
            status: searchParams.get("status"),
            page: Number(searchParams.get("page") ?? 1),
        });
    });
}

async function PATCHHandler(request: NextRequest) {
    return profileRequest({ route: "/api/agency/content", method: "PATCH", targetMs: 500 }, async () => {
        const access = await requireAdminApiAccess(request, {
            requiredRole: "admin",
            allowLegacyTokenFallback: false,
        });
        if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
        if (!access.auth?.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const body = await request.json();
        return updateContentArtifactStatusHandler(access.auth.organizationId, access.auth.userId, body);
    });
}

export const POST = withApiLogging("/api/agency/content", "POST", POSTHandler);
export const GET = withApiLogging("/api/agency/content", "GET", GETHandler);
export const PATCH = withApiLogging("/api/agency/content", "PATCH", PATCHHandler);
