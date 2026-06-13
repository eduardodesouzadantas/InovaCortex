import { NextRequest, NextResponse } from "next/server";

import { orgContextErrorResponse, requireOrgContextFromRequest } from "@/lib/auth/org-context";
import { can } from "@/lib/auth/rbac";
import { invalidTenantInputResponse, resolveTenantRouteError } from "@/lib/auth/tenant-route";
import { withApiLogging } from "@/lib/logger";
import { executeCrmPlaybook, parseCrmPlaybookInput } from "@/lib/operator/crm-workspace";

function resolveCrmPlaybookRouteError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    if ([
        "INVALID_PLAYBOOK",
        "INVALID_PLAYBOOK_SELECTION",
        "PLAYBOOK_LIMIT_EXCEEDED",
        "PLAYBOOK_CONTEXT_MISMATCH",
        "CADENCE_NOT_AVAILABLE",
    ].includes(message)) {
        return invalidTenantInputResponse(message);
    }

    return resolveTenantRouteError(error, "Failed to handle CRM playbook");
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
        const parsed = parseCrmPlaybookInput(body);
        if (!parsed.success) {
            return invalidTenantInputResponse("Invalid CRM playbook action", parsed.error.flatten());
        }

        const result = await executeCrmPlaybook({
            organizationId: ctx.orgId,
            role: ctx.role,
            assessmentIds: parsed.data.assessmentIds,
            playbookId: parsed.data.playbookId,
            sourceViewId: parsed.data.sourceViewId ?? null,
        });

        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (error) {
        return resolveCrmPlaybookRouteError(error);
    }
}

export const POST = withApiLogging("/api/org/[slug]/crm/playbooks", "POST", POSTHandler);
