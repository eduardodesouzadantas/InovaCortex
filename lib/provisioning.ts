/**
 * lib/provisioning.ts
 * V12: Auto-provisioning engine.
 *
 * When a Proposal is accepted, this module:
 *  1. Creates a ClientWorkspace (idempotent via proposalId unique constraint)
 *  2. Generates ImplementationTasks from templates
 *  3. Generates IntegrationChecklist from templates
 *  4. Records AuditEvents throughout
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
    BASE_TASKS,
    MODULE_TASKS,
    BASE_CHECKLIST,
    MODULE_CHECKLIST,
} from "@/lib/provisioning-templates";

export type { TaskTemplate, ChecklistTemplate } from "@/lib/provisioning-templates";
export { BASE_TASKS, MODULE_TASKS, BASE_CHECKLIST, MODULE_CHECKLIST };

// ─── Core Provisioning Function ───────────────────────────────────────────────

/**
 * Provision a ClientWorkspace for an accepted proposal.
 * Fully idempotent — calling twice returns the existing workspace.
 */
export async function provisionWorkspace(
    proposalId: string,
    orgId: string,
): Promise<{ workspace: any; created: boolean }> {
    // Idempotency check — proposalId is @unique
    const existing = await (prisma as any).clientWorkspace.findUnique({
        where: { proposalId }
    });
    if (existing) {
        logger.info("Workspace already provisioned — skipping", { proposalId, workspaceId: existing.id, orgId });
        return { workspace: existing, created: false };
    }

    // Load proposal + assessment
    const proposal = await (prisma as any).proposal.findUnique({
        where: { id: proposalId },
        include: { assessment: true },
    });
    if (!proposal) throw new Error(`Proposal not found: ${proposalId}`);

    const modules: string[] = (() => {
        try {
            const mods = JSON.parse(proposal.modules);
            return Array.isArray(mods) ? mods.map((m: any) => m.id ?? m).filter(Boolean) : [];
        } catch { return []; }
    })();

    // 1. Create workspace
    const workspace = await (prisma as any).clientWorkspace.create({
        data: {
            organizationId: orgId,
            assessmentId: proposal.assessmentId,
            proposalId,
            modulesEnabled: JSON.stringify(modules),
            status: "provisioning",
        }
    });

    logger.info("ClientWorkspace created", { workspaceId: workspace.id, orgId, modules });

    // 2. Generate tasks
    const now = new Date();
    const allTaskTemplates = [
        ...BASE_TASKS,
        ...modules.flatMap(m => MODULE_TASKS[m] ?? []),
    ].sort((a, b) => a.orderIndex - b.orderIndex);

    const taskData = allTaskTemplates.map(t => ({
        workspaceId: workspace.id,
        title: t.title,
        description: t.description,
        ownerRole: t.ownerRole,
        phase: t.phase,
        orderIndex: t.orderIndex,
        dueAt: new Date(now.getTime() + t.dueDaysFromNow * 86400000),
        status: "todo",
    }));

    await (prisma as any).implementationTask.createMany({ data: taskData });

    // 3. Generate checklist
    const allChecklist = [
        ...BASE_CHECKLIST,
        ...modules.flatMap(m => MODULE_CHECKLIST[m] ?? []),
    ];

    const checklistData = allChecklist.map(c => ({
        workspaceId: workspace.id,
        system: c.system,
        item: c.item,
        status: "pending",
    }));

    await (prisma as any).integrationChecklistItem.createMany({ data: checklistData });

    // 4. Audit events
    const auditBase = {
        assessmentId: proposal.assessmentId,
        organizationId: orgId,
    };

    await (prisma as any).auditEvent.createMany({
        data: [
            { ...auditBase, action: "workspaceProvisioned", details: JSON.stringify({ workspaceId: workspace.id, proposalId }) },
            { ...auditBase, action: "tasksGenerated", details: JSON.stringify({ count: taskData.length, workspaceId: workspace.id }) },
            { ...auditBase, action: "checklistGenerated", details: JSON.stringify({ count: checklistData.length, workspaceId: workspace.id }) },
        ]
    });

    logger.info("Workspace fully provisioned", {
        workspaceId: workspace.id,
        tasks: taskData.length,
        checklist: checklistData.length,
        orgId,
    });

    return { workspace, created: true };
}

// ─── Task Status Update ───────────────────────────────────────────────────────

export async function updateTaskStatus(taskId: string, status: string): Promise<void> {
    await (prisma as any).implementationTask.update({
        where: { id: taskId },
        data: {
            status,
            doneAt: status === "done" ? new Date() : null,
        }
    });
}

// ─── Go-Live ──────────────────────────────────────────────────────────────────

export async function markGoLive(
    workspaceId: string,
    assessmentId: string,
    orgId: string,
): Promise<void> {
    await (prisma as any).clientWorkspace.update({
        where: { id: workspaceId },
        data: { status: "active", goLiveAt: new Date() },
    });

    await (prisma as any).auditEvent.create({
        data: {
            assessmentId,
            organizationId: orgId,
            action: "workspaceGoLive",
            details: JSON.stringify({ workspaceId }),
        }
    });

    logger.info("Workspace marked as Go-Live", { workspaceId, orgId });
}

// ─── Nudge Check ─────────────────────────────────────────────────────────────

/**
 * Check for stale tasks and workspaces; create AlertEvents as needed.
 */
export async function runNudgeChecks(orgId: string): Promise<{ alerts: number }> {
    let alerts = 0;
    const now = new Date();

    // 1. Tasks blocked > 3 days
    const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);
    const blockedTasks = await (prisma as any).implementationTask.findMany({
        where: {
            status: "blocked",
            updatedAt: { not: { gte: threeDaysAgo } },
            workspace: { organizationId: orgId },
        },
        include: { workspace: { select: { id: true, assessmentId: true } } },
    });

    for (const task of blockedTasks) {
        await (prisma as any).alertEvent.create({
            data: {
                organizationId: orgId,
                type: "blockedTask",
                severity: "warning",
                message: `Tarefa bloqueada há mais de 3 dias: "${task.title}"`,
                metadata: JSON.stringify({ taskId: task.id, workspaceId: task.workspaceId }),
            }
        });
        alerts++;
    }

    // 2. Workspaces in "provisioning" > 7 days
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const staleWorkspaces = await (prisma as any).clientWorkspace.findMany({
        where: {
            organizationId: orgId,
            status: "provisioning",
            createdAt: { lt: sevenDaysAgo },
        }
    });

    for (const ws of staleWorkspaces) {
        await (prisma as any).alertEvent.create({
            data: {
                organizationId: orgId,
                type: "staleProvisioning",
                severity: "critical",
                message: `Workspace em 'provisioning' há mais de 7 dias sem ativação.`,
                metadata: JSON.stringify({ workspaceId: ws.id }),
            }
        });
        alerts++;
    }

    logger.info("Nudge checks complete", { orgId, alertsCreated: alerts });
    return { alerts };
}
