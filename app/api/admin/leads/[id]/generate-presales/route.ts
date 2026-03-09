import { NextRequest, NextResponse } from "next/server";
import {
    applyLegacyAdminApiDeprecationHeaders,
    createLegacyAdminFinalRedirectResponse,
    createLegacyAdminWriteFrozenResponse,
    requireAdminApiAccess,
} from "@/lib/auth/admin-api-guard";
import { generatePresalesHandler, listPresalesHandler } from "@/lib/agency/commercial/leads";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const redirectResponse = createLegacyAdminFinalRedirectResponse(request, {
        successorPath: `/api/agency/commercial/leads/${id}/generate-presales`,
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
        successorPath: `/api/agency/commercial/leads/${id}/generate-presales`,
        mode: access.mode,
    });
    if (frozen) return frozen;

    const response = await generatePresalesHandler(id);
    return applyLegacyAdminApiDeprecationHeaders(response, {
        successorPath: `/api/agency/commercial/leads/${id}/generate-presales`,
        mode: access.mode,
    });
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const redirectResponse = createLegacyAdminFinalRedirectResponse(request, {
        successorPath: `/api/agency/commercial/leads/${id}/generate-presales`,
    });
    if (redirectResponse) return redirectResponse;

    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: true,
    });
    if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
    }
    const response = await listPresalesHandler(id);
    return applyLegacyAdminApiDeprecationHeaders(response, {
        successorPath: `/api/agency/commercial/leads/${id}/generate-presales`,
        mode: access.mode,
    });
}
