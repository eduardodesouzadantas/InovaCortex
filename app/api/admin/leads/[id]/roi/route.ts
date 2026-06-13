import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import {
    applyLegacyAdminApiDeprecationHeaders,
    createLegacyAdminFinalRedirectResponse,
    createLegacyAdminWriteFrozenResponse,
    requireAdminApiAccess,
} from "@/lib/auth/admin-api-guard";
import { getRoiHandler, updateRoiHandler } from "@/lib/agency/commercial/leads";

export const runtime = "nodejs";

/**
 * GET /api/admin/leads/[id]/roi
 * Returns ROI projection for a lead.
 */
async function GETHandler(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const redirectResponse = createLegacyAdminFinalRedirectResponse(req, {
        successorPath: `/api/agency/commercial/leads/${id}/roi`,
    });
    if (redirectResponse) return redirectResponse;

    const access = await requireAdminApiAccess(req, {
        requiredRole: "admin",
        allowLegacyTokenFallback: true,
    });
    if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
    }
    const response = await getRoiHandler(id);
    return applyLegacyAdminApiDeprecationHeaders(response, {
        successorPath: `/api/agency/commercial/leads/${id}/roi`,
        mode: access.mode,
    });
}

/**
 * PATCH /api/admin/leads/[id]/roi
 * Simulate adjusted ROI with custom parameters and save as manualOverride.
 * Body: { avgHourlyCost?, avgTicket?, conversionRate? }
 */
async function PATCHHandler(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id: assessmentId } = await params;
    const redirectResponse = createLegacyAdminFinalRedirectResponse(request, {
        successorPath: `/api/agency/commercial/leads/${assessmentId}/roi`,
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
        successorPath: `/api/agency/commercial/leads/${assessmentId}/roi`,
        mode: access.mode,
    });
    if (frozen) return frozen;

    const response = await updateRoiHandler(request, assessmentId);
    return applyLegacyAdminApiDeprecationHeaders(response, {
        successorPath: `/api/agency/commercial/leads/${assessmentId}/roi`,
        mode: access.mode,
    });
}

export const GET = withApiLogging("/api/admin/leads/[id]/roi", "GET", GETHandler);
export const PATCH = withApiLogging("/api/admin/leads/[id]/roi", "PATCH", PATCHHandler);
