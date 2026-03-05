import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { recalculateMonthlySnapshot, currentMonth } from "@/lib/usage";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * POST /api/admin/usage/recalculate?month=YYYY-MM
 * Recalculates and upserts the MonthlyUsageSnapshot for all orgs (or specific org).
 * Admin-only endpoint.
 */
export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session || !["owner", "admin"].includes(session.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") ?? currentMonth();
    const orgScope = searchParams.get("org") ?? session.orgId;

    try {
        await recalculateMonthlySnapshot(orgScope, month);
        logger.info("Monthly snapshot recalculated", { orgId: orgScope, month });

        const snapshot = await (prisma as any).monthlyUsageSnapshot.findUnique({
            where: { organizationId_month: { organizationId: orgScope, month } }
        });

        return NextResponse.json({ success: true, month, snapshot });
    } catch (err) {
        logger.error("Failed to recalculate snapshot", { error: String(err) });
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}

/**
 * GET /api/admin/usage/recalculate
 * Returns current month snapshot or live event counts.
 */
export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") ?? currentMonth();
    const orgId = session.orgId;

    const snapshot = await (prisma as any).monthlyUsageSnapshot.findUnique({
        where: { organizationId_month: { organizationId: orgId, month } }
    });

    // Fall back to live counts if snapshot not yet generated
    const startOfMonth = new Date(month + "-01T00:00:00.000Z");
    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1);

    const live = await (prisma as any).usageEvent.groupBy({
        by: ["type"],
        where: { organizationId: orgId, createdAt: { gte: startOfMonth, lt: endOfMonth } },
        _sum: { quantity: true },
    });

    const liveCounts: Record<string, number> = {};
    for (const row of live) {
        liveCounts[row.type] = row._sum.quantity ?? 0;
    }

    return NextResponse.json({ month, snapshot, liveCounts });
}
