export type WarRoomSummary = {
    activeTenants: number;
    activeCampaigns: number;
    scheduledPosts: number;
    publishedPosts: number;
    openDeals: number;
    weightedPipeline: number;
    forecast30d: number;
    criticalAlerts: number;
    highPriorityOpportunities: number;
    eventBusStatus: "healthy" | "warning" | "critical";
    systemHealth: "healthy" | "warning" | "critical";
    lastAnalyticsRun: string | null;
    lastOptimizerRun: string | null;
};

export type WarRoomModuleStatus = {
    module: "marketing" | "sales" | "revenue" | "events" | "playbooks" | "publishing";
    status: "healthy" | "warning" | "critical";
    summary: string;
};

export type WarRoomRisk = {
    tenantId: string;
    slug: string;
    category: string;
    severity: "low" | "medium" | "high" | "critical";
    title: string;
    description: string;
    recommendedAction: string;
};

export type WarRoomOpportunity = {
    tenantId: string;
    slug: string;
    category: string;
    priority: "low" | "medium" | "high" | "critical";
    title: string;
    description: string;
    recommendedAction: string;
    confidence: number;
};

export type WarRoomAlert = {
    source: string;
    severity: "low" | "medium" | "high" | "critical";
    title: string;
    description: string;
    createdAt: string;
};

export type WarRoomTopDeal = {
    dealId: string;
    tenantId: string;
    slug: string;
    organizationName: string;
    stage: string;
    salesScore: number;
    closeProbability: number;
    estimatedValue: number;
    recommendedNextAction: string;
};

export type WarRoomTopCampaign = {
    campaignId: string;
    tenantId: string;
    slug: string;
    name: string;
    status: string;
    objective: string;
    scheduledPosts: number;
    publishedPosts: number;
    insightCount: number;
};

export type WarRoomSnapshot = {
    summary: WarRoomSummary;
    modulesStatus: WarRoomModuleStatus[];
    risks: WarRoomRisk[];
    opportunities: WarRoomOpportunity[];
    alerts: WarRoomAlert[];
    topDeals: WarRoomTopDeal[];
    topCampaigns: WarRoomTopCampaign[];
};

export async function generateWarRoomSnapshot(_input: {
    agencyOrganizationId: string;
    actorUserId: string;
    requestId: string;
    now?: Date;
}): Promise<WarRoomSnapshot> {
    return {
        summary: {
            activeTenants: 0,
            activeCampaigns: 0,
            scheduledPosts: 0,
            publishedPosts: 0,
            openDeals: 0,
            weightedPipeline: 0,
            forecast30d: 0,
            criticalAlerts: 0,
            highPriorityOpportunities: 0,
            eventBusStatus: "healthy",
            systemHealth: "healthy",
            lastAnalyticsRun: null,
            lastOptimizerRun: null,
        },
        modulesStatus: [
            { module: "marketing", status: "healthy", summary: "No incidents detected." },
            { module: "sales", status: "healthy", summary: "No incidents detected." },
            { module: "revenue", status: "healthy", summary: "No incidents detected." },
            { module: "events", status: "healthy", summary: "No incidents detected." },
            { module: "playbooks", status: "healthy", summary: "No incidents detected." },
            { module: "publishing", status: "healthy", summary: "No incidents detected." },
        ],
        risks: [],
        opportunities: [],
        alerts: [],
        topDeals: [],
        topCampaigns: [],
    };
}
