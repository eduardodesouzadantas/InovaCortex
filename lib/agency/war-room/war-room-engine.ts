import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

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
    revenueToday: number;
    revenueThisMonth: number;
    pipelineValue: number;
    activeDeals: number;
    conversionRate: number;
    summary: WarRoomSummary;
    modulesStatus: WarRoomModuleStatus[];
    risks: WarRoomRisk[];
    opportunities: WarRoomOpportunity[];
    alerts: WarRoomAlert[];
    topDeals: WarRoomTopDeal[];
    topCampaigns: WarRoomTopCampaign[];
};

export type WarRoomRefreshResult = {
    agencyOrganizationId: string;
    generatedAt: string;
    summary: WarRoomSummary;
};

type MaterializedCampaignPerformance = CampaignPerf & {
    activeTenants: number;
    lastAnalyticsRun: string | null;
    lastOptimizerRun: string | null;
};

type MaterializedRiskSignals = {
    risks: WarRoomRisk[];
};

type MaterializedWarRoomSnapshotRow = {
    id: string;
    organizationId: string;
    revenueToday: number;
    revenueThisMonth: number;
    pipelineValue: number;
    activeDeals: number;
    conversionRate: number;
    campaignPerformance: string;
    riskAlerts: string;
    profitLeakSignals: string;
    createdAt: Date;
};

type OrgRow = { id: string; slug: string; name: string };
type CampaignPerf = {
    activeCampaigns: number;
    scheduledPosts: number;
    publishedPosts: number;
    sentMessages: number;
    failedMessages: number;
};
const ACTIVE_DEALS = new Set(["draft", "sent", "viewed", "meeting_booked"]);
const BAD_STATES = new Set(["lost", "won", "cancelled", "canceled"]);

const n = (v: unknown): number => {
    const x = typeof v === "number" ? v : Number(v ?? 0);
    return Number.isFinite(x) ? x : 0;
};
const toObj = (raw: unknown): Record<string, unknown> => {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
    if (typeof raw !== "string" || !raw.trim()) return {};
    try { const p = JSON.parse(raw); return p && typeof p === "object" && !Array.isArray(p) ? p as Record<string, unknown> : {}; } catch { return {}; }
};
const lv = (v: string): "low" | "medium" | "high" | "critical" => (v === "critical" || v === "high" || v === "medium" || v === "low") ? v : (v === "warning" ? "medium" : "low");
const hs = (critical: number, warning: number): "healthy" | "warning" | "critical" => critical > 0 ? "critical" : warning > 0 ? "warning" : "healthy";
const f = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
const rec = (stage: string) => stage === "viewed" ? "follow_up_with_case_study" : stage === "sent" ? "schedule_strategy_call" : stage === "meeting_booked" ? "prepare_closing_meeting" : "advance_pipeline";
const rank = (s: string): number => s === "critical" ? 4 : s === "high" ? 3 : s === "medium" ? 2 : 1;
const meetingKey = (organizationId: string, assessmentId: string) => `${organizationId}:${assessmentId}`;

function parseMaterializedCampaignPerformance(raw: string): MaterializedCampaignPerformance {
    const parsed = toObj(raw);
    return {
        activeCampaigns: n(parsed.activeCampaigns),
        scheduledPosts: n(parsed.scheduledPosts),
        publishedPosts: n(parsed.publishedPosts),
        sentMessages: n(parsed.sentMessages),
        failedMessages: n(parsed.failedMessages),
        activeTenants: n(parsed.activeTenants),
        lastAnalyticsRun: typeof parsed.lastAnalyticsRun === "string" ? parsed.lastAnalyticsRun : null,
        lastOptimizerRun: typeof parsed.lastOptimizerRun === "string" ? parsed.lastOptimizerRun : null,
    };
}

function parseMaterializedAlerts(raw: string): WarRoomAlert[] {
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((item): item is WarRoomAlert => Boolean(item && typeof item === "object"));
    } catch {
        return [];
    }
}

function parseMaterializedSignals(raw: string): MaterializedRiskSignals {
    const parsed = toObj(raw);
    const risks = Array.isArray(parsed.risks)
        ? parsed.risks.filter((item): item is WarRoomRisk => Boolean(item && typeof item === "object"))
        : [];
    return { risks };
}

