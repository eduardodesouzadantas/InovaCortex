import { NextResponse } from "next/server";
import { getBudgetStatus } from "@/lib/agentops/budget";
import { logger, withApiLogging } from "@/lib/logger";
import { orgContextErrorResponse, requireOrgContext } from "@/lib/auth/org-context";

/**
 * GET /api/org/[slug]/ai/budget
 * Returns the current daily token usage and limits for the organization.
 */
async function GETHandler(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;

        // Auth check
        const ctx = await requireOrgContext(slug).catch((error) => error);
        if (ctx instanceof Error) return orgContextErrorResponse(ctx);

        const status = await getBudgetStatus(ctx.orgId);
        return NextResponse.json(status);

    } catch (error: any) {
        logger.error("Budget Status API Error", { error: error.message });
        return NextResponse.json({ error: "Failed to fetch budget status" }, { status: 500 });
    }
}

export const GET = withApiLogging("/api/org/[slug]/ai/budget", "GET", GETHandler);
