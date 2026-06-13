import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import {
    applyLegacyAdminApiDeprecationHeaders,
    createLegacyAdminFinalRedirectResponse,
    createLegacyAdminWriteFrozenResponse,
    requireAdminApiAccess,
} from "@/lib/auth/admin-api-guard";
import { resolveTargetOrgId } from "@/lib/agency/target-org";
import { readUsageSnapshotOrLive, recalculateUsageSnapshot } from "@/lib/agency/costs/usage-handlers";

export const runtime = "nodejs";

function respond(mode: "session" | "legacy_admin_token", body: unknown, init?: ResponseInit) {
    return applyLegacyAdminApiDeprecationHeaders(NextResponse.json(body, init), {
        successorPath: "/api/agency/costs/usage/recalculate",
        mode,
    });
}

async function POSTHandler(request: NextRequest) {
    const redirectResponse = createLegacyAdminFinalRedirectResponse(request, {
        successorPath: "/api/agency/costs/usage/recalculate",
    });
    if (redirectResponse) return redirectResponse;

    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!access.auth?.organizationId) return respond(access.mode, { error: "Forbidden" }, { status: 403 });

    const frozen = createLegacyAdminWriteFrozenResponse({
        successorPath: "/api/agency/costs/usage/recalculate",
        mode: access.mode,
    });
    if (frozen) return frozen;

    const month = new URL(request.url).searchParams.get("month") ?? undefined;

    let orgId: string;
    try {
        orgId = await resolveTargetOrgId({
            requestUrl: request.url,
            defaultOrgId: access.auth.organizationId,
        });
    } catch {
        return respond(access.mode, { error: "Organization not found" }, { status: 404 });
    }

    try {
        const result = await recalculateUsageSnapshot({ orgId, month });
        return respond(access.mode, result);
    } catch {
        return respond(access.mode, { error: "Failed" }, { status: 500 });
    }
}

async function GETHandler(request: NextRequest) {
    const redirectResponse = createLegacyAdminFinalRedirectResponse(request, {
        successorPath: "/api/agency/costs/usage/recalculate",
    });
    if (redirectResponse) return redirectResponse;

    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!access.auth?.organizationId) return respond(access.mode, { error: "Forbidden" }, { status: 403 });

    const month = new URL(request.url).searchParams.get("month") ?? undefined;

    let orgId: string;
    try {
        orgId = await resolveTargetOrgId({
            requestUrl: request.url,
            defaultOrgId: access.auth.organizationId,
        });
    } catch {
        return respond(access.mode, { error: "Organization not found" }, { status: 404 });
    }

    const result = await readUsageSnapshotOrLive({ orgId, month });
    return respond(access.mode, result);
}

export const POST = withApiLogging("/api/admin/usage/recalculate", "POST", POSTHandler);
export const GET = withApiLogging("/api/admin/usage/recalculate", "GET", GETHandler);
