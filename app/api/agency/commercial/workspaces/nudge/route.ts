import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { runWorkspaceNudgeHandler } from "@/lib/agency/commercial/workspaces";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const orgId = access.auth?.organizationId;
    if (!orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return runWorkspaceNudgeHandler(orgId, access.auth?.userId ?? undefined);
}
