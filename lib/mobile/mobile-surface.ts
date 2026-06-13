import { buildTenantExecutiveDashboard, type ExecutiveDashboardModel } from "@/lib/executive/tenant-intelligence";
import { listPublicConversations, listPublicDeals, type PublicApiConversationItem, type PublicApiDealItem } from "@/lib/public-api/v1-service";

export type MobileInboxChannel = "whatsapp" | "email";

export type MobileInboxItem = {
    id: string;
    channel: MobileInboxChannel;
    title: string;
    preview: string;
    status: string;
    unreadCount: number;
    lastMessageAt: string | null;
    contactName: string | null;
    contactEmail: string | null;
    replyHint: string;
    conversationId: string | null;
    threadId: string | null;
    dealId: string | null;
};

export type MobileCommandSurfaceModel = {
    org: ExecutiveDashboardModel["org"];
    generatedAt: string;
    overview: ExecutiveDashboardModel["overview"];
    decisionNarrative: ExecutiveDashboardModel["decisionNarrative"];
    summaryCards: ExecutiveDashboardModel["summaryCards"];
    prioritizedAlerts: ExecutiveDashboardModel["prioritizedAlerts"];
    inboxItems: MobileInboxItem[];
    recentDeals: PublicApiDealItem[];
};

function toIso(value: Date | null | undefined): string | null {
    return value ? value.toISOString() : null;
}

function mapWhatsappConversation(item: PublicApiConversationItem): MobileInboxItem {
    return {
        id: item.id,
        channel: "whatsapp",
        title: item.title,
        preview: item.lastMessagePreview ?? item.subject ?? "Sem preview recente",
        status: item.status,
        unreadCount: item.unreadCount,
        lastMessageAt: item.lastMessageAt,
        contactName: item.contact?.name ?? null,
        contactEmail: item.contact?.email ?? null,
        replyHint: "Envia no WhatsApp",
        conversationId: item.id,
        threadId: null,
        dealId: null,
    };
}

function mapEmailConversation(item: PublicApiConversationItem): MobileInboxItem {
    return {
        id: item.id,
        channel: "email",
        title: item.title,
        preview: item.lastMessagePreview ?? item.subject ?? "Sem preview recente",
        status: item.status,
        unreadCount: item.unreadCount,
        lastMessageAt: item.lastMessageAt,
        contactName: item.contact?.name ?? null,
        contactEmail: item.contact?.email ?? null,
        replyHint: "Registra follow-up do email",
        conversationId: null,
        threadId: item.threadId,
        dealId: null,
    };
}

function mergeByFreshness(items: MobileInboxItem[]): MobileInboxItem[] {
    return [...items].sort((left, right) => {
        const leftAt = left.lastMessageAt ? new Date(left.lastMessageAt).getTime() : 0;
        const rightAt = right.lastMessageAt ? new Date(right.lastMessageAt).getTime() : 0;
        return rightAt - leftAt;
    });
}

export async function loadMobileCommandSurface(input: {
    organizationId: string;
    organizationSlug: string;
}): Promise<MobileCommandSurfaceModel | null> {
    const dashboard = await buildTenantExecutiveDashboard(input.organizationSlug);
    if (!dashboard) {
        return null;
    }

    const [publicConversations, publicDeals] = await Promise.all([
        listPublicConversations({
            organizationId: input.organizationId,
            offset: 0,
            limit: 12,
        }).catch(() => ({
            items: [],
            pagination: {
                limit: 12,
                total: 0,
                returnedCount: 0,
                hasNextPage: false,
                nextCursor: null,
            },
            summary: {
                total: 0,
                whatsapp: 0,
                email: 0,
            },
        })),
        listPublicDeals({
            organizationId: input.organizationId,
            offset: 0,
            limit: 6,
        }).catch(() => ({
            items: [],
            pagination: {
                limit: 6,
                total: 0,
                returnedCount: 0,
                hasNextPage: false,
                nextCursor: null,
            },
        })),
    ]);

    const inboxItems = mergeByFreshness([
        ...publicConversations.items
            .filter((item) => item.channel === "whatsapp")
            .map(mapWhatsappConversation),
        ...publicConversations.items
            .filter((item) => item.channel === "email")
            .map(mapEmailConversation),
    ]).slice(0, 18);

    return {
        org: dashboard.org,
        generatedAt: dashboard.generatedAt,
        overview: dashboard.overview,
        decisionNarrative: dashboard.decisionNarrative,
        summaryCards: dashboard.summaryCards,
        prioritizedAlerts: dashboard.prioritizedAlerts,
        inboxItems,
        recentDeals: publicDeals.items,
    };
}
