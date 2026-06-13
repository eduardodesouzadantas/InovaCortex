import { NextRequest, NextResponse } from "next/server";
import { withApiLogging } from "@/lib/logger";
import { assertTenantRole, resolveTenantRouteError } from "@/lib/auth/tenant-route";
import { isApiRouteError } from "@/lib/http/route-errors";
import { orgContextErrorResponse, requireOrgContextFromRequest } from "@/lib/auth/org-context";
import { disconnectEmailIntegration } from "@/lib/integrations/email-oauth";

export const runtime = "nodejs";

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

        assertTenantRole(ctx.role, "admin");

        const integration = await disconnectEmailIntegration(ctx.orgId);

        return NextResponse.json({
            success: true,
            data: {
                integration,
            },
        });
    } catch (error) {
        if (isApiRouteError(error)) {
            throw error;
        }
        return resolveTenantRouteError(error, "Failed to disconnect email integration");
    }
}

export const POST = withApiLogging("/api/org/[slug]/email/disconnect", "POST", POSTHandler);
