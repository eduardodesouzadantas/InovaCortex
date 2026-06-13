import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import {
    legacyAdminJson,
    guardLegacyAdminRequest,
} from "@/lib/api/legacy-admin-adapter";
import { getExecutivePack } from "@/lib/agency/executive-pack/handlers";

async function GETHandler(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const guarded = await guardLegacyAdminRequest(request, {
        successorPath: `/api/agency/executive-pack/${id}`,
        requiredRole: "admin",
    });
    if (!guarded.ok) return guarded.response;

    try {
        const result = await getExecutivePack(id);
        if (!result) return legacyAdminJson(guarded.mode, "/api/agency/executive-pack/[id]", { error: "Not found" }, { status: 404 });
        return legacyAdminJson(guarded.mode, "/api/agency/executive-pack/[id]", result);
    } catch {
        return legacyAdminJson(guarded.mode, "/api/agency/executive-pack/[id]", { error: "Internal error" }, { status: 500 });
    }
}

export const GET = withApiLogging("/api/admin/executive-pack/[id]", "GET", GETHandler);
