import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import {
    applyLegacyAdminApiDeprecationHeaders,
    createLegacyAdminFinalRedirectResponse,
    createLegacyAdminWriteFrozenResponse,
    requireAdminApiAccess,
} from "@/lib/auth/admin-api-guard";
import { resolveTargetOrgId } from "@/lib/agency/target-org";
import { scanOrgProfitLeaks } from "@/lib/agency/monitoring/orchestrator-handlers";

function respond(mode: "session" | "legacy_admin_token", body: unknown, init?: ResponseInit) {
    return applyLegacyAdminApiDeprecationHeaders(NextResponse.json(body, init), {
        successorPath: "/api/agency/monitoring/orchestrator/scan-profit-leaks",
        mode,
    });
}

async function POSTHandler(request: NextRequest) {
    const redirectResponse = createLegacyAdminFinalRedirectResponse(request, {
        successorPath: "/api/agency/monitoring/orchestrator/scan-profit-leaks",
    });
    if (redirectResponse) return redirectResponse;

    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!access.auth?.organizationId) return respond(access.mode, { error: "Forbidden" }, { status: 403 });

    const frozen = createLegacyAdminWriteFrozenResponse({
        successorPath: "/api/agency/monitoring/orchestrator/scan-profit-leaks",
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

    try {
        const result = await scanOrgProfitLeaks(orgId);
        return respond(access.mode, result);
    } catch {
        return respond(access.mode, { error: "Scan failed" }, { status: 500 });
    }
}

export const POST = withApiLogging("/api/admin/orchestrator/scan-profit-leaks", "POST", POSTHandler);
