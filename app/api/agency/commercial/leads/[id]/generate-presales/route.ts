import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { generatePresalesHandler, listPresalesHandler } from "@/lib/agency/commercial/leads";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
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

export async function GET(
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
