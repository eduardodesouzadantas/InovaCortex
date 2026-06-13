import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { resolveTargetOrgId } from "@/lib/agency/target-org";
import { generateExecutivePack } from "@/lib/agency/executive-pack/handlers";

export const runtime = "nodejs";

async function POSTHandler(request: NextRequest) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!access.auth?.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    let body: { orgId?: string; anonymized?: boolean };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

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
        const result = await generateExecutivePack({ orgId, anonymized: Boolean(body.anonymized) });
        return NextResponse.json(result, { status: 201 });
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: "Generation failed", detail }, { status: 500 });
    }
}

export const POST = withApiLogging("/api/agency/executive-pack/generate", "POST", POSTHandler);
