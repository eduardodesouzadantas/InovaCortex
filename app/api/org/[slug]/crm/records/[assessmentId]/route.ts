import { NextRequest, NextResponse } from "next/server";

import { orgContextErrorResponse, requireOrgContextFromRequest } from "@/lib/auth/org-context";
import { can } from "@/lib/auth/rbac";
import {
    invalidTenantInputResponse,
    resolveTenantRouteError,
    tenantNotFoundResponse,
} from "@/lib/auth/tenant-route";
import { withApiLogging } from "@/lib/logger";
import {
    buildOperatorCrmRecordDetail,
    parseCrmInlinePatchInput,
    updateCrmInlineField,
} from "@/lib/operator/crm-workspace";

function resolveCrmRouteError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    if (message === "ASSESSMENT_NOT_FOUND") {
        return tenantNotFoundResponse("CRM record not found");
    }

    if ([
        "CONTACT_NOT_AVAILABLE",
        "CONVERSATION_NOT_AVAILABLE",
        "DEAL_NOT_AVAILABLE",
        "INVALID_EDITABLE_FIELD",
        "INVALID_ASSESSMENT_GOAL",
        "INVALID_ASSESSMENT_SEGMENT",
        "INVALID_ASSESSMENT_URGENCY",
        "INVALID_NEXT_ACTION",
        "INVALID_NEXT_ACTION_AT",
        "INVALID_NICHE_FIELD",
        "INVALID_NICHE_VALUE",
        "INVALID_PRIORITY",
        "OWNER_NOT_AVAILABLE",
        "STAGE_NOT_FOUND",
    ].includes(message)) {
        return invalidTenantInputResponse(message);
    }

    return resolveTenantRouteError(error, "Failed to handle CRM record");
}

async function GETHandler(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string; assessmentId: string }> },
) {
    try {
        const { slug, assessmentId } = await params;
        const ctx = await requireOrgContextFromRequest(request, slug).catch((error) => error);
        if (ctx instanceof Error) {
            return orgContextErrorResponse(ctx);
        }

        if (!can(ctx.role, "viewDashboard")) {
            return NextResponse.json({ success: false, error: "FORBIDDEN" }, { status: 403 });
        }

        const detail = await buildOperatorCrmRecordDetail({
            organizationId: ctx.orgId,
            orgSlug: slug,
            assessmentId,
        });

        if (!detail) {
            return tenantNotFoundResponse("CRM record not found");
        }

        return NextResponse.json({
            success: true,
            data: detail,
        });
    } catch (error) {
        return resolveCrmRouteError(error);
    }
}

async function PATCHHandler(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string; assessmentId: string }> },
) {
    try {
        const { slug, assessmentId } = await params;
        const ctx = await requireOrgContextFromRequest(request, slug).catch((error) => error);
        if (ctx instanceof Error) {
            return orgContextErrorResponse(ctx);
        }

        if (!can(ctx.role, "updateLeadStatus")) {
            return NextResponse.json({ success: false, error: "FORBIDDEN" }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        const parsed = parseCrmInlinePatchInput(body);
        if (!parsed.success) {
            return invalidTenantInputResponse("Invalid CRM inline update", parsed.error.flatten());
        }

        const result = await updateCrmInlineField({
            organizationId: ctx.orgId,
            role: ctx.role,
            assessmentId,
            field: parsed.data.field,
            value: parsed.data.value,
        });

        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (error) {
        return resolveCrmRouteError(error);
    }
}

export const GET = withApiLogging("/api/org/[slug]/crm/records/[assessmentId]", "GET", GETHandler);
export const PATCH = withApiLogging("/api/org/[slug]/crm/records/[assessmentId]", "PATCH", PATCHHandler);
