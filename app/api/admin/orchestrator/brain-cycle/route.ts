import { NextRequest, NextResponse } from "next/server";
import {
    applyLegacyAdminApiDeprecationHeaders,
    createLegacyAdminFinalRedirectResponse,
    createLegacyAdminWriteFrozenResponse,
    requireAdminApiAccess,
} from "@/lib/auth/admin-api-guard";
import { resolveTargetOrgId } from "@/lib/agency/target-org";
import { runAgencyBrainCycle } from "@/lib/agency/monitoring/orchestrator-handlers";

function respond(mode: "session" | "legacy_admin_token", body: unknown, init?: ResponseInit) {
    return applyLegacyAdminApiDeprecationHeaders(NextResponse.json(body, init), {
        successorPath: "/api/agency/monitoring/orchestrator/brain-cycle",
        mode,
    });
}

export async function POST(request: NextRequest) {
    const redirectResponse = createLegacyAdminFinalRedirectResponse(request, {
        successorPath: "/api/agency/monitoring/orchestrator/brain-cycle",
    });
    if (redirectResponse) return redirectResponse;

    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!access.auth?.organizationId) return respond(access.mode, { error: "Forbidden" }, { status: 403 });

    const frozen = createLegacyAdminWriteFrozenResponse({
        successorPath: "/api/agency/monitoring/orchestrator/brain-cycle",
        mode: access.mode,
    });
    if (frozen) return frozen;

    let orgId: string;
    try {
        orgId = await resolveTargetOrgId({
            requestUrl: request.url,
            defaultOrgId: access.auth.organizationId,
        });
    } catch {
        return respond(access.mode, { error: "Organization not found" }, { status: 404 });
    }

    const result = await runAgencyBrainCycle(orgId);
    return respond(access.mode, result);
}
