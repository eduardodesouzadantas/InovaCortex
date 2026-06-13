import { prisma } from "@/lib/prisma";

/**
 * Ensures an inbound message from a Contact is routed to an appropriate agent.
 * Respects existing open conversation assignments.
 * 
 * @param contactId Internal Contact ID
 * @param orgId Organization ID
 * @returns The assigned `userId` or null if no active agents are available.
 */
export async function routeInbound(contactId: string, orgId: string): Promise<string | null> {
    // 1. Fetch the Contact and any open conversation
    const contact = await prisma.contact.findFirst({
        where: {
            id: contactId,
            organizationId: orgId,
        },
        include: {
            conversations: {
                where: { status: "open" },
                orderBy: { createdAt: "desc" },
                take: 1
            }
        }
    });

    if (!contact) return null;

    const activeConvo = contact.conversations[0];

    // If there's an active conversation with an assignee, preserve the routing
    if (activeConvo && activeConvo.assignedUserId) {
        return activeConvo.assignedUserId;
    }

    // 2. Find eligible active WhatsAppUsers in the Org who are mapped to a System User
    const activeAgents = await prisma.whatsAppUser.findMany({
        where: {
            organizationId: orgId,
            active: true,
            userId: { not: null } // Must have a linked platform user
        },
        select: {
            userId: true
        }
    });

    if (activeAgents.length === 0) {
        // Fallback: No active WhatsApp agents found mapped to platform users. 
        // Can optionally fallback to Org Owner, but returning null leaves it in an "Unassigned" pool.
        return null;
    }

    // 3. Load-balanced assignment (Least Busy)
    // Find the number of open conversations per agent
    const agentStats = await prisma.whatsAppConversation.groupBy({
        by: ['assignedUserId'],
        where: {
            organizationId: orgId,
            status: "open",
            assignedUserId: { in: activeAgents.map(a => a.userId as string) }
        },
        _count: {
            id: true
        }
    });

    // Create a map of userId -> open count (default 0)
    const loadMap = new Map<string, number>();
    for (const agent of activeAgents) {
        loadMap.set(agent.userId as string, 0);
    }

    for (const stat of agentStats) {
        if (stat.assignedUserId) {
            loadMap.set(stat.assignedUserId, stat._count.id);
        }
    }

    // Sort to find the agent with the lowest number of open tickets
    let selectedUserId: string | null = null;
    let minLoad = Infinity;

    for (const [userId, count] of Array.from(loadMap.entries())) {
        if (count < minLoad) {
            minLoad = count;
            selectedUserId = userId;
        }
    }

    return selectedUserId;
}
