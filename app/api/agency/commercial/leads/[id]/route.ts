import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { patchLeadHandler } from "@/lib/agency/commercial/leads";

async function PATCHHandler(
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

export const PATCH = withApiLogging("/api/agency/commercial/leads/[id]", "PATCH", PATCHHandler);
