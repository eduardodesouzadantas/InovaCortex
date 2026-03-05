import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBudgetStatus } from "@/lib/agentops/budget";
import { getSession } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

/**
 * GET /api/org/[slug]/ai/budget
 * Returns the current daily token usage and limits for the organization.
 */
export async function GET(
    request: Request,
    { params }: { params: { slug: string } }
) {
    try {
        const { slug } = params;

        // Auth check
        const session = await getSession();
        if (!session || session.orgSlug !== slug) {
            return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        }

        const org = await prisma.organization.findUnique({
            where: { slug },
            select: { id: true }
        });

        if (!org) {
            return NextResponse.json({ error: "Org not found" }, { status: 404 });
        }

        const status = await getBudgetStatus(org.id);
        return NextResponse.json(status);

    } catch (error: any) {
        logger.error("Budget Status API Error", { error: error.message });
        return NextResponse.json({ error: "Failed to fetch budget status" }, { status: 500 });
    }
}