function buildWarRoomSummaryFromMaterialized(input: {
    row: MaterializedWarRoomSnapshotRow;
    campaignPerformance: MaterializedCampaignPerformance;
    alerts: WarRoomAlert[];
    risks: WarRoomRisk[];
}): WarRoomSummary {
    const criticalAlerts = input.alerts.filter((alert) => alert.severity === "critical").length;
    const warningAlerts = input.alerts.filter((alert) => alert.severity === "high" || alert.severity === "medium").length;
    const publishRate = input.campaignPerformance.scheduledPosts > 0
        ? input.campaignPerformance.publishedPosts / input.campaignPerformance.scheduledPosts
        : 1;
    const marketing = publishRate < 0.4 ? "critical" : publishRate < 0.7 ? "warning" : "healthy";
    const sales = input.row.conversionRate < 12 ? "critical" : input.row.conversionRate < 22 ? "warning" : "healthy";
    const revenue = input.row.revenueThisMonth <= 0 && input.row.pipelineValue <= 0
        ? "critical"
        : (input.row.revenueToday <= 0 && input.row.activeDeals > 0 ? "warning" : "healthy");
    const events = hs(criticalAlerts, warningAlerts);
    const publishing = input.campaignPerformance.scheduledPosts > input.campaignPerformance.publishedPosts * 2
        ? "critical"
        : (input.campaignPerformance.scheduledPosts > input.campaignPerformance.publishedPosts ? "warning" : "healthy");
    const moduleStatuses = [marketing, sales, revenue, events, "healthy", publishing];
    const moduleCritical = moduleStatuses.filter((status) => status === "critical").length;
    const moduleWarning = moduleStatuses.filter((status) => status === "warning").length;

    return {
        activeTenants: input.campaignPerformance.activeTenants,
        activeCampaigns: input.campaignPerformance.activeCampaigns,
        scheduledPosts: input.campaignPerformance.scheduledPosts,
        publishedPosts: input.campaignPerformance.publishedPosts,
        openDeals: input.row.activeDeals,
        weightedPipeline: Math.round(input.row.pipelineValue),
        forecast30d: Math.round(input.row.revenueThisMonth + (input.row.pipelineValue * (input.row.conversionRate / 100))),
        criticalAlerts,
        highPriorityOpportunities: 0,
        eventBusStatus: hs(criticalAlerts, warningAlerts),
        systemHealth: hs(moduleCritical, moduleWarning),
        lastAnalyticsRun: input.campaignPerformance.lastAnalyticsRun,
        lastOptimizerRun: input.campaignPerformance.lastOptimizerRun,
    };
}

function buildWarRoomModulesFromMaterialized(input: {
    row: MaterializedWarRoomSnapshotRow;
    campaignPerformance: MaterializedCampaignPerformance;
    alerts: WarRoomAlert[];
    risks: WarRoomRisk[];
}): WarRoomModuleStatus[] {
    const publishRate = input.campaignPerformance.scheduledPosts > 0
        ? input.campaignPerformance.publishedPosts / input.campaignPerformance.scheduledPosts
        : 1;
    const criticalAlerts = input.alerts.filter((alert) => alert.severity === "critical").length;
    const warningAlerts = input.alerts.filter((alert) => alert.severity === "high" || alert.severity === "medium").length;

    return [
        {
            module: "marketing",
            status: publishRate < 0.4 ? "critical" : publishRate < 0.7 ? "warning" : "healthy",
            summary: `Campanhas ativas: ${input.campaignPerformance.activeCampaigns} | entrega ${Math.round(publishRate * 100)}%`,
        },
        {
            module: "sales",
            status: input.row.conversionRate < 12 ? "critical" : input.row.conversionRate < 22 ? "warning" : "healthy",
            summary: `Deals ativos: ${input.row.activeDeals} | conversao ${input.row.conversionRate.toFixed(1)}%`,
        },
        {
            module: "revenue",
            status: input.row.revenueThisMonth <= 0 && input.row.pipelineValue <= 0
                ? "critical"
                : (input.row.revenueToday <= 0 && input.row.activeDeals > 0 ? "warning" : "healthy"),
            summary: `Hoje: ${f(input.row.revenueToday)} | Mes: ${f(input.row.revenueThisMonth)}`,
        },
        {
            module: "events",
            status: hs(criticalAlerts, warningAlerts),
            summary: `Alertas monitorados: ${input.alerts.length} | riscos: ${input.risks.length}`,
        },
        {
            module: "playbooks",
            status: "healthy",
            summary: `${input.risks.length} sinais materializados para revisao executiva.`,
        },
        {
            module: "publishing",
            status: input.campaignPerformance.scheduledPosts > input.campaignPerformance.publishedPosts * 2
                ? "critical"
                : (input.campaignPerformance.scheduledPosts > input.campaignPerformance.publishedPosts ? "warning" : "healthy"),
            summary: `Posts publicados ${input.campaignPerformance.publishedPosts}/${input.campaignPerformance.scheduledPosts}.`,
        },
    ];
}

