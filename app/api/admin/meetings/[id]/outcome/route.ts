import { withApiLogging } from "@/lib/logger";
/**
 * POST /api/admin/meetings/[id]/outcome
 * V16.3-P3: Records outcome for a completed meeting.
 * Updates MeetingPerformance and the MeetingSession.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

const VALID_OUTCOMES = ["won", "lost", "no_show", "pending"];

async function POSTHandler(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session || !can(session.role, "viewDashboard")) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { outcome, closedValue, notes } = body;

    if (!VALID_OUTCOMES.includes(outcome)) {
        return NextResponse.json({ error: `outcome must be one of: ${VALID_OUTCOMES.join(", ")}` }, { status: 400 });
    }

    // Ensure session exists and belongs to org
    const mtgSession = await (prisma as any).meetingSession.findFirst({
        where: { id, organizationId: session.orgId }
    });
    if (!mtgSession) {
        return new NextResponse("Not Found", { status: 404 });
    }

    // Upsert MeetingPerformance
    const existing = await (prisma as any).meetingPerformance.findFirst({
        where: { sessionId: id }
    });

    const perf = existing
        ? await (prisma as any).meetingPerformance.update({
            where: { id: existing.id },
            data: { outcome, closedValue: closedValue ?? 0, notes: notes ?? "" }
        })
        : await (prisma as any).meetingPerformance.create({
            data: {
                organizationId: session.orgId,
                sessionId: id,
                outcome,
                closedValue: closedValue ?? 0,
                notes: notes ?? ""
            }
        });

    // Audit
    await (prisma as any).auditEvent.create({
        data: {
            organizationId: session.orgId,
            action: "meetingOutcomeRecorded",
            userId: session.userId,
            resourceType: "meeting_session",
            resourceId: id,
            details: `outcome=${outcome} | value=R$${closedValue ?? 0}`,
            ipAddress: "system"
        }
    });

    return NextResponse.json({ success: true, performance: perf });
}

export const POST = withApiLogging("/api/admin/meetings/[id]/outcome", "POST", POSTHandler);
