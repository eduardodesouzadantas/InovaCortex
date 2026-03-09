import { NextRequest, NextResponse } from "next/server";
import {
    applyLegacyAdminApiDeprecationHeaders,
    createLegacyAdminFinalRedirectResponse,
    requireAdminApiAccess,
} from "@/lib/auth/admin-api-guard";
import { getExecutivePack } from "@/lib/agency/executive-pack/handlers";

function respond(mode: "session" | "legacy_admin_token", body: unknown, init?: ResponseInit) {
    return applyLegacyAdminApiDeprecationHeaders(NextResponse.json(body, init), {
        successorPath: "/api/agency/executive-pack/[id]",
        mode,
    });
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const redirectResponse = createLegacyAdminFinalRedirectResponse(request, {
        successorPath: `/api/agency/executive-pack/${id}`,
    });
    if (redirectResponse) return redirectResponse;

    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

    try {
        const result = await getExecutivePack(id);
        if (!result) return respond(access.mode, { error: "Not found" }, { status: 404 });
        return respond(access.mode, result);
    } catch {
        return respond(access.mode, { error: "Internal error" }, { status: 500 });
    }
}
