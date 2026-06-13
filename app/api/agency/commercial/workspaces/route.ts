import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess, type AdminApiGuardSuccess } from "@/lib/auth/admin-api-guard";
import { listWorkspacesHandler, runWorkspaceNudgeHandler } from "@/lib/agency/commercial/workspaces";

export const runtime = "nodejs";

function requireOrgId(access: AdminApiGuardSuccess): string | null {
    return access.auth?.organizationId ?? null;
}

async function GETHandler(request: NextRequest) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "viewer",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const orgId = requireOrgId(access);
    if (!orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return listWorkspacesHandler(orgId);
}

async function POSTHandler(request: NextRequest) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const orgId = requireOrgId(access);
    if (!orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return runWorkspaceNudgeHandler(orgId, access.auth?.userId ?? undefined);
}

export const GET = withApiLogging("/api/agency/commercial/workspaces", "GET", GETHandler);
export const POST = withApiLogging("/api/agency/commercial/workspaces", "POST", POSTHandler);
