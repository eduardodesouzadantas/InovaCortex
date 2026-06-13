import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import {
    applyLegacyAdminApiDeprecationHeaders,
    createLegacyAdminFinalRedirectResponse,
    createLegacyAdminWriteFrozenResponse,
    requireAdminApiAccess,
} from "@/lib/auth/admin-api-guard";
import { runOrchestratorQueue } from "@/lib/agency/monitoring/orchestrator-handlers";

function respond(mode: "session" | "legacy_admin_token", body: unknown, init?: ResponseInit) {
    return applyLegacyAdminApiDeprecationHeaders(NextResponse.json(body, init), {
        successorPath: "/api/agency/monitoring/orchestrator/run",
        mode,
    });
}

async function POSTHandler(request: NextRequest) {
    const redirectResponse = createLegacyAdminFinalRedirectResponse(request, {
        successorPath: "/api/agency/monitoring/orchestrator/run",
    });
    if (redirectResponse) return redirectResponse;

    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!access.auth?.organizationId && access.mode === "session") {
        return respond(access.mode, { error: "Forbidden" }, { status: 403 });
    }

    const frozen = createLegacyAdminWriteFrozenResponse({
        successorPath: "/api/agency/monitoring/orchestrator/run",
        mode: access.mode,
    });
    if (frozen) return frozen;

    const orgId = access.auth?.organizationId;
    if (!orgId) return respond(access.mode, { error: "Organization context required" }, { status: 403 });

    const result = await runOrchestratorQueue(orgId);
    return respond(access.mode, result);
}

export const POST = withApiLogging("/api/admin/orchestrator/run", "POST", POSTHandler);
