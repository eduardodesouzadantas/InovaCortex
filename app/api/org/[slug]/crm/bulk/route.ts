import { NextRequest, NextResponse } from "next/server";

import { orgContextErrorResponse, requireOrgContextFromRequest } from "@/lib/auth/org-context";
import { can } from "@/lib/auth/rbac";
import { invalidTenantInputResponse, resolveTenantRouteError } from "@/lib/auth/tenant-route";
import { withApiLogging } from "@/lib/logger";
import { executeCrmBulkAction, parseCrmBulkActionInput } from "@/lib/operator/crm-workspace";

function resolveCrmBulkRouteError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    if (["INVALID_BULK_FIELD", "INVALID_BULK_SELECTION", "BULK_LIMIT_EXCEEDED"].includes(message)) {
        return invalidTenantInputResponse(message);
    }

    return resolveTenantRouteError(error, "Failed to handle CRM bulk action");
}

async function POSTHandler(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    try {
        const { slug } = await params;
        const ctx = await requireOrgContextFromRequest(request, slug).catch((error) => error);
        if (ctx instanceof Error) {
            return orgContextErrorResponse(ctx);
        }

        if (!can(ctx.role, "updateLeadStatus")) {
            return NextResponse.json({ success: false, error: "FORBIDDEN" }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        const parsed = parseCrmBulkActionInput(body);
        if (!parsed.success) {
            return invalidTenantInputResponse("Invalid CRM bulk action", parsed.error.flatten());
        }

        const result = await executeCrmBulkAction({
            organizationId: ctx.orgId,
            role: ctx.role,
            assessmentIds: parsed.data.assessmentIds,
            field: parsed.data.field,
            value: parsed.data.value,
        });

        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (error) {
        return resolveCrmBulkRouteError(error);
    }
}

export const POST = withApiLogging("/api/org/[slug]/crm/bulk", "POST", POSTHandler);
