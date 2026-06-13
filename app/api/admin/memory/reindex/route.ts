import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";
import { logger, withApiLogging } from "@/lib/logger";

type ReindexRequestBody = {
    orgId?: string;
};

async function POSTHandler(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        if (!hasRole(session.role, "admin")) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }

        const body = await request.json() as ReindexRequestBody;
        if (!body.orgId) {
            return NextResponse.json({ error: "orgId required" }, { status: 400 });
        }

        const task = await prisma.actionQueue.create({
            data: {
                organizationId: body.orgId,
                type: "memory_reindex_org",
                payloadJson: JSON.stringify({ orgId: body.orgId, triggeredBy: session.userId }),
                priority: "medium",
                status: "pending",
            },
            select: { id: true },
        });

        logger.info(`Reindex task enqueued: ${task.id} for org: ${body.orgId}`);
        return NextResponse.json({ success: true, taskId: task.id, status: "pending" });
    } catch (error: unknown) {
        logger.error("Memory Reindex API Error", {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({ error: "Failed to enqueue reindex" }, { status: 500 });
    }
}

export const POST = withApiLogging("/api/admin/memory/reindex", "POST", POSTHandler);
