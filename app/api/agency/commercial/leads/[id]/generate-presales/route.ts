import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { generatePresalesHandler, listPresalesHandler } from "@/lib/agency/commercial/leads";

export const runtime = "nodejs";
export const maxDuration = 60;

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

    const { id } = await params;
    return generatePresalesHandler(id);
}

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
    return listPresalesHandler(id);
}

export const POST = withApiLogging("/api/agency/commercial/leads/[id]/generate-presales", "POST", POSTHandler);
export const GET = withApiLogging("/api/agency/commercial/leads/[id]/generate-presales", "GET", GETHandler);
