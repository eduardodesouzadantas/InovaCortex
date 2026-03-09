/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { markGoLive, runNudgeChecks, updateTaskStatus } from "@/lib/provisioning";
import { logger } from "@/lib/logger";

export async function listWorkspacesHandler(orgId: string): Promise<NextResponse> {
    const workspaces = await (prisma as any).clientWorkspace.findMany({
        where: { organizationId: orgId },
        include: {
            tasks: { select: { status: true } },
            checklist: { select: { status: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    const enriched = workspaces.map((workspace: any) => ({
        ...workspace,
        taskCounts: {
            total: workspace.tasks.length,
            done: workspace.tasks.filter((task: any) => task.status === "done").length,
            blocked: workspace.tasks.filter((task: any) => task.status === "blocked").length,
        },
        checklistCounts: {
            total: workspace.checklist.length,
            verified: workspace.checklist.filter((item: any) => item.status === "verified").length,
        },
    }));

    return NextResponse.json({ workspaces: enriched });
}

export async function runWorkspaceNudgeHandler(orgId: string, userId?: string): Promise<NextResponse> {
    const result = await runNudgeChecks(orgId);

    await (prisma as any).auditEvent.create({
        data: {
            assessmentId: "system",
            organizationId: orgId,
            action: "workspaceNudgeAll",
            details: JSON.stringify({ by: userId ?? "system", alerts: result.alerts }),
        },
    }).catch(() => null);

    return NextResponse.json({ success: true, ...result });
}

export async function updateWorkspaceChecklistHandler(
    orgId: string,
    workspaceId: string,
    itemId: string,
    status: string,
    notes: string | null | undefined,
): Promise<NextResponse> {
    const valid = ["pending", "provided", "verified"];
    if (!valid.includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const item = await (prisma as any).integrationChecklistItem.findFirst({
        where: { id: itemId, workspaceId },
        include: { workspace: { select: { organizationId: true } } },
    });

    if (!item || item.workspace.organizationId !== orgId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await (prisma as any).integrationChecklistItem.update({
        where: { id: itemId },
        data: { status, notes: notes ?? item.notes },
    });

    return NextResponse.json({ success: true, itemId, status });
}

export async function goLiveWorkspaceHandler(orgId: string, workspaceId: string): Promise<NextResponse> {
    const workspace = await (prisma as any).clientWorkspace.findFirst({
        where: { id: workspaceId, organizationId: orgId },
    });

    if (!workspace) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await markGoLive(workspaceId, workspace.assessmentId, orgId);
    return NextResponse.json({ success: true, status: "active" });
}

export async function updateWorkspaceTaskHandler(
    orgId: string,
    workspaceId: string,
    taskId: string,
    status: string,
): Promise<NextResponse> {
    const validStatuses = ["todo", "doing", "blocked", "done"];
    if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: `Invalid status. Must be: ${validStatuses.join(", ")}` }, { status: 400 });
    }

    const task = await (prisma as any).implementationTask.findFirst({
        where: { id: taskId, workspaceId },
        include: { workspace: { select: { organizationId: true } } },
    });

    if (!task || task.workspace.organizationId !== orgId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await updateTaskStatus(taskId, status);
    logger.info("Task status updated", { taskId, status, orgId });

    return NextResponse.json({ success: true, taskId, status });
}
