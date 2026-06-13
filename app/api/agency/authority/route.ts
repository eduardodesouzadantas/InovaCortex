import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { listAuthorityAssetsHandler, runAuthorityActionHandler } from "@/lib/agency/authority/handlers";

export const runtime = "nodejs";

async function POSTHandler(request: NextRequest) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!access.auth?.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    return runAuthorityActionHandler(access.auth.organizationId, access.auth.userId, body);
}

async function GETHandler(request: NextRequest) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "viewer",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!access.auth?.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    return listAuthorityAssetsHandler(access.auth.organizationId, {
        type: searchParams.get("type"),
        status: searchParams.get("status"),
        page: Number(searchParams.get("page") ?? 1),
    });
}

export const POST = withApiLogging("/api/agency/authority", "POST", POSTHandler);
export const GET = withApiLogging("/api/agency/authority", "GET", GETHandler);
