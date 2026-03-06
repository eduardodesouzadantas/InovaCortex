import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { updateTaskStatus } from "@/lib/provisioning";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * PATCH /api/admin/workspaces/[id]/tasks/[taskId]
 * Update a task's status (admin only).
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; taskId: string }> }
) {
    const session = await getSession();
    if (!session || !["owner", "admin", "closer"].includes(session.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: workspaceId, taskId } = await params;
    const { status } = await request.json();

    const validStatuses = ["todo", "doing", "blocked", "done"];
    if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: `Invalid status. Must be: ${validStatuses.join(", ")}` }, { status: 400 });
    }

    // Verify task belongs to session's org
    const task = await (prisma as any).implementationTask.findFirst({
        where: { id: taskId, workspaceId },
        include: { workspace: { select: { organizationId: true } } },
    });

    if (!task || task.workspace.organizationId !== session.orgId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await updateTaskStatus(taskId, status);
    logger.info("Task status updated", { taskId, status, orgId: session.orgId });

    return NextResponse.json({ success: true, taskId, status });
}
