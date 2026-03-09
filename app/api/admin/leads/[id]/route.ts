import { NextRequest, NextResponse } from "next/server";
import {
    applyLegacyAdminApiDeprecationHeaders,
    createLegacyAdminFinalRedirectResponse,
    createLegacyAdminWriteFrozenResponse,
    requireAdminApiAccess,
} from "@/lib/auth/admin-api-guard";
import { patchLeadHandler } from "@/lib/agency/commercial/leads";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const redirectResponse = createLegacyAdminFinalRedirectResponse(request, {
        successorPath: `/api/agency/commercial/leads/${id}`,
    });
    if (redirectResponse) return redirectResponse;

    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: true,
    });
    if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
    }
    const frozen = createLegacyAdminWriteFrozenResponse({
        successorPath: `/api/agency/commercial/leads/${id}`,
        mode: access.mode,
    });
    if (frozen) return frozen;

    const response = await patchLeadHandler(request, id);
    return applyLegacyAdminApiDeprecationHeaders(response, {
        successorPath: `/api/agency/commercial/leads/${id}`,
        mode: access.mode,
    });
}
