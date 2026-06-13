import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { updateWorkspaceChecklistHandler } from "@/lib/agency/commercial/workspaces";

export const runtime = "nodejs";

async function PATCHHandler(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; itemId: string }> },
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

    const { id, itemId } = await params;
    const { status, notes } = await request.json();
    return updateWorkspaceChecklistHandler(orgId, id, itemId, status, notes);
}

export const PATCH = withApiLogging("/api/agency/commercial/workspaces/[id]/checklist/[itemId]", "PATCH", PATCHHandler);
