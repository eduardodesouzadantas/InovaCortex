import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertRole } from "@/lib/auth/rbac";
import {
    applyLegacyAdminApiDeprecationHeaders,
    createLegacyAdminFinalRedirectResponse,
    createLegacyAdminWriteFrozenResponse,
} from "@/lib/auth/admin-api-guard";
import { goLiveWorkspaceHandler } from "@/lib/agency/commercial/workspaces";

export const runtime = "nodejs";

/** POST /api/admin/workspaces/[id]/golive */
async function POSTHandler(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id: workspaceId } = await params;
    const redirectResponse = createLegacyAdminFinalRedirectResponse(_request, {
        successorPath: `/api/agency/commercial/workspaces/${workspaceId}/golive`,
    });
    if (redirectResponse) return redirectResponse;

    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        assertRole(session.role, "admin");
    } catch {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const frozen = createLegacyAdminWriteFrozenResponse({
        successorPath: `/api/agency/commercial/workspaces/${workspaceId}/golive`,
    });
    if (frozen) return frozen;

    const response = await goLiveWorkspaceHandler(session.orgId, workspaceId);
    return applyLegacyAdminApiDeprecationHeaders(response, {
        successorPath: `/api/agency/commercial/workspaces/${workspaceId}/golive`,
    });
}

export const POST = withApiLogging("/api/admin/workspaces/[id]/golive", "POST", POSTHandler);
