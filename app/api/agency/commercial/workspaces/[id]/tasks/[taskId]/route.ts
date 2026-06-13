import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { updateWorkspaceTaskHandler } from "@/lib/agency/commercial/workspaces";

export const runtime = "nodejs";

async function PATCHHandler(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; taskId: string }> },
) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "closer",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const orgId = access.auth?.organizationId;
    if (!orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id, taskId } = await params;
    const { status } = await request.json();
    return updateWorkspaceTaskHandler(orgId, id, taskId, status);
}

export const PATCH = withApiLogging("/api/agency/commercial/workspaces/[id]/tasks/[taskId]", "PATCH", PATCHHandler);
