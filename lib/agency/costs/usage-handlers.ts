/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { currentMonth, recalculateMonthlySnapshot } from "@/lib/usage";

export async function recalculateUsageSnapshot(input: {
    orgId: string;
    month?: string;
}): Promise<{ success: true; month: string; snapshot: unknown }> {
    const month = input.month ?? currentMonth();

    await recalculateMonthlySnapshot(input.orgId, month);
    const snapshot = await (prisma as any).monthlyUsageSnapshot.findUnique({
        where: { organizationId_month: { organizationId: input.orgId, month } },
    });

    return { success: true, month, snapshot };
}

export async function readUsageSnapshotOrLive(input: {
    orgId: string;
    month?: string;
}): Promise<{ month: string; snapshot: unknown; liveCounts: Record<string, number> }> {
    const month = input.month ?? currentMonth();

    const snapshot = await (prisma as any).monthlyUsageSnapshot.findUnique({
        where: { organizationId_month: { organizationId: input.orgId, month } },
    });

    const startOfMonth = new Date(`${month}-01T00:00:00.000Z`);
    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1);

    const live = await (prisma as any).usageEvent.groupBy({
        by: ["type"],
        where: {
            organizationId: input.orgId,
            createdAt: { gte: startOfMonth, lt: endOfMonth },
        },
        _sum: { quantity: true },
    });

    const liveCounts: Record<string, number> = {};
    for (const row of live) {
        liveCounts[row.type] = row._sum.quantity ?? 0;
    }

    return { month, snapshot, liveCounts };
}
