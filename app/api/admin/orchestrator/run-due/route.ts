/**
 * POST /api/admin/orchestrator/run-due
 * V16.3: Processes overdue ActionQueue items for meeting lifecycle events.
 *
 * Locks items with the existing lockedByRunId/lockedUntil mechanism
 * from the Orchestrator. Only processes meeting_* types for now.
 * Default batch size: 25 items.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { executeMeetingAction, isMeetingActionType } from "@/lib/orchestrator/executors/meeting-executor";
import { executeBriefingAction } from "@/lib/orchestrator/executors/briefing-executor";
import crypto from "crypto";

const BATCH_SIZE = 25;

export async function POST(req: Request) {
    const session = await getSession();
    if (!session || !can(session.role, "manageSettings")) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const batchSize: number = body.batchSize ?? BATCH_SIZE;

    const runId = crypto.randomUUID();
    const now = new Date();
    const lockUntil = new Date(now.getTime() + 5 * 60_000); // 5 min lock

    // 1. Lock eligible items: meeting_* types, approved/pending, dueAt <= now or no dueAt
    const TYPES = [
        "meeting_reminder_24h",
        "meeting_reminder_1h",
        "meeting_briefing_10m",
        "meeting_followup_2h",
        "meeting_followup_48h",
        "generate_presales",  // V16.3-P2: briefing to owner
    ];

    // Lock batch
    await (prisma as any).actionQueue.updateMany({
        where: {
            organizationId: session.orgId,
            type: { in: TYPES },
            status: { in: ["pending", "approved"] },
            OR: [
                { lockedUntil: null },
                { lockedUntil: { lt: now } }
            ]
        },
        data: {
            lockedByRunId: runId,
            lockedUntil: lockUntil,
            attempts: { increment: 1 }
        }
    });

    // Fetch locked items — sorted by priority rank DESC then createdAt asc
    const PRIORITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const itemsRaw = await (prisma as any).actionQueue.findMany({
        where: { organizationId: session.orgId, lockedByRunId: runId },
        take: batchSize * 2,   // fetch 2x and slice after sort
        orderBy: { createdAt: "asc" }
    });
    const items = itemsRaw
        .sort((a: any, b: any) => (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0))
        .slice(0, batchSize);

    const results: { id: string; type: string; success: boolean; reason?: string }[] = [];

    for (const item of items) {
        if (!isMeetingActionType(item.type)) {
            // Unlock non-meeting items, don't process
            await (prisma as any).actionQueue.update({
                where: { id: item.id },
                data: { lockedByRunId: null, lockedUntil: null }
            });
            continue;
        }

        try {
            let result: { success: boolean; reason?: string };

            if (item.type === "generate_presales" || item.type === "briefing_10m") {
                result = await executeBriefingAction(item);
            } else if (isMeetingActionType(item.type)) {
                result = await executeMeetingAction(item);
            } else {
                // Unlock unsupported type
                await (prisma as any).actionQueue.update({
                    where: { id: item.id },
                    data: { lockedByRunId: null, lockedUntil: null }
                });
                continue;
            }

            results.push({ id: item.id, type: item.type, ...result });
        } catch (err: any) {
            results.push({ id: item.id, type: item.type, success: false, reason: err.message });
            // unlock on error so it can retry
            await (prisma as any).actionQueue.update({
                where: { id: item.id },
                data: { lockedByRunId: null, lockedUntil: null }
            });
        }
    }

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
        ok: true,
        processed: results.length,
        sent,
        failed,
        results
    });
}
