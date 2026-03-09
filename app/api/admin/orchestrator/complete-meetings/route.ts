import { NextRequest, NextResponse } from "next/server";
import {
    applyLegacyAdminApiDeprecationHeaders,
    createLegacyAdminFinalRedirectResponse,
    createLegacyAdminWriteFrozenResponse,
    requireAdminApiAccess,
} from "@/lib/auth/admin-api-guard";
import { resolveTargetOrgId } from "@/lib/agency/target-org";
import { completeStaleMeetings } from "@/lib/agency/monitoring/orchestrator-handlers";

function respond(mode: "session" | "legacy_admin_token", body: unknown, init?: ResponseInit) {
    return applyLegacyAdminApiDeprecationHeaders(NextResponse.json(body, init), {
        successorPath: "/api/agency/monitoring/orchestrator/complete-meetings",
        mode,
    });
}

export async function POST(request: NextRequest) {
    const redirectResponse = createLegacyAdminFinalRedirectResponse(request, {
        successorPath: "/api/agency/monitoring/orchestrator/complete-meetings",
    });
    if (redirectResponse) return redirectResponse;

    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!access.auth?.organizationId) return respond(access.mode, { error: "Forbidden" }, { status: 403 });

    const frozen = createLegacyAdminWriteFrozenResponse({
        successorPath: "/api/agency/monitoring/orchestrator/complete-meetings",
        mode: access.mode,
    });
    if (frozen) return frozen;

    const body = await request.json().catch(() => ({} as { orgId?: string }));

    let orgId: string;
    try {
        orgId = await resolveTargetOrgId({
            requestUrl: request.url,
            defaultOrgId: access.auth.organizationId,
            bodyOrgId: body.orgId,
        });
    } catch {
        return respond(access.mode, { error: "Organization not found" }, { status: 404 });
    }

    const result = await completeStaleMeetings(orgId);
    return respond(access.mode, result);
}
