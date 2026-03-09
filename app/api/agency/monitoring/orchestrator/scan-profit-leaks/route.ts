import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { resolveTargetOrgId } from "@/lib/agency/target-org";
import { scanOrgProfitLeaks } from "@/lib/agency/monitoring/orchestrator-handlers";

export async function POST(request: NextRequest) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!access.auth?.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json().catch(() => ({} as { orgId?: string }));

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

    try {
        const result = await scanOrgProfitLeaks(orgId);
        return NextResponse.json(result);
    } catch {
        return NextResponse.json({ error: "Scan failed" }, { status: 500 });
    }
}
