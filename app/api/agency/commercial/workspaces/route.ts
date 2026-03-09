import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess, type AdminApiGuardSuccess } from "@/lib/auth/admin-api-guard";
import { listWorkspacesHandler, runWorkspaceNudgeHandler } from "@/lib/agency/commercial/workspaces";

export const runtime = "nodejs";

function requireOrgId(access: AdminApiGuardSuccess): string | null {
    return access.auth?.organizationId ?? null;
}

export async function GET(request: NextRequest) {
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

export async function POST(request: NextRequest) {
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
