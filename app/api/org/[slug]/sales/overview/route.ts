import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLeaderboard, getCommissionSummary } from "@/lib/sales/stats-engine";
import { scanSLABreaches } from "@/lib/sales/sla-engine";
import { orgContextErrorResponse, requireOrgContext } from "@/lib/auth/org-context";

async function GETHandler(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const ctx = await requireOrgContext(slug).catch((error) => error);
    if (ctx instanceof Error) return orgContextErrorResponse(ctx);

    const month = new Date().toISOString().slice(0, 7);

    // Parallel data fetching for the executive overview
    const [reps, leaderboard, commissions, slaBreaches] = await Promise.all([
        (prisma as any).salesRep.findMany({
            where: { organizationId: ctx.orgId, active: true },
            select: {
                id: true,
                name: true,
                role: true,
                active: true,
                _count: { select: { assignments: { where: { status: "active" } } } },
                targets: {
                    where: { month },
                    take: 1,
                    select: { month: true, targetCents: true },
                },
            },
            orderBy: [{ role: "asc" }, { name: "asc" }],
        }),
        getLeaderboard(ctx.orgId, month),
        getCommissionSummary(ctx.orgId, month),
        scanSLABreaches(ctx.orgId, 48)
    ]);

    // SLA Summary
    const slaSummary = {
        totalBreaches: slaBreaches.length,
        topRiskReps: Array.from(new Set(slaBreaches.map(b => b.repName))).slice(0, 3),
        oldestAgeHours: slaBreaches.length > 0 ? Math.max(...slaBreaches.map(b => b.hoursStalled)) : 0
    };

    return NextResponse.json({
        team: reps,
        leaderboard,
        commissions: {
            summary: commissions,
            pendingTotal: commissions.reduce((s: number, c: any) => s + c.pendingCents, 0),
            paidTotal: commissions.reduce((s: number, c: any) => s + c.paidCents, 0)
        },
        sla: slaSummary
    });
}

export const GET = withApiLogging("/api/org/[slug]/sales/overview", "GET", GETHandler);
