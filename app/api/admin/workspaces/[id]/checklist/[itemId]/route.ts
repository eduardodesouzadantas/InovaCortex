import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
    applyLegacyAdminApiDeprecationHeaders,
    createLegacyAdminFinalRedirectResponse,
    createLegacyAdminWriteFrozenResponse,
} from "@/lib/auth/admin-api-guard";
import { updateWorkspaceChecklistHandler } from "@/lib/agency/commercial/workspaces";

export const runtime = "nodejs";

/** PATCH /api/admin/workspaces/[id]/checklist/[itemId] */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; itemId: string }> },
) {
    const { id: workspaceId, itemId } = await params;
    const redirectResponse = createLegacyAdminFinalRedirectResponse(request, {
        successorPath: `/api/agency/commercial/workspaces/${workspaceId}/checklist/${itemId}`,
    });
    if (redirectResponse) return redirectResponse;

    const session = await getSession();
    if (!session || !["owner", "admin"].includes(session.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const frozen = createLegacyAdminWriteFrozenResponse({
        successorPath: `/api/agency/commercial/workspaces/${workspaceId}/checklist/${itemId}`,
    });
    if (frozen) return frozen;

    const { status, notes } = await request.json();
    const response = await updateWorkspaceChecklistHandler(session.orgId, workspaceId, itemId, status, notes);
    return applyLegacyAdminApiDeprecationHeaders(response, {
        successorPath: `/api/agency/commercial/workspaces/${workspaceId}/checklist/${itemId}`,
    });
}
