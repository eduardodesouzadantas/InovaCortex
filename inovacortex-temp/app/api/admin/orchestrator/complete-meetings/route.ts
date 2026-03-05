/**
 * POST /api/admin/orchestrator/complete-meetings
 * V16.3-P3: Auto-completion job for stale meetings.
 *
 * Finds MeetingSession records where:
 *  - status = "scheduled"
 *  - endAt < now (meeting has ended)
 *
 * For each: marks as "completed", enqueues followup_2h if not already sent.
 * Designed to run as a cron job (e.g., every 2 hours via Vercel Cron).
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { Orchestrator } from "@/lib/orchestrator/orchestrator";

export async function POST(req: Request) {
    const session = await getSession();
    if (!session || !can(session.role, "manageSettings")) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const now = new Date();

    // Find sessions that ended but weren't marked completed/canceled
    const staleSessions = await (prisma as any).meetingSession.findMany({
        where: {
            organizationId: session.orgId,
            status: "scheduled",
            endAt: { lt: now },
        },
        take: 50,
        orderBy: { endAt: "asc" }
    });

    const completed: string[] = [];
    const followupsQueued: string[] = [];

    for (const mtg of staleSessions) {
        // 1. Mark as completed
        await (prisma as any).meetingSession.update({
            where: { id: mtg.id },
            data: { status: "completed" }
        });
        completed.push(mtg.id);

        await (prisma as any).auditEvent.create({
            data: {
                organizationId: session.orgId,
                action: "meetingAutoCompleted",
                userId: "system:complete-job",
                resourceType: "meeting_session",
                resourceId: mtg.id,
                details: `Auto-completed by cron (endAt=${mtg.endAt.toISOString()})`,
                ipAddress: "system"
            }
        });

        // 2. Enqueue followup_2h only if not already in queue for this meeting
        const existingFollowup = await (prisma as any).actionQueue.findFirst({
            where: {
                organizationId: session.orgId,
                type: "send_whatsapp",
                payloadJson: { contains: mtg.id },
            }
        });

        if (!existingFollowup) {
            try {
                await Orchestrator.enqueue(
                    {
                        type: "send_whatsapp",
                        priority: "medium",
                        relatedEntityType: "meeting_session",
                        relatedEntityId: mtg.id,
                        payloadJson: {
                            templateKey: "meeting_followup_2h",
                            meetingId: mtg.id,
                            leadEmail: mtg.leadEmail,
                            phone: mtg.phone ?? null,
                        },
                        approvalRequired: true,
                    },
                    { orgId: session.orgId, userId: "system:complete-job" }
                );
                followupsQueued.push(mtg.id);
            } catch (_) {
                // Non-fatal: followup already exists or policy blocked
            }
        }

        // 3. Create a pending MeetingPerformance record if none exists
        const existingPerf = await (prisma as any).meetingPerformance.findFirst({
            where: { sessionId: mtg.id }
        });
        if (!existingPerf) {
            await (prisma as any).meetingPerformance.create({
                data: {
                    organizationId: session.orgId,
                    sessionId: mtg.id,
                    outcome: "pending",
                    closedValue: 0,
                    notes: ""
                }
            });
        }
    }

    return NextResponse.json({
        ok: true,
        completed: completed.length,
        followupsQueued: followupsQueued.length,
        sessionIds: completed
    });
}
