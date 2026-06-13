import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { resolveTargetOrgId } from "@/lib/agency/target-org";
import { planOrchestratorActions } from "@/lib/agency/monitoring/orchestrator-handlers";

async function POSTHandler(request: NextRequest) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!access.auth?.organizationId || !access.auth.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json().catch(() => ({} as { previewOnly?: boolean; orgId?: string }));

    let orgId: string;
    try {
        orgId = await resolveTargetOrgId({
            requestUrl: request.url,
            defaultOrgId: access.auth.organizationId,
            bodyOrgId: body.orgId,
        });
    } catch {
        return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const result = await planOrchestratorActions({
        orgId,
        userId: access.auth.userId,
        previewOnly: Boolean(body.previewOnly),
    });

    return NextResponse.json(result);
}

export const POST = withApiLogging("/api/agency/monitoring/orchestrator/plan", "POST", POSTHandler);
