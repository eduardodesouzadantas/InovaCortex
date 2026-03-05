import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { getLeaderboard, getCommissionSummary } from "@/lib/sales/stats-engine";
import { scanSLABreaches } from "@/lib/sales/sla-engine";

const getOrg = async (slug: string) =>
    prisma.organization.findUnique({ where: { slug }, select: { id: true } });

export async function GET(req: Request, { params }: { params: { slug: string } }) {
    const session = await getSession();
    if (!session || session.orgSlug !== params.slug) {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const org = await getOrg(params.slug);
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const month = new Date().toISOString().slice(0, 7);

    // Parallel data fetching for the executive overview
    const [reps, leaderboard, commissions, slaBreaches] = await Promise.all([
        (prisma as any).salesRep.findMany({
            where: { organizationId: org.id },
            include: {
                _count: { select: { assignments: { where: { status: "active" } } } },
                targets: { where: { month }, take: 1 }
            }
        }),
        getLeaderboard(org.id, month),
        getCommissionSummary(org.id, month),
        scanSLABreaches(org.id, 48)
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
