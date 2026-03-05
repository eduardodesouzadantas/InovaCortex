/**
 * GET /api/admin/meetings/metrics
 * V16.3-P3: Returns 30-day meeting performance metrics for the Cockpit.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const session = await getSession();
    if (!session || !can(session.role, "viewDashboard")) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // All completed+canceled sessions in last 30 days
    const sessions = await (prisma as any).meetingSession.findMany({
        where: {
            organizationId: session.orgId,
            startAt: { gte: since },
            status: { in: ["completed", "canceled"] }
        }
    });

    // All performances for those sessions
    const sessionIds = sessions.map((s: any) => s.id);
    const performances = sessionIds.length > 0
        ? await (prisma as any).meetingPerformance.findMany({
            where: { sessionId: { in: sessionIds } }
        })
        : [];

    const total = sessions.length;
    const showed = sessions.filter((s: any) => s.status === "completed").length;
    const showRate = total > 0 ? showed / total : 0;

    const wonPerfs = performances.filter((p: any) => p.outcome === "won");
    const closeRate = showed > 0 ? wonPerfs.length / showed : 0;

    const totalRevenue = wonPerfs.reduce((sum: number, p: any) => sum + (p.closedValue ?? 0), 0);
    const avgDealSize = wonPerfs.length > 0 ? totalRevenue / wonPerfs.length : 0;

    const noShowCount = performances.filter((p: any) => p.outcome === "no_show").length;
    const lostCount = performances.filter((p: any) => p.outcome === "lost").length;
    const pendingCount = performances.filter((p: any) => p.outcome === "pending").length;

    return NextResponse.json({
        period: "30d",
        total,
        showed,
        showRate: Math.round(showRate * 100),
        closeRate: Math.round(closeRate * 100),
        avgDealSize: Math.round(avgDealSize),
        totalRevenue: Math.round(totalRevenue),
        wonCount: wonPerfs.length,
        lostCount,
        noShowCount,
        pendingCount,
    });
}
