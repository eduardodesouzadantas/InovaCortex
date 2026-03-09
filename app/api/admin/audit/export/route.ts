import { NextRequest, NextResponse } from "next/server";
import {
    applyLegacyAdminApiDeprecationHeaders,
    createLegacyAdminFinalRedirectResponse,
    requireAdminApiAccess,
} from "@/lib/auth/admin-api-guard";
import { resolveTargetOrgId } from "@/lib/agency/target-org";
import { buildAuditCsv } from "@/lib/agency/audit/export-handler";

export const runtime = "nodejs";

function withDeprecation(response: NextResponse, mode: "session" | "legacy_admin_token") {
    return applyLegacyAdminApiDeprecationHeaders(response, {
        successorPath: "/api/agency/audit/export",
        mode,
    });
}

export async function GET(request: NextRequest) {
    const redirectResponse = createLegacyAdminFinalRedirectResponse(request, {
        successorPath: "/api/agency/audit/export",
    });
    if (redirectResponse) return redirectResponse;

    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!access.auth?.organizationId) {
        return withDeprecation(NextResponse.json({ error: "Forbidden" }, { status: 403 }), access.mode);
    }

    let orgId: string;
    try {
        orgId = await resolveTargetOrgId({
            requestUrl: request.url,
            defaultOrgId: access.auth.organizationId,
        });
    } catch {
        return withDeprecation(NextResponse.json({ error: "Organization not found" }, { status: 404 }), access.mode);
    }

    const searchParams = new URL(request.url).searchParams;
    const { csv, filename } = await buildAuditCsv({
        orgId,
        type: searchParams.get("type") ?? undefined,
        from: searchParams.get("from") ?? undefined,
        to: searchParams.get("to") ?? undefined,
    });

    return withDeprecation(new NextResponse(csv, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
        },
    }), access.mode);
}
