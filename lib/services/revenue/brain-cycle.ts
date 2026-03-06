/**
 * lib/services/revenue/brain-cycle.ts
 * V17: BrainCycle — orchestrates calibration + prioritization for all active sessions.
 *
 * Called by: POST /api/admin/orchestrator/brain-cycle
 * For each active MeetingSession in org:
 *  1. recalibrate adjustedProbability
 *  2. compute + persist expectedRevenue
 *  3. re-prioritize ActionQueue items by priorityWeight
 *  4. run timing escalation checks
 *  5. return summary
 */

import { prisma } from "@/lib/prisma";
import { calculateExpectedRevenue } from "./expected-revenue";
import { runEscalationCheck } from "./timing-engine";
import { calculatePipelineHealth } from "./pipeline-health";

export interface BrainCycleResult {
    orgId: string;
    sessionsProcessed: number;
    escalations: number;
    pipelineHealth: Awaited<ReturnType<typeof calculatePipelineHealth>>;
    actionQueueUpdates: number;
    durationMs: number;
}

export async function runBrainCycle(orgId: string): Promise<BrainCycleResult> {
    const t0 = Date.now();

    // 1. Get all active sessions
    const sessions = await (prisma as any).meetingSession.findMany({
        where: { organizationId: orgId, status: { in: ["scheduled", "completed"] } },
        select: { id: true }
    });

    // 2. Recalibrate + compute expected revenue for each session
    const revenueResults = await Promise.all(
        sessions.map((s: any) => calculateExpectedRevenue(s.id))
    );

    // 3. Re-prioritize pending ActionQueue items by priorityWeight
    // Build a map: sessionId → priorityWeight
    const weightMap = new Map<string, number>();
    for (let i = 0; i < sessions.length; i++) {
        weightMap.set(sessions[i].id, revenueResults[i].priorityWeight);
    }

    let actionQueueUpdates = 0;

    // Update ActionQueue items for meetings
    const pendingItems = await (prisma as any).actionQueue.findMany({
        where: {
            organizationId: orgId,
            status: { in: ["pending", "approved"] },
            type: {
                in: [
                    "meeting_reminder_24h", "meeting_reminder_1h",
                    "meeting_briefing_10m", "meeting_followup_2h",
                    "meeting_followup_48h", "generate_presales"
                ]
            }
        }
    });

    for (const item of pendingItems) {
        const payload = JSON.parse(item.payloadJson || "{}");
        const sessionId = payload.meetingId ?? payload.meetingSessionId;
        if (!sessionId) continue;

        const weight = weightMap.get(sessionId);
        if (weight == null) continue;

        // Map priorityWeight (0-100) to priority string
        let newPriority: string;
        if (weight >= 80) newPriority = "critical";
        else if (weight >= 60) newPriority = "high";
        else if (weight >= 35) newPriority = "medium";
        else newPriority = "low";

        if (newPriority !== item.priority) {
            await (prisma as any).actionQueue.update({
                where: { id: item.id },
                data: { priority: newPriority }
            });
            actionQueueUpdates++;
        }
    }

    // 4. Run timing escalation checks
    const escalations = await runEscalationCheck(orgId);

    // Apply escalation priorities to queue items
    for (const esc of escalations) {
        if (!esc.escalation.escalate) continue;
        await (prisma as any).actionQueue.updateMany({
            where: {
                organizationId: orgId,
                status: { in: ["pending", "approved"] },
                payloadJson: { contains: esc.sessionId }
            },
            data: { priority: esc.escalation.newPriority }
        });
    }

    // 5. Pipeline health
    const pipelineHealth = await calculatePipelineHealth(orgId);

    // 6. Audit
    await (prisma as any).auditEvent.create({
        data: {
            organizationId: orgId,
            action: "brainCycleRan",
            userId: "system:brain",
            resourceType: "organization",
            resourceId: orgId,
            details: JSON.stringify({
                sessions: sessions.length,
                escalations: escalations.length,
                actionQueueUpdates,
                pipelineQualityIndex: pipelineHealth.pipelineQualityIndex,
                durationMs: Date.now() - t0
            }),
            ipAddress: "system"
        }
    });

    return {
        orgId,
        sessionsProcessed: sessions.length,
        escalations: escalations.length,
        pipelineHealth,
        actionQueueUpdates,
        durationMs: Date.now() - t0,
    };
}
