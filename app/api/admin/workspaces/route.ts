import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertRole } from "@/lib/auth/rbac";
import {
    applyLegacyAdminApiDeprecationHeaders,
    createLegacyAdminFinalRedirectResponse,
    createLegacyAdminWriteFrozenResponse,
} from "@/lib/auth/admin-api-guard";
import { listWorkspacesHandler, runWorkspaceNudgeHandler } from "@/lib/agency/commercial/workspaces";

export const runtime = "nodejs";

/**
 * POST /api/admin/workspaces/nudge
 * Run stale-task and stale-provisioning checks for the current org.
 * admin+ only.
 */
export async function POST(request: NextRequest) {
    const redirectResponse = createLegacyAdminFinalRedirectResponse(request, {
        successorPath: "/api/agency/commercial/workspaces/nudge",
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
        successorPath: "/api/agency/commercial/workspaces/nudge",
    });
    if (frozen) return frozen;

    const response = await runWorkspaceNudgeHandler(session.orgId, session.userId);
    return applyLegacyAdminApiDeprecationHeaders(response, {
        successorPath: "/api/agency/commercial/workspaces/nudge",
    });
}

/**
 * GET /api/admin/workspaces
 * List all workspaces for the current org.
 */
export async function GET(request: NextRequest) {
    const redirectResponse = createLegacyAdminFinalRedirectResponse(request, {
        successorPath: "/api/agency/commercial/workspaces",
    });
    if (redirectResponse) return redirectResponse;

    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const response = await listWorkspacesHandler(session.orgId);
    return applyLegacyAdminApiDeprecationHeaders(response, {
        successorPath: "/api/agency/commercial/workspaces",
    });
}
