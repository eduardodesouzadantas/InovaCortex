import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { getExecutivePack } from "@/lib/agency/executive-pack/handlers";

async function GETHandler(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    try {
        const { id } = await params;
        const result = await getExecutivePack(id);
        if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json(result);
    } catch {
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

export const GET = withApiLogging("/api/agency/executive-pack/[id]", "GET", GETHandler);
