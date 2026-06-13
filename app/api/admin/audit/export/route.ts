import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { legacyAdminJson, legacyAdminResponse, guardLegacyAdminRequest } from "@/lib/api/legacy-admin-adapter";
import { resolveTargetOrgId } from "@/lib/agency/target-org";
import { buildAuditCsv } from "@/lib/agency/audit/export-handler";

export const runtime = "nodejs";

async function GETHandler(request: NextRequest) {
    const guarded = await guardLegacyAdminRequest(request, {
        successorPath: "/api/agency/audit/export",
        requiredRole: "admin",
    });
    if (!guarded.ok) return guarded.response;

    let orgId: string;
    try {
        orgId = await resolveTargetOrgId({
            requestUrl: request.url,
            defaultOrgId: guarded.organizationId,
        });
    } catch {
        return legacyAdminJson(guarded.mode, "/api/agency/audit/export", { error: "Organization not found" }, { status: 404 });
    }

    const searchParams = new URL(request.url).searchParams;
    const { csv, filename } = await buildAuditCsv({
        orgId,
        type: searchParams.get("type") ?? undefined,
        from: searchParams.get("from") ?? undefined,
        to: searchParams.get("to") ?? undefined,
    });

    return legacyAdminResponse(guarded.mode, "/api/agency/audit/export", new NextResponse(csv, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
        },
    }));
}

export const GET = withApiLogging("/api/admin/audit/export", "GET", GETHandler);
