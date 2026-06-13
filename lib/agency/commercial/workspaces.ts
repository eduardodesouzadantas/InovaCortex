/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { markGoLive, runNudgeChecks, updateTaskStatus } from "@/lib/provisioning";
import { logger } from "@/lib/logger";
import { isTenantReady } from "@/lib/onboarding-status";
import { getOrganizationAccountStatus, ORGANIZATION_BILLING_SUSPENDED_MESSAGE } from "@/lib/billing/account-status";

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
        where: { id: itemId, workspaceId, organizationId: orgId },
    });

    if (!item) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await (prisma as any).integrationChecklistItem.updateMany({
        where: { id: itemId, organizationId: orgId },
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

    if (await getOrganizationAccountStatus(orgId) === "suspended") {
        return NextResponse.json(
            {
                error: "FORBIDDEN",
                message: ORGANIZATION_BILLING_SUSPENDED_MESSAGE,
            },
            { status: 403 },
        );
    }

    const readiness = await isTenantReady(orgId);
    if (!readiness.ready) {
        return NextResponse.json(
            {
                error: "TENANT_NOT_READY",
                message: "O tenant ainda nao atingiu o minimo operacional para go-live.",
                readiness,
            },
            { status: 409 },
        );
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
        where: { id: taskId, workspaceId, organizationId: orgId },
    });

    if (!task) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await updateTaskStatus(orgId, taskId, status);
    logger.info("Task status updated", { taskId, status, orgId });

    return NextResponse.json({ success: true, taskId, status });
}
