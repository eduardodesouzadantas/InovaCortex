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
    // 1. Fetch conversations with assigned users
    const convos = await prisma.whatsAppConversation.findMany({
        where: { organizationId: orgId, assignedUserId: { not: null } },
        include: { user: true }
    });

    const conversationIds = convos.map((c) => c.id);
    const messages = conversationIds.length === 0
        ? []
        : await prisma.whatsAppMessage.findMany({
            where: { conversationId: { in: conversationIds } },
            select: { conversationId: true, direction: true, createdAt: true },
            orderBy: { createdAt: "asc" }
        });

    const messagesByConversation = new Map<string, Array<{ direction: string; createdAt: Date }>>();
    for (const msg of messages) {
        const list = messagesByConversation.get(msg.conversationId) ?? [];
        list.push({ direction: msg.direction, createdAt: msg.createdAt });
        messagesByConversation.set(msg.conversationId, list);
    }

    const userMap = new Map<string, { name: string; total: number; open: number; responseTotal: number; responseCount: number }>();

    for (const c of convos) {
        if (!c.assignedUserId || !c.user) continue;

        const userName = typeof c.user.email === "string" && c.user.email.includes("@")
            ? c.user.email.split("@")[0]
            : "agent";

        const existing = userMap.get(c.assignedUserId) || {
            name: userName,
            total: 0,
            open: 0,
            responseTotal: 0,
            responseCount: 0,
        };

        existing.total++;
        if (c.status === "open") existing.open++;

        // Deterministic response metric: first outbound after first inbound, per conversation.
        const convoMessages = messagesByConversation.get(c.id) ?? [];
        const firstInbound = convoMessages.find((m) => m.direction === "inbound");
        const firstOutboundAfterInbound = firstInbound
            ? convoMessages.find((m) => m.direction === "outbound" && m.createdAt >= firstInbound.createdAt)
            : undefined;

        if (firstInbound && firstOutboundAfterInbound) {
            const minutes = Math.max(
                1,
                Math.round((firstOutboundAfterInbound.createdAt.getTime() - firstInbound.createdAt.getTime()) / 60000)
            );
            existing.responseTotal += minutes;
            existing.responseCount += 1;
        }

        userMap.set(c.assignedUserId, existing);
    }

    return Array.from(userMap.entries()).map(([userId, stats]) => ({
        userId,
        name: stats.name,
        totalConversations: stats.total,
        openConversations: stats.open,
        avgResponseTimeMinutes: stats.responseCount > 0
            ? Math.round(stats.responseTotal / stats.responseCount)
            : 0,
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
