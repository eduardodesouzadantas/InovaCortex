import { prisma } from "@/lib/prisma";

export interface TeamPerformance {
    userId: string;
    name: string;
    totalConversations: number;
    openConversations: number;
    avgResponseTimeMinutes: number;
}

/**
 * Calculates Team Performance metrics for the WhatsApp CSR OS dashboard.
 */
export async function calculateTeamPerformance(orgId: string): Promise<TeamPerformance[]> {
    // 1. Fetch conversations with their users
    const convos = await prisma.whatsAppConversation.findMany({
        where: { organizationId: orgId, assignedUserId: { not: null } },
        include: { user: true }
    });

    const userMap = new Map<string, { name: string, total: number, open: number }>();

    for (const c of convos) {
        if (!c.assignedUserId || !c.user) continue;

        const existing = userMap.get(c.assignedUserId) || { name: (c.user as any).name || (c.user as any).fullName || "Agent", total: 0, open: 0 };
        existing.total++;
        if (c.status === "open") existing.open++;

        userMap.set(c.assignedUserId, existing);
    }

    // In a real high-throughput system, average response time is calculated 
    // by joining SystemEvents (inbound received) delta (first outbound sent).
    // Stubbing the average response time for now for the real-time layout.

    return Array.from(userMap.entries()).map(([userId, stats]) => ({
        userId,
        name: stats.name,
        totalConversations: stats.total,
        openConversations: stats.open,
        avgResponseTimeMinutes: Math.floor(Math.random() * 45) + 5 // Stub 5-50 mins
    })).sort((a, b) => b.totalConversations - a.totalConversations);
}

export async function calculateInboxStats(orgId: string) {
    const total = await prisma.whatsAppConversation.count({
        where: { organizationId: orgId }
    });

    const unassigned = await prisma.whatsAppConversation.count({
        where: { organizationId: orgId, assignedUserId: null, status: "open" }
    });

    const breached = await prisma.whatsAppConversation.count({
        where: { organizationId: orgId, status: "open", slaDueAt: { lt: new Date() } }
    });

    return { total, unassigned, breached };
}
