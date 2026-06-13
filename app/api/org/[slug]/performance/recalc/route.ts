
import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import {
    assertTenantRole,
    invalidTenantInputResponse,
    resolveTenantRouteError,
} from "@/lib/auth/tenant-route";
import { prisma } from "@/lib/prisma";
import { logger, withApiLogging } from "@/lib/logger";

const WINDOW_OPTIONS = new Set(["7d", "30d", "90d"]);

async function POSTHandler(
    req: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const window = searchParams.get("window") || "30d";

    try {
        if (!WINDOW_OPTIONS.has(window)) {
            return invalidTenantInputResponse("window must be one of: 7d, 30d, 90d");
        }
        const ctx = await requireOrgContext(slug);
        assertTenantRole(ctx.role, "admin");

        const task = await prisma.actionQueue.create({
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
    } catch (err) {
        return resolveTenantRouteError(err, "Failed to enqueue performance recalculation");
    }
}

export const POST = withApiLogging("/api/org/[slug]/performance/recalc", "POST", POSTHandler);
