import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth/rbac";
import { logger, withApiLogging } from "@/lib/logger";
import { orgContextErrorResponse, requireOrgContext } from "@/lib/auth/org-context";

/**
 * GET /api/org/[slug]/ai/history
 * Fetch session historical messages with Auth + RBAC.
 */
async function GETHandler(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get("sessionId");
        const limit = parseInt(searchParams.get("limit") || "50");

        // 1. Auth & RBAC Check
        const ctx = await requireOrgContext(slug).catch((error) => error);
        if (ctx instanceof Error) return orgContextErrorResponse(ctx);

        if (!hasRole(ctx.role, "admin")) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }

        if (!sessionId) {
            return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
        }

        // 2. Query History (role, content, createdAt)
        const messages = await (prisma as any).aIChatMessage.findMany({
            where: { sessionId, organizationId: ctx.orgId },
            orderBy: { createdAt: "asc" },
            take: limit,
            select: {
                role: true,
                content: true,
                createdAt: true
            }
        });

        return NextResponse.json(messages);

    } catch (error: any) {
        logger.error("AI History API Error", { error: error.message });
        return NextResponse.json({ error: "History retrieval failed" }, { status: 500 });
    }
}

export const GET = withApiLogging("/api/org/[slug]/ai/history", "GET", GETHandler);
