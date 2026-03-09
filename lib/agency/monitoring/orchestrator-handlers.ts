/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { Orchestrator } from "@/lib/orchestrator/orchestrator";
import { executeMeetingAction, isMeetingActionType } from "@/lib/orchestrator/executors/meeting-executor";
import { executeBriefingAction } from "@/lib/orchestrator/executors/briefing-executor";
import { runBrainCycle } from "@/lib/services/revenue/brain-cycle";
import { executeProfitLeakScan } from "@/lib/orchestrator/executors/profit-leak-executor";

const DEFAULT_RUN_DUE_BATCH_SIZE = 25;

export async function runOrchestratorQueue(orgId: string): Promise<{ success: true; message: string }> {
    await Orchestrator.processQueue(orgId);
    return { success: true, message: "Queue processed" };
}

export async function planOrchestratorActions(input: {
    orgId: string;
    userId: string;
    previewOnly: boolean;
}): Promise<{ success: true; count: number; actions: unknown[] }> {
    const recentLeads = await (prisma as any).assessment.findMany({
        where: { organizationId: input.orgId },
        orderBy: { createdAt: "desc" },
        take: 5,
    });

    const ctx = {
        orgId: input.orgId,
        userId: input.userId,
        recentLeads,
    };

    const plannedActions = await Orchestrator.plan(ctx);
    if (!input.previewOnly) {
        for (const action of plannedActions) {
            await Orchestrator.enqueue(action, ctx);
        }
    }

    return { success: true, count: plannedActions.length, actions: plannedActions };
}

export async function runDueMeetingActions(input: {
    orgId: string;
    batchSize?: number;
}): Promise<{
    ok: true;
    processed: number;
    sent: number;
    failed: number;
    results: Array<{ id: string; type: string; success: boolean; reason?: string }>;
}> {
    const batchSize = input.batchSize ?? DEFAULT_RUN_DUE_BATCH_SIZE;
    const runId = crypto.randomUUID();
    const now = new Date();
    const lockUntil = new Date(now.getTime() + 5 * 60_000);

    const types = [
        "meeting_reminder_24h",
        "meeting_reminder_1h",
        "meeting_briefing_10m",
        "meeting_followup_2h",
        "meeting_followup_48h",
        "generate_presales",
    ];

    await (prisma as any).actionQueue.updateMany({
        where: {
            organizationId: input.orgId,
            type: { in: types },
            status: { in: ["pending", "approved"] },
            OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
        },
        data: {
            lockedByRunId: runId,
            lockedUntil: lockUntil,
            attempts: { increment: 1 },
        },
    });

    const priorityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const itemsRaw = await (prisma as any).actionQueue.findMany({
        where: { organizationId: input.orgId, lockedByRunId: runId },
        take: batchSize * 2,
        orderBy: { createdAt: "asc" },
    });

    const items = itemsRaw
        .sort((a: any, b: any) => (priorityRank[b.priority] ?? 0) - (priorityRank[a.priority] ?? 0))
        .slice(0, batchSize);

    const results: Array<{ id: string; type: string; success: boolean; reason?: string }> = [];

    for (const item of items) {
        if (!isMeetingActionType(item.type)) {
            await (prisma as any).actionQueue.update({
                where: { id: item.id },
                data: { lockedByRunId: null, lockedUntil: null },
            });
            continue;
        }

        try {
            let result: { success: boolean; reason?: string };
            if (item.type === "generate_presales" || item.type === "briefing_10m") {
                result = await executeBriefingAction(item);
            } else {
                result = await executeMeetingAction(item);
            }
            results.push({ id: item.id, type: item.type, ...result });
        } catch (error) {
            results.push({
                id: item.id,
                type: item.type,
                success: false,
                reason: error instanceof Error ? error.message : String(error),
            });
            await (prisma as any).actionQueue.update({
                where: { id: item.id },
                data: { lockedByRunId: null, lockedUntil: null },
            });
        }
    }

    const sent = results.filter((result) => result.success).length;
    const failed = results.filter((result) => !result.success).length;

    return { ok: true, processed: results.length, sent, failed, results };
}

export async function completeStaleMeetings(orgId: string): Promise<{
    ok: true;
    completed: number;
    followupsQueued: number;
    sessionIds: string[];
}> {
    const now = new Date();
    const staleSessions = await (prisma as any).meetingSession.findMany({
        where: {
            organizationId: orgId,
            status: "scheduled",
            endAt: { lt: now },
        },
        take: 50,
        orderBy: { endAt: "asc" },
    });

    const completed: string[] = [];
    const followupsQueued: string[] = [];

    for (const meeting of staleSessions) {
        await (prisma as any).meetingSession.update({
            where: { id: meeting.id },
            data: { status: "completed" },
        });
        completed.push(meeting.id);

        await (prisma as any).auditEvent.create({
            data: {
                organizationId: orgId,
                action: "meetingAutoCompleted",
                userId: "system:complete-job",
                resourceType: "meeting_session",
                resourceId: meeting.id,
                details: `Auto-completed by cron (endAt=${meeting.endAt.toISOString()})`,
                ipAddress: "system",
            },
        });

        const existingFollowup = await (prisma as any).actionQueue.findFirst({
            where: {
                organizationId: orgId,
                type: "send_whatsapp",
                payloadJson: { contains: meeting.id },
            },
        });

        if (!existingFollowup) {
            try {
                await Orchestrator.enqueue(
                    {
                        type: "send_whatsapp",
                        priority: "medium",
                        relatedEntityType: "meeting_session",
                        relatedEntityId: meeting.id,
                        payloadJson: {
                            templateKey: "meeting_followup_2h",
                            meetingId: meeting.id,
                            leadEmail: meeting.leadEmail,
                            phone: meeting.phone ?? null,
                        },
                        approvalRequired: true,
                    },
                    { orgId, userId: "system:complete-job" },
                );
                followupsQueued.push(meeting.id);
            } catch {
                // Non-fatal if policy blocks or followup already exists.
            }
        }

        const existingPerformance = await (prisma as any).meetingPerformance.findFirst({
            where: { sessionId: meeting.id },
        });
        if (!existingPerformance) {
            await (prisma as any).meetingPerformance.create({
                data: {
                    organizationId: orgId,
                    sessionId: meeting.id,
                    outcome: "pending",
                    closedValue: 0,
                    notes: "",
                },
            });
        }
    }

    return {
        ok: true,
        completed: completed.length,
        followupsQueued: followupsQueued.length,
        sessionIds: completed,
    };
}

export async function runAgencyBrainCycle(orgId: string): Promise<Record<string, unknown>> {
    const result = await runBrainCycle(orgId);
    return { ok: true, ...result };
}

export async function scanOrgProfitLeaks(orgId: string): Promise<{
    ok: true;
    leaksCreated: number;
    leaksUpdated: number;
    snapshot: unknown;
    scannedAt: string;
}> {
    const result = await executeProfitLeakScan({ orgId });
    if (!result.success) {
        throw new Error("Scan failed");
    }

    return {
        ok: true,
        leaksCreated: result.leaksCreated ?? 0,
        leaksUpdated: result.leaksUpdated ?? 0,
        snapshot: result.snapshot ?? null,
        scannedAt: new Date().toISOString(),
    };
}
