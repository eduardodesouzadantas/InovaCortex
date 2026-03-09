import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { patchLeadHandler } from "@/lib/agency/commercial/leads";

export async function PATCH(
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

    const { id } = await params;
    return patchLeadHandler(request, id);
}
