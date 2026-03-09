import { NextRequest, NextResponse } from "next/server";
import { getOrgContextFromSession } from "@/lib/auth/org-context";
import { getSessionFromRequest } from "@/lib/auth/session";
import { assertRole } from "@/lib/auth/rbac";
import {
    applyLegacyAdminApiDeprecationHeaders,
    createLegacyAdminFinalRedirectResponse,
    createLegacyAdminWriteFrozenResponse,
} from "@/lib/auth/admin-api-guard";
import { runWorkspaceNudgeHandler } from "@/lib/agency/commercial/workspaces";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    try {
        const redirectResponse = createLegacyAdminFinalRedirectResponse(req, {
            successorPath: "/api/agency/commercial/workspaces/nudge",
        });
        if (redirectResponse) return redirectResponse;

        const session = await getSessionFromRequest(req);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const ctx = await getOrgContextFromSession(session);
        assertRole(ctx.role, "admin");

        const frozen = createLegacyAdminWriteFrozenResponse({
            successorPath: "/api/agency/commercial/workspaces/nudge",
        });
        if (frozen) return frozen;

        const response = await runWorkspaceNudgeHandler(ctx.orgId, ctx.userId);
        return applyLegacyAdminApiDeprecationHeaders(response, {
            successorPath: "/api/agency/commercial/workspaces/nudge",
        });
    } catch {
        return NextResponse.json({ error: "Falha na acao" }, { status: 500 });
    }
}
