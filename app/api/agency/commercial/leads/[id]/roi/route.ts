import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { getRoiHandler, updateRoiHandler } from "@/lib/agency/commercial/leads";

export const runtime = "nodejs";

async function GETHandler(
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
    return getRoiHandler(id);
}

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
    return updateRoiHandler(request, id);
}

export const GET = withApiLogging("/api/agency/commercial/leads/[id]/roi", "GET", GETHandler);
export const PATCH = withApiLogging("/api/agency/commercial/leads/[id]/roi", "PATCH", PATCHHandler);
