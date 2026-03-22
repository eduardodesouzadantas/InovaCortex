import { NextRequest, NextResponse } from "next/server";

import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { logger, withApiLogging } from "@/lib/logger";
import { updateOrganizationUserActive } from "@/lib/repositories/organizationUserRepository";

export const runtime = "nodejs";

function buildDetailRedirect(request: NextRequest, organizationId: string, query: Record<string, string>): NextResponse {
    const url = new URL(`/agency/organizations/${organizationId}`, request.url);
    for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value);
    }
    return NextResponse.redirect(url, 303);
}

async function POSTHandler(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; userId: string }> },
) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const auth = access.auth;
    if (!auth?.organizationId || !auth.userId || !auth.role) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, userId } = await params;
    const result = await updateOrganizationUserActive({
        organizationId: id,
        userId,
        nextActive: false,
        actorUserId: auth.userId,
        actorRole: auth.role,
        source: "agency_surface",
    });

    if (!result.ok) {
        logger.warn("Agency organization user deactivation failed", {
            operation: "agencyOrganizationUsers.deactivate",
            organizationId: id,
            userId,
            actorUserId: auth.userId,
            actorRole: auth.role,
            reason: result.reason,
        });
        return buildDetailRedirect(request, id, { userError: result.reason });
    }

    return buildDetailRedirect(request, id, { userAction: "deactivated" });
}

export const POST = withApiLogging("/api/agency/organizations/[id]/users/[userId]/deactivate", "POST", POSTHandler);