function materializeWarRoomSnapshot(snapshot: WarRoomSnapshot): {
    revenueToday: number;
    revenueThisMonth: number;
    pipelineValue: number;
    activeDeals: number;
    conversionRate: number;
    campaignPerformance: string;
    riskAlerts: string;
    profitLeakSignals: string;
} {
    return {
        revenueToday: snapshot.revenueToday,
        revenueThisMonth: snapshot.revenueThisMonth,
        pipelineValue: snapshot.pipelineValue,
        activeDeals: snapshot.activeDeals,
        conversionRate: snapshot.conversionRate,
        campaignPerformance: JSON.stringify({
            activeCampaigns: snapshot.summary.activeCampaigns,
            scheduledPosts: snapshot.summary.scheduledPosts,
            publishedPosts: snapshot.summary.publishedPosts,
            sentMessages: snapshot.summary.publishedPosts,
            failedMessages: 0,
            activeTenants: snapshot.summary.activeTenants,
            lastAnalyticsRun: snapshot.summary.lastAnalyticsRun,
            lastOptimizerRun: snapshot.summary.lastOptimizerRun,
        }),
        riskAlerts: JSON.stringify(snapshot.alerts),
        profitLeakSignals: JSON.stringify({
            risks: snapshot.risks,
        }),
    };
}

export async function getLatestWarRoomSnapshot(organizationId: string): Promise<WarRoomSnapshot | null> {
    const row = await (prisma as any).warRoomSnapshot.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            organizationId: true,
            revenueToday: true,
            revenueThisMonth: true,
            pipelineValue: true,
            activeDeals: true,
            conversionRate: true,
            campaignPerformance: true,
            riskAlerts: true,
            profitLeakSignals: true,
            createdAt: true,
        },
    }) as MaterializedWarRoomSnapshotRow | null;

    if (!row) return null;

    const campaignPerformance = parseMaterializedCampaignPerformance(row.campaignPerformance);
    const alerts = parseMaterializedAlerts(row.riskAlerts);
    const risks = parseMaterializedSignals(row.profitLeakSignals).risks;

    return {
        revenueToday: row.revenueToday,
        revenueThisMonth: row.revenueThisMonth,
        pipelineValue: row.pipelineValue,
        activeDeals: row.activeDeals,
        conversionRate: row.conversionRate,
        summary: buildWarRoomSummaryFromMaterialized({ row, campaignPerformance, alerts, risks }),
        modulesStatus: buildWarRoomModulesFromMaterialized({ row, campaignPerformance, alerts, risks }),
        risks,
        opportunities: [],
        alerts,
        topDeals: [],
        topCampaigns: [],
    };
}

