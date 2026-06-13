import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { resolveTargetOrgId } from "@/lib/agency/target-org";
import { buildExecutiveIntelligence } from "@/lib/agency/executive/intelligence-handler";

async function GETHandler(request: NextRequest) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!access.auth?.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    let orgId: string;
    try {
        orgId = await resolveTargetOrgId({
            requestUrl: request.url,
            defaultOrgId: access.auth.organizationId,
        });
    } catch {
        return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    try {
        const result = await buildExecutiveIntelligence(orgId);
        return NextResponse.json(result);
    } catch {
        return NextResponse.json({ error: "Consolidated intelligence failed" }, { status: 500 });
    }
}

export const GET = withApiLogging("/api/agency/executive/intelligence", "GET", GETHandler);
