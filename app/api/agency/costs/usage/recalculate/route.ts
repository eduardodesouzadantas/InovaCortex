import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { resolveTargetOrgId } from "@/lib/agency/target-org";
import { readUsageSnapshotOrLive, recalculateUsageSnapshot } from "@/lib/agency/costs/usage-handlers";

export const runtime = "nodejs";

async function POSTHandler(request: NextRequest) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!access.auth?.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const month = new URL(request.url).searchParams.get("month") ?? undefined;

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
        const result = await recalculateUsageSnapshot({ orgId, month });
        return NextResponse.json(result);
    } catch {
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}

async function GETHandler(request: NextRequest) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!access.auth?.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const month = new URL(request.url).searchParams.get("month") ?? undefined;

    let orgId: string;
    try {
        orgId = await resolveTargetOrgId({
            requestUrl: request.url,
            defaultOrgId: access.auth.organizationId,
        });
    } catch {
        return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const result = await readUsageSnapshotOrLive({ orgId, month });
    return NextResponse.json(result);
}

export const POST = withApiLogging("/api/agency/costs/usage/recalculate", "POST", POSTHandler);
export const GET = withApiLogging("/api/agency/costs/usage/recalculate", "GET", GETHandler);
