
import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const window = searchParams.get("window") || "30d";

    try {
        const ctx = await requireOrgContext(slug);
        assertRole(ctx.role, "admin");

        const task = await (prisma as any).actionQueue.create({
            data: {
                organizationId: ctx.orgId,
                type: "performance_recalc",
                payloadJson: JSON.stringify({ orgId: ctx.orgId, window, triggeredBy: ctx.userId }),
                priority: "medium",
                status: "pending"
            }
        });

        logger.info(`Performance recalc task enqueued: ${task.id} for org: ${ctx.orgId}`);

        return NextResponse.json({
            success: true,
            taskId: task.id,
            status: "pending"
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: err.message === "FORBIDDEN" ? 403 : 401 });
    }
}
