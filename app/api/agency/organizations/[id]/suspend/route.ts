import { NextRequest, NextResponse } from "next/server";

import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { withApiLogging } from "@/lib/logger";
import { updateOrganizationOperationalStatus } from "@/lib/repositories/organizationRepository";

export const runtime = "nodejs";

async function POSTHandler(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const auth = access.auth;
    if (!auth?.organizationId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const result = await updateOrganizationOperationalStatus({
        organizationId: id,
        nextSubscriptionStatus: "suspended",
        actorUserId: auth.userId ?? "unknown",
        actorRole: auth.role ?? "unknown",
        source: "agency_surface",
    });

    if (!result) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const url = new URL(`/agency/organizations/${id}`, request.url);
    return NextResponse.redirect(url, 303);
}

export const POST = withApiLogging("/api/agency/organizations/[id]/suspend", "POST", POSTHandler);
