import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
    applyLegacyAdminApiDeprecationHeaders,
    createLegacyAdminFinalRedirectResponse,
    createLegacyAdminWriteFrozenResponse,
} from "@/lib/auth/admin-api-guard";
import { updateWorkspaceTaskHandler } from "@/lib/agency/commercial/workspaces";

export const runtime = "nodejs";

/**
 * PATCH /api/admin/workspaces/[id]/tasks/[taskId]
 * Update a task's status (admin only).
 */
async function PATCHHandler(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; taskId: string }> },
) {
    const { id: workspaceId, taskId } = await params;
    const redirectResponse = createLegacyAdminFinalRedirectResponse(request, {
        successorPath: `/api/agency/commercial/workspaces/${workspaceId}/tasks/${taskId}`,
    });
    if (redirectResponse) return redirectResponse;

    const session = await getSession();
    if (!session || !["owner", "admin", "closer"].includes(session.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const frozen = createLegacyAdminWriteFrozenResponse({
        successorPath: `/api/agency/commercial/workspaces/${workspaceId}/tasks/${taskId}`,
    });
    if (frozen) return frozen;

    const { status } = await request.json();
    const response = await updateWorkspaceTaskHandler(session.orgId, workspaceId, taskId, status);
    return applyLegacyAdminApiDeprecationHeaders(response, {
        successorPath: `/api/agency/commercial/workspaces/${workspaceId}/tasks/${taskId}`,
    });
}

export const PATCH = withApiLogging("/api/admin/workspaces/[id]/tasks/[taskId]", "PATCH", PATCHHandler);
