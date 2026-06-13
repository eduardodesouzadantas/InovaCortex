import { NextResponse } from "next/server";

import { orgContextErrorResponse, requireOrgContext } from "@/lib/auth/org-context";
import { hasRole } from "@/lib/auth/rbac";
import { withApiLogging, logger } from "@/lib/logger";
import { buildTenantExecutiveDashboard } from "@/lib/executive/tenant-intelligence";

async function GETHandler(
    _request: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    try {
        const { slug } = await params;
        const ctx = await requireOrgContext(slug).catch((error) => error);
        if (ctx instanceof Error) {
            return orgContextErrorResponse(ctx);
        }

        if (!hasRole(ctx.role, "admin")) {
            return NextResponse.json({ success: false, error: "FORBIDDEN" }, { status: 403 });
        }

        const dashboard = await buildTenantExecutiveDashboard(slug);
        if (!dashboard) {
            return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: dashboard,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Tenant executive intelligence failed", { error: message });
        return NextResponse.json({ success: false, error: "INTERNAL_ERROR" }, { status: 500 });
    }
}

export const GET = withApiLogging("/api/org/[slug]/executive/intelligence", "GET", GETHandler);
