import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { goLiveWorkspaceHandler } from "@/lib/agency/commercial/workspaces";

export const runtime = "nodejs";

async function POSTHandler(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const orgId = access.auth?.organizationId;
    if (!orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    return goLiveWorkspaceHandler(orgId, id);
}

export const POST = withApiLogging("/api/agency/commercial/workspaces/[id]/golive", "POST", POSTHandler);
