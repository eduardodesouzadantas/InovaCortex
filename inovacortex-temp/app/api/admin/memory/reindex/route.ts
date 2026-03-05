import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";
import { logger } from "@/lib/logger";

/**
 * POST /api/admin/memory/reindex
 * Triggers a semantic reindexing of an organization's knowledge base.
 * Admin/Owner only. Enqueues an execution task.
 */
export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        if (!hasRole(session.role, "admin")) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }

        const body = await request.json();
        const { orgId } = body;

        if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

        // Enqueue ActionQueue Task
        const task = await (prisma as any).actionQueue.create({
            data: {
                organizationId: orgId,
                type: "memory_reindex_org",
                payloadJson: JSON.stringify({ orgId, triggeredBy: session.userId }),
                priority: "medium",
                status: "pending"
            }
        });

        logger.info(`Reindex task enqueued: ${task.id} for org: ${orgId}`);

        return NextResponse.json({
            success: true,
            taskId: task.id,
            status: "pending"
        });

    } catch (error: any) {
        logger.error("Memory Reindex API Error", { error: error.message });
        return NextResponse.json({ error: "Failed to enqueue reindex" }, { status: 500 });
    }
}