export async function generateWarRoomSnapshot(input: {
    agencyOrganizationId: string;
    actorUserId: string;
    requestId: string;
    now?: Date;
}): Promise<WarRoomSnapshot> {
    const startedAt = Date.now();

    // Deal -> DealPacket | Campaign -> WhatsAppCampaign | Lead -> Prospect
    // SalesActivity -> MeetingSession/DealSignal | OrganizationMetrics -> PerformanceSnapshot/MonthlyUsageSnapshot
    const orgs = await (prisma as any).organization.findMany({
        select: { id: true, slug: true, name: true },
        orderBy: { createdAt: "asc" },
    }) as OrgRow[];
    const tenants = orgs.filter((o) => o.id !== input.agencyOrganizationId);
    const scoped = tenants.length > 0 ? tenants : orgs.filter((o) => o.id === input.agencyOrganizationId);
    const orgIds = scoped.map((o) => o.id);
    const orgMap = new Map(scoped.map((o) => [o.id, o]));
    if (orgIds.length === 0) return { revenueToday: 0, revenueThisMonth: 0, pipelineValue: 0, activeDeals: 0, conversionRate: 0, summary: { activeTenants: 0, activeCampaigns: 0, scheduledPosts: 0, publishedPosts: 0, openDeals: 0, weightedPipeline: 0, forecast30d: 0, criticalAlerts: 0, highPriorityOpportunities: 0, eventBusStatus: "healthy", systemHealth: "healthy", lastAnalyticsRun: null, lastOptimizerRun: null }, modulesStatus: [], risks: [], opportunities: [], alerts: [], topDeals: [], topCampaigns: [] };

    const now = input.now ?? new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
        dealStatusRows,
        activeDealsRaw,
        meetings,
        revenueMonthAgg,
        revenueTodayAgg,
        campaigns,
        leadStatusRows,
        profitLeaks,
        alertEvents,
        systemEvents,
        growthSignals,
        perfSnapshotAgg,
        usageSnapshotAgg,
    ] = await Promise.all([
        (prisma as any).dealPacket.groupBy({ by: ["status"], where: { orgId: { in: orgIds } }, _count: { id: true } }),
        (prisma as any).dealPacket.findMany({ where: { orgId: { in: orgIds }, status: { in: [...ACTIVE_DEALS] } }, select: { id: true, orgId: true, assessmentId: true, status: true, tier: true }, orderBy: { updatedAt: "desc" }, take: 120 }),
        (prisma as any).meetingSession.findMany({ where: { organizationId: { in: orgIds }, OR: [{ status: { in: ["scheduled", "confirmed", "rescheduled", "active", "pending"] } }, { updatedAt: { gte: d30 } }] }, select: { organizationId: true, assessmentId: true, status: true, expectedRevenue: true, closeProbability: true, adjustedProbability: true }, take: 1200, orderBy: { updatedAt: "desc" } }),
        (prisma as any).meetingPerformance.aggregate({ where: { organizationId: { in: orgIds }, outcome: "won", createdAt: { gte: startMonth } }, _sum: { closedValue: true } }),
        (prisma as any).meetingPerformance.aggregate({ where: { organizationId: { in: orgIds }, outcome: "won", createdAt: { gte: startDay } }, _sum: { closedValue: true } }),
        (prisma as any).whatsAppCampaign.findMany({ where: { organizationId: { in: orgIds } }, select: { id: true, organizationId: true, name: true, status: true, segmentQuery: true, stats: true, template: { select: { category: true } } }, orderBy: { updatedAt: "desc" }, take: 200 }),
        (prisma as any).prospect.groupBy({ by: ["orgId", "status"], where: { orgId: { in: orgIds } }, _count: { _all: true } }),
        (prisma as any).profitLeak.findMany({ where: { orgId: { in: orgIds }, status: "open" }, select: { orgId: true, kind: true, severity: true, title: true, description: true, estimatedLossCents: true }, orderBy: { updatedAt: "desc" }, take: 160 }),
        (prisma as any).alertEvent.findMany({ where: { organizationId: { in: orgIds }, resolved: false }, select: { organizationId: true, type: true, severity: true, message: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 160 }),
        (prisma as any).systemEvent.findMany({ where: { organizationId: { in: orgIds }, createdAt: { gte: d30 }, severity: { in: ["warning", "high", "critical"] } }, select: { organizationId: true, type: true, severity: true, message: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 220 }),
        (prisma as any).growthSignal.findMany({ where: { organizationId: { in: orgIds } }, select: { organizationId: true, type: true, severity: true, message: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 120 }),
        (prisma as any).performanceSnapshot.aggregate({ where: { organizationId: { in: orgIds } }, _max: { createdAt: true } }),
        (prisma as any).monthlyUsageSnapshot.aggregate({ where: { organizationId: { in: orgIds } }, _max: { updatedAt: true } }),
    ]);

    const campaignIds = campaigns.map((c: any) => c.id);
    const sendRows = campaignIds.length > 0
        ? await (prisma as any).whatsAppCampaignSend.groupBy({ by: ["campaignId", "status"], where: { campaignId: { in: campaignIds } }, _count: { _all: true } })
        : [];
    const sendMap = new Map<string, { sent: number; failed: number }>();
    for (const row of sendRows) {
        const curr = sendMap.get(row.campaignId) ?? { sent: 0, failed: 0 };
        const cnt = n(row._count?._all);
        if (String(row.status ?? "").toLowerCase() === "failed") curr.failed += cnt; else curr.sent += cnt;
        sendMap.set(row.campaignId, curr);
    }

    let activeDeals = 0, wonDeals = 0, lostDeals = 0;
    for (const row of dealStatusRows) {
        const status = String(row.status ?? "").toLowerCase();
        const cnt = n(row._count?.id ?? row._count?._all);
        if (ACTIVE_DEALS.has(status)) activeDeals += cnt;
        if (status === "won") wonDeals += cnt;
        if (status === "lost") lostDeals += cnt;
    }
    const conversionRate = wonDeals + lostDeals > 0
        ? (wonDeals / (wonDeals + lostDeals)) * 100
        : (leadStatusRows.reduce((s: number, r: any) => s + n(r._count?._all), 0) > 0
            ? (leadStatusRows.filter((r: any) => String(r.status ?? "").toLowerCase() === "meeting").reduce((s: number, r: any) => s + n(r._count?._all), 0)
                / leadStatusRows.reduce((s: number, r: any) => s + n(r._count?._all), 0)) * 100
            : 0);

    const revenueToday = n(revenueTodayAgg._sum?.closedValue);
    const revenueThisMonth = n(revenueMonthAgg._sum?.closedValue);
    const pipelineValue = meetings.reduce((s: number, m: any) => {
        const st = String(m.status ?? "").toLowerCase();
        if (BAD_STATES.has(st)) return s;
        const p = Math.max(0, Math.min(1, n(m.adjustedProbability) || n(m.closeProbability) || 0.35));
        return s + (n(m.expectedRevenue) * p);
    }, 0);

    const bestMeetingByAssessment = new Map<string, any>();
    for (const meeting of meetings) {
        if (!meeting.assessmentId) continue;
        const key = meetingKey(meeting.organizationId, meeting.assessmentId);
        const score = n(meeting.expectedRevenue) * (n(meeting.adjustedProbability) || n(meeting.closeProbability) || 0.35);
        const existing = bestMeetingByAssessment.get(key);
        const existingScore = existing
            ? n(existing.expectedRevenue) * (n(existing.adjustedProbability) || n(existing.closeProbability) || 0.35)
            : -1;
        if (!existing || score > existingScore) {
            bestMeetingByAssessment.set(key, meeting);
        }
    }

    const campaignPerformance = campaigns.reduce((acc: CampaignPerf, c: any) => {
        const status = String(c.status ?? "").toLowerCase();
        if (["active", "running", "scheduled", "queued", "in_progress"].includes(status)) acc.activeCampaigns += 1;
        const stats = toObj(c.stats);
        const scheduled = n(stats.scheduledPosts ?? stats.scheduled ?? stats.scheduled_count);
        const published = n(stats.publishedPosts ?? stats.published ?? stats.sent ?? stats.delivered);
        const send = sendMap.get(c.id);
        acc.scheduledPosts += scheduled > 0 ? scheduled : (status === "scheduled" ? 1 : 0);
        acc.publishedPosts += published > 0 ? published : (send?.sent ?? 0);
        acc.sentMessages += send?.sent ?? 0;
        acc.failedMessages += send?.failed ?? 0;
        return acc;
    }, { activeCampaigns: 0, scheduledPosts: 0, publishedPosts: 0, sentMessages: 0, failedMessages: 0 });

    const topDeals: WarRoomTopDeal[] = activeDealsRaw.map((d: any) => {
        const org = orgMap.get(d.orgId);
        if (!org) return null;
        const best = d.assessmentId ? bestMeetingByAssessment.get(meetingKey(d.orgId, d.assessmentId)) : null;
        const cp = Math.max(0, Math.min(1, n(best?.adjustedProbability) || n(best?.closeProbability) || (d.tier === "hot" ? 0.7 : d.tier === "warm" ? 0.45 : 0.25)));
        const value = Math.round(n(best?.expectedRevenue));
        return {
            dealId: d.id,
            tenantId: org.id,
            slug: org.slug,
            organizationName: org.name,
            stage: String(d.status ?? "draft"),
            salesScore: Math.max(1, Math.min(100, Math.round(cp * 100) + (d.tier === "hot" ? 15 : d.tier === "warm" ? 8 : 3))),
            closeProbability: cp,
            estimatedValue: value,
            recommendedNextAction: rec(String(d.status ?? "draft")),
        } as WarRoomTopDeal;
    }).filter(Boolean).sort((a: WarRoomTopDeal, b: WarRoomTopDeal) => (b.estimatedValue * b.closeProbability) - (a.estimatedValue * a.closeProbability)).slice(0, 8);

    const topCampaigns: WarRoomTopCampaign[] = campaigns.map((c: any) => {
        const org = orgMap.get(c.organizationId);
        if (!org) return null;
        const stats = toObj(c.stats);
        const send = sendMap.get(c.id) ?? { sent: 0, failed: 0 };
        return {
            campaignId: c.id,
            tenantId: org.id,
            slug: org.slug,
            name: c.name,
            status: String(c.status ?? "unknown"),
            objective: String(c.template?.category ?? c.segmentQuery ?? "awareness"),
            scheduledPosts: Math.round(n(stats.scheduledPosts ?? stats.scheduled ?? stats.scheduled_count) || (String(c.status).toLowerCase() === "scheduled" ? 1 : 0)),
            publishedPosts: Math.round(n(stats.publishedPosts ?? stats.published ?? stats.sent ?? stats.delivered) || send.sent),
            insightCount: Math.round(n(stats.insightCount ?? stats.insights ?? stats.clicks ?? stats.replies) || (send.sent > 0 ? Math.max(1, Math.floor(send.sent * 0.2)) : 0)),
        } as WarRoomTopCampaign;
    }).filter(Boolean).sort((a: WarRoomTopCampaign, b: WarRoomTopCampaign) => (b.publishedPosts + b.insightCount) - (a.publishedPosts + a.insightCount)).slice(0, 8);

    const alerts: WarRoomAlert[] = [
        ...alertEvents.map((a: any) => {
            const org = orgMap.get(a.organizationId); if (!org) return null;
            return { source: org.slug, severity: lv(String(a.severity ?? "medium")), title: `Alerta ${a.type}`, description: String(a.message ?? "Alert event detected."), createdAt: a.createdAt?.toISOString?.() ?? new Date().toISOString() } as WarRoomAlert;
        }).filter(Boolean),
        ...systemEvents.map((e: any) => {
            const org = orgMap.get(e.organizationId); if (!org) return null;
            const sev = lv(String(e.severity ?? "medium")); if (sev === "low") return null;
            return { source: org.slug, severity: sev, title: `Evento ${e.type}`, description: String(e.message ?? e.type), createdAt: e.createdAt?.toISOString?.() ?? new Date().toISOString() } as WarRoomAlert;
        }).filter(Boolean),
    ].sort((a, b) => rank(b.severity) - rank(a.severity)).slice(0, 12);

    const risks: WarRoomRisk[] = [
        ...profitLeaks.map((l: any) => {
            const org = orgMap.get(l.orgId); if (!org) return null;
            const sev = lv(String(l.severity ?? "medium")); if (sev === "low") return null;
            return { tenantId: org.id, slug: org.slug, category: String(l.kind ?? "profit_leak"), severity: sev, title: String(l.title ?? "Profit leak detected"), description: `${String(l.description ?? "Leak detected")} | perda estimada: ${f(n(l.estimatedLossCents) / 100)}`, recommendedAction: `investigate_${String(l.kind ?? "profit_leak")}` } as WarRoomRisk;
        }).filter(Boolean),
        ...alertEvents.map((a: any) => {
            const org = orgMap.get(a.organizationId); if (!org) return null;
            const sev = lv(String(a.severity ?? "medium")); if (sev === "low") return null;
            return { tenantId: org.id, slug: org.slug, category: String(a.type ?? "alert_event"), severity: sev, title: `Alerta operacional: ${a.type}`, description: String(a.message ?? "Operational alert"), recommendedAction: "investigate_alert_event" } as WarRoomRisk;
        }).filter(Boolean),
    ].sort((a, b) => rank(b.severity) - rank(a.severity)).slice(0, 12);

    const opportunities: WarRoomOpportunity[] = [];
    if (activeDeals > 0 && conversionRate < 25) {
        const org = scoped[0];
        if (org) opportunities.push({ tenantId: org.id, slug: org.slug, category: "sales_conversion", priority: conversionRate < 15 ? "high" : "medium", title: "Conversao abaixo do potencial do pipeline", description: `Conversao atual: ${conversionRate.toFixed(1)}% com ${activeDeals} deals ativos.`, recommendedAction: "run_pipeline_close_playbook", confidence: 0.84 });
    }
    const publishRate = campaignPerformance.scheduledPosts > 0 ? campaignPerformance.publishedPosts / campaignPerformance.scheduledPosts : 1;
    if (campaignPerformance.activeCampaigns > 0 && publishRate >= 0.8 && topCampaigns[0]) {
        opportunities.push({ tenantId: topCampaigns[0].tenantId, slug: topCampaigns[0].slug, category: "campaign_scale", priority: "high", title: "Campanhas com alta cadencia prontas para escalar", description: `${campaignPerformance.publishedPosts} publicacoes entregues com estabilidade.`, recommendedAction: `scale_campaign_${topCampaigns[0].campaignId}`, confidence: 0.79 });
    }
    for (const d of topDeals.slice(0, 3)) {
        if (d.closeProbability < 0.65) continue;
        opportunities.push({ tenantId: d.tenantId, slug: d.slug, category: "deal_acceleration", priority: d.closeProbability >= 0.8 ? "critical" : "high", title: `Deal com alta probabilidade de fechamento (${Math.round(d.closeProbability * 100)}%)`, description: `${d.organizationName} | valor estimado ${f(d.estimatedValue)}`, recommendedAction: d.recommendedNextAction, confidence: Math.max(0.5, Math.min(0.99, d.closeProbability)) });
    }
    for (const g of growthSignals.slice(0, 3)) {
        const org = orgMap.get(g.organizationId); if (!org) continue;
        opportunities.push({ tenantId: org.id, slug: org.slug, category: String(g.type ?? "growth_signal"), priority: lv(String(g.severity ?? "medium")) === "critical" ? "high" : "medium", title: String(g.message ?? "Growth signal detected"), description: "Signal gerado pelo monitoramento operacional.", recommendedAction: "review_growth_signal", confidence: 0.68 });
    }

    const criticalAlerts = alerts.filter((a) => a.severity === "critical").length;
    const warningAlerts = alerts.filter((a) => a.severity === "high" || a.severity === "medium").length;
    const marketing = publishRate < 0.4 ? "critical" : publishRate < 0.7 ? "warning" : "healthy";
    const sales = conversionRate < 12 ? "critical" : conversionRate < 22 ? "warning" : "healthy";
    const revenue = revenueThisMonth <= 0 && pipelineValue <= 0 ? "critical" : (revenueToday <= 0 && activeDeals > 0 ? "warning" : "healthy");
    const events = hs(criticalAlerts, warningAlerts);
    const playbooks = opportunities.length >= 6 ? "warning" : "healthy";
    const publishing = campaignPerformance.scheduledPosts > campaignPerformance.publishedPosts * 2 ? "critical" : (campaignPerformance.scheduledPosts > campaignPerformance.publishedPosts ? "warning" : "healthy");
    const modulesStatus: WarRoomModuleStatus[] = [        { module: "marketing", status: marketing, summary: `Campanhas ativas: ${campaignPerformance.activeCampaigns} | entrega ${Math.round(publishRate * 100)}%` },        { module: "sales", status: sales, summary: `Deals ativos: ${activeDeals} | conversao ${conversionRate.toFixed(1)}%` },        { module: "revenue", status: revenue, summary: `Hoje: ${f(revenueToday)} | Mes: ${f(revenueThisMonth)}` },        { module: "events", status: events, summary: `Alertas monitorados: ${alerts.length} | riscos: ${risks.length}` },        { module: "playbooks", status: playbooks, summary: `${opportunities.length} oportunidades priorizadas para execucao.` },        { module: "publishing", status: publishing, summary: `Posts publicados ${campaignPerformance.publishedPosts}/${campaignPerformance.scheduledPosts}.` },    ];

    const moduleCritical = modulesStatus.filter((m) => m.status === "critical").length;
    const moduleWarning = modulesStatus.filter((m) => m.status === "warning").length;
    const latestAnalyticsCandidates = [perfSnapshotAgg._max?.createdAt, usageSnapshotAgg._max?.updatedAt].filter((d): d is Date => d instanceof Date);
    const latestAnalytics = latestAnalyticsCandidates.length > 0
        ? latestAnalyticsCandidates.reduce((latest, current) => current.getTime() > latest.getTime() ? current : latest)
        : null;
    const latestOptimizer = [        ...growthSignals.map((r: any) => r.createdAt as Date | undefined),        ...systemEvents.filter((e: any) => String(e.type ?? "").includes("orchestrator") || String(e.type ?? "").includes("optimizer")).map((r: any) => r.createdAt as Date | undefined),    ].filter((d): d is Date => d instanceof Date).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    const summary: WarRoomSummary = {
        activeTenants: scoped.length,
        activeCampaigns: campaignPerformance.activeCampaigns,
        scheduledPosts: campaignPerformance.scheduledPosts,
        publishedPosts: campaignPerformance.publishedPosts,
        openDeals: activeDeals,
        weightedPipeline: Math.round(pipelineValue),
        forecast30d: Math.round(revenueThisMonth + (pipelineValue * (conversionRate / 100))),
        criticalAlerts,
        highPriorityOpportunities: opportunities.filter((o) => o.priority === "high" || o.priority === "critical").length,
        eventBusStatus: hs(criticalAlerts, warningAlerts),
        systemHealth: hs(moduleCritical, moduleWarning),
        lastAnalyticsRun: latestAnalytics ? latestAnalytics.toISOString() : null,
        lastOptimizerRun: latestOptimizer ? latestOptimizer.toISOString() : null,
    };

    logger.info("[WarRoom] snapshot generated", {
        requestId: input.requestId,
        actorUserId: input.actorUserId,
        agencyOrganizationId: input.agencyOrganizationId,
        activeTenants: summary.activeTenants,
        revenueToday,
        revenueThisMonth,
        pipelineValue: summary.weightedPipeline,
        conversionRate,
        durationMs: Date.now() - startedAt,
    });

    return {
        revenueToday,
        revenueThisMonth,
        pipelineValue: summary.weightedPipeline,
        activeDeals,
        conversionRate,
        summary,
        modulesStatus,
        risks,
        opportunities,
        alerts,
        topDeals,
        topCampaigns,
    };
}

export async function refreshWarRoomSnapshotCache(input: {
    agencyOrganizationId: string;
    actorUserId: string;
    requestId: string;
    now?: Date;
}): Promise<WarRoomRefreshResult> {
    const snapshot = await generateWarRoomSnapshot(input);
    const generatedAt = (input.now ?? new Date()).toISOString();
    const materialized = materializeWarRoomSnapshot(snapshot);

    await (prisma as any).warRoomSnapshot.create({
        data: {
            organizationId: input.agencyOrganizationId,
            revenueToday: materialized.revenueToday,
            revenueThisMonth: materialized.revenueThisMonth,
            pipelineValue: materialized.pipelineValue,
            activeDeals: materialized.activeDeals,
            conversionRate: materialized.conversionRate,
            campaignPerformance: materialized.campaignPerformance,
            riskAlerts: materialized.riskAlerts,
            profitLeakSignals: materialized.profitLeakSignals,
            createdAt: new Date(generatedAt),
        },
    });

    return { agencyOrganizationId: input.agencyOrganizationId, generatedAt, summary: snapshot.summary };
}


