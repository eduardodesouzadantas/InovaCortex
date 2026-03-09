import { NextRequest, NextResponse } from "next/server";
import {
    applyLegacyAdminApiDeprecationHeaders,
    createLegacyAdminFinalRedirectResponse,
    createLegacyAdminWriteFrozenResponse,
    requireAdminApiAccess,
} from "@/lib/auth/admin-api-guard";
import {
    generateProposalHandler,
    listProposalsHandler,
    updateProposalHandler,
} from "@/lib/agency/commercial/leads";

export const runtime = "nodejs";

/**
 * POST /api/admin/leads/[id]/proposal
 * Generate (or regenerate) a proposal for a lead.
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id: assessmentId } = await params;
    const redirectResponse = createLegacyAdminFinalRedirectResponse(req, {
        successorPath: `/api/agency/commercial/leads/${assessmentId}/proposal`,
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
        successorPath: `/api/agency/commercial/leads/${assessmentId}/proposal`,
        mode: access.mode,
    });
    if (frozen) return frozen;

    const response = await generateProposalHandler(assessmentId);
    return applyLegacyAdminApiDeprecationHeaders(response, {
        successorPath: `/api/agency/commercial/leads/${assessmentId}/proposal`,
        mode: access.mode,
    });
}

/**
 * GET /api/admin/leads/[id]/proposal
 * Get all proposal versions for a lead.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id: assessmentId } = await params;
    const redirectResponse = createLegacyAdminFinalRedirectResponse(req, {
        successorPath: `/api/agency/commercial/leads/${assessmentId}/proposal`,
    });
    if (redirectResponse) return redirectResponse;

    const access = await requireAdminApiAccess(req, {
        requiredRole: "admin",
        allowLegacyTokenFallback: true,
    });
    if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
    }
    const response = await listProposalsHandler(assessmentId);
    return applyLegacyAdminApiDeprecationHeaders(response, {
        successorPath: `/api/agency/commercial/leads/${assessmentId}/proposal`,
        mode: access.mode,
    });
}

/**
 * PATCH /api/admin/leads/[id]/proposal
 * Update status or customNotes of the latest proposal.
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id: assessmentId } = await params;
    const redirectResponse = createLegacyAdminFinalRedirectResponse(request, {
        successorPath: `/api/agency/commercial/leads/${assessmentId}/proposal`,
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
        successorPath: `/api/agency/commercial/leads/${assessmentId}/proposal`,
        mode: access.mode,
    });
    if (frozen) return frozen;

    const response = await updateProposalHandler(request, assessmentId);
    return applyLegacyAdminApiDeprecationHeaders(response, {
        successorPath: `/api/agency/commercial/leads/${assessmentId}/proposal`,
        mode: access.mode,
    });
}
