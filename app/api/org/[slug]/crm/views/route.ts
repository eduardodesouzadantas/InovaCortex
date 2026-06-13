import { NextRequest, NextResponse } from "next/server";

import { orgContextErrorResponse, requireOrgContextFromRequest } from "@/lib/auth/org-context";
import { can } from "@/lib/auth/rbac";
import { invalidTenantInputResponse, resolveTenantRouteError } from "@/lib/auth/tenant-route";
import { withApiLogging } from "@/lib/logger";
import {
    buildOperatorCrmWorkspace,
    listCrmSavedViews,
    parseCrmSavedViewInput,
    saveCrmSavedView,
} from "@/lib/operator/crm-workspace";

function resolveCrmViewRouteError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    if (["INVALID_BASE_VIEW", "INVALID_VIEW_COLUMNS"].includes(message)) {
        return invalidTenantInputResponse(message);
    }

    return resolveTenantRouteError(error, "Failed to handle CRM saved views");
}

async function GETHandler(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    try {
        const { slug } = await params;
        const ctx = await requireOrgContextFromRequest(request, slug).catch((error) => error);
        if (ctx instanceof Error) {
            return orgContextErrorResponse(ctx);
        }

        if (!can(ctx.role, "viewDashboard")) {
            return NextResponse.json({ success: false, error: "FORBIDDEN" }, { status: 403 });
        }

        const views = await listCrmSavedViews({
            organizationId: ctx.orgId,
            userId: ctx.userId,
        });

        return NextResponse.json({
            success: true,
            data: views,
        });
    } catch (error) {
        return resolveCrmViewRouteError(error);
    }
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

        if (!can(ctx.role, "viewDashboard")) {
            return NextResponse.json({ success: false, error: "FORBIDDEN" }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        const workspace = await buildOperatorCrmWorkspace(ctx.orgId, slug, ctx.userId);
        const parsed = parseCrmSavedViewInput(body, {
            columns: workspace.table.columns,
            presets: workspace.views.system,
        });

        if (!parsed.success) {
            return invalidTenantInputResponse("Invalid CRM saved view", parsed.error.flatten());
        }

        if (parsed.data.scope === "tenant" && !can(ctx.role, "manageSettings")) {
            return NextResponse.json({ success: false, error: "FORBIDDEN" }, { status: 403 });
        }

        const result = await saveCrmSavedView({
            organizationId: ctx.orgId,
            userId: ctx.userId,
            role: ctx.role,
            name: parsed.data.name,
            scope: parsed.data.scope,
            baseViewId: parsed.data.baseViewId,
            defaultMode: parsed.data.defaultMode,
            sortId: parsed.data.sortId,
            columnIds: parsed.data.columnIds,
        });

        return NextResponse.json({
            success: true,
            data: result.view,
        });
    } catch (error) {
        return resolveCrmViewRouteError(error);
    }
}

export const GET = withApiLogging("/api/org/[slug]/crm/views", "GET", GETHandler);
export const POST = withApiLogging("/api/org/[slug]/crm/views", "POST", POSTHandler);
