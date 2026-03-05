import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";
import { logger } from "@/lib/logger";

/**
 * GET /api/org/[slug]/ai/history
 * Fetch session historical messages with Auth + RBAC.
 */
export async function GET(
    request: Request,
    { params }: { params: { slug: string } }
) {
    try {
        const { slug } = params;
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get("sessionId");
        const limit = parseInt(searchParams.get("limit") || "50");

        // 1. Auth & RBAC Check
        const session = await getSession();
        if (!session || session.orgSlug !== slug) {
            return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        }

        if (!hasRole(session.role, "admin")) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }

        if (!sessionId) {
            return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
        }

        // 2. Query History (role, content, createdAt)
        const messages = await (prisma as any).aIChatMessage.findMany({
            where: { sessionId, organizationId: session.orgId },
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
