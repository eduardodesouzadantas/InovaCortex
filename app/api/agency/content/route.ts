import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import {
    generateContentHandler,
    listContentArtifactsHandler,
    updateContentArtifactStatusHandler,
} from "@/lib/agency/content/handlers";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!access.auth?.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    return generateContentHandler(access.auth.organizationId, access.auth.userId, body);
}

export async function GET(request: NextRequest) {
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
}

export async function PATCH(request: NextRequest) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!access.auth?.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    return updateContentArtifactStatusHandler(access.auth.organizationId, access.auth.userId, body);
}
