import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import {
    applyLegacyAdminApiDeprecationHeaders,
    createLegacyAdminFinalRedirectResponse,
    createLegacyAdminWriteFrozenResponse,
    requireAdminApiAccess,
} from "@/lib/auth/admin-api-guard";
import { resendBillingCheckoutHandler } from "@/lib/agency/commercial/billing";

export const runtime = "nodejs";

async function POSTHandler(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const redirectResponse = createLegacyAdminFinalRedirectResponse(req, {
        successorPath: `/api/agency/commercial/billing/${id}/resend`,
    });
    if (redirectResponse) return redirectResponse;

    const access = await requireAdminApiAccess(req, {
        requiredRole: "admin",
        allowLegacyTokenFallback: true,
    });
    if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
    }
    const frozen = createLegacyAdminWriteFrozenResponse({
        successorPath: `/api/agency/commercial/billing/${id}/resend`,
        mode: access.mode,
    });
    if (frozen) return frozen;

    const response = await resendBillingCheckoutHandler(id);
    return applyLegacyAdminApiDeprecationHeaders(response, {
        successorPath: `/api/agency/commercial/billing/${id}/resend`,
        mode: access.mode,
    });
}

export const POST = withApiLogging("/api/admin/billing/[id]/resend", "POST", POSTHandler);
