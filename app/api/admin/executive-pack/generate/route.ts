import { NextRequest, NextResponse } from "next/server";
import {
    applyLegacyAdminApiDeprecationHeaders,
    createLegacyAdminFinalRedirectResponse,
    createLegacyAdminWriteFrozenResponse,
    requireAdminApiAccess,
} from "@/lib/auth/admin-api-guard";
import { resolveTargetOrgId } from "@/lib/agency/target-org";
import { generateExecutivePack } from "@/lib/agency/executive-pack/handlers";

export const runtime = "nodejs";

function respond(mode: "session" | "legacy_admin_token", body: unknown, init?: ResponseInit) {
    return applyLegacyAdminApiDeprecationHeaders(NextResponse.json(body, init), {
        successorPath: "/api/agency/executive-pack/generate",
        mode,
    });
}

export async function POST(request: NextRequest) {
    const redirectResponse = createLegacyAdminFinalRedirectResponse(request, {
        successorPath: "/api/agency/executive-pack/generate",
    });
    if (redirectResponse) return redirectResponse;

    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!access.auth?.organizationId) return respond(access.mode, { error: "Forbidden" }, { status: 403 });

    const frozen = createLegacyAdminWriteFrozenResponse({
        successorPath: "/api/agency/executive-pack/generate",
        mode: access.mode,
    });
    if (frozen) return frozen;

    let body: { orgId?: string; anonymized?: boolean };
    try {
        body = await request.json();
    } catch {
        return respond(access.mode, { error: "Invalid JSON" }, { status: 400 });
    }

    let orgId: string;
    try {
        orgId = await resolveTargetOrgId({
            requestUrl: request.url,
            defaultOrgId: access.auth.organizationId,
            bodyOrgId: body.orgId,
        });
    } catch {
        return respond(access.mode, { error: "Organization not found" }, { status: 404 });
    }

    try {
        const result = await generateExecutivePack({ orgId, anonymized: Boolean(body.anonymized) });
        return respond(access.mode, result, { status: 201 });
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return respond(access.mode, { error: "Generation failed", detail }, { status: 500 });
    }
}
