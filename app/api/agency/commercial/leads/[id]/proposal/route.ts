import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import {
    generateProposalHandler,
    listProposalsHandler,
    updateProposalHandler,
} from "@/lib/agency/commercial/leads";

export const runtime = "nodejs";

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
    return generateProposalHandler(id);
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
    return listProposalsHandler(id);
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
    return updateProposalHandler(request, id);
}

export const POST = withApiLogging("/api/agency/commercial/leads/[id]/proposal", "POST", POSTHandler);
export const GET = withApiLogging("/api/agency/commercial/leads/[id]/proposal", "GET", GETHandler);
export const PATCH = withApiLogging("/api/agency/commercial/leads/[id]/proposal", "PATCH", PATCHHandler);
