/**
 * lib/cockpit.ts
 * V14: Command Center data aggregation layer.
 *
 * 8 fast, indexed queries that power the cockpit sections.
 * All functions are org-scoped and memoization-friendly (static data within a request).
 *
 * Sections:
 * 1. getMissionStatus   — org / plan / health / pipeline value
 * 2. getRevenueSnapshot — revenue / ROI / payback charts
 * 3. getActionQueue     — priority-ordered action items (alerts, hot leads, approvals)
 * 4. getAISnapshot      — AI system statuses, usage today, cost month
 * 5. getFunnelSnapshot  — count / conversion / value per funnel stage
 * 6. getExecutionSnapshot — workspaces status matrix
 * 7. getContentSnapshot — content pipeline + authority proof stats
 * 8. getBillingSnapshot — plan limits, Stripe status, usage %
 */

import { prisma } from "@/lib/prisma";
import { normalizeOrganizationAccountStatus } from "@/lib/billing/account-status";

// ─── 1. Mission Status ────────────────────────────────────────────────────────

export async function getMissionStatus(orgId: string) {
    const [org, alerts, sequences, proposals, billing] = await Promise.all([
        (prisma as any).organization.findUnique({
            where: { id: orgId },
            select: { name: true, plan: true, slug: true, subscriptionStatus: true }
        }),
        (prisma as any).alertEvent?.findMany?.({
            where: { organizationId: orgId, severity: "critical", resolvedAt: null },
            select: { id: true },
        }).catch(() => [] as any[]),
        (prisma as any).leadSequence.count({
            where: { organizationId: orgId, status: "active" }
        }),
        (prisma as any).proposal.count({
            where: { organizationId: orgId, status: { in: ["draft", "sent"] } }
        }),
        (prisma as any).monthlyUsageSnapshot.findFirst({
            where: { organizationId: orgId },
            orderBy: { createdAt: "desc" },
        }),
    ]);

    // Pipeline value = count of active proposals × avg ROI estimate
    const roiRows = await (prisma as any).roiProjection.findMany({
        where: { assessment: { organizationId: orgId } },
        select: { operationalSavingsEstimate: true, revenueIncreaseEstimate: true }
    });
    const avgROIYear = roiRows.length > 0
        ? roiRows.reduce((s: number, r: any) => s + r.operationalSavingsEstimate + r.revenueIncreaseEstimate, 0) / roiRows.length
        : 0;
    const pipelineValue = proposals * avgROIYear;

    // Conversion 30d: sequences that converted in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const converted30d = await (prisma as any).leadSequence.count({
        where: { organizationId: orgId, status: "completed", convertedAt: { gte: thirtyDaysAgo } }
    });

    const aiFunctional = !!(process.env.OPENAI_API_KEY);
    const funnelEnabled = await getSystemSetting(orgId, "ai.funnel_engine");

    return {
        orgName: org?.name ?? orgId,
        plan: org?.plan ?? "free",
        subscriptionStatus: normalizeOrganizationAccountStatus(org?.subscriptionStatus),
        healthAI: aiFunctional ? "ok" : "degraded",
        healthFunnel: funnelEnabled ? "ok" : "off",
        healthAlerts: (alerts?.length ?? 0) > 0 ? "critical" : "ok",
        pipelineValue: Math.round(pipelineValue),
        activeSequences: sequences,
        conversion30d: converted30d,
        openProposals: proposals,
        criticalAlerts: alerts?.length ?? 0,
        updatedAt: new Date().toISOString(),
    };
}

// ─── 2. Revenue Snapshot ──────────────────────────────────────────────────────

export async function getRevenueSnapshot(orgId: string) {
    const [snapshots, roiRows, sequences] = await Promise.all([
        (prisma as any).monthlyUsageSnapshot.findMany({
            where: { organizationId: orgId },
            orderBy: { month: "asc" },
            take: 6,
            select: { month: true, assessmentsCount: true, proposalCount: true, aiGenerationsCount: true }
        }),
        (prisma as any).roiProjection.findMany({
            where: { assessment: { organizationId: orgId } },
            select: { operationalSavingsEstimate: true, revenueIncreaseEstimate: true, estimatedPaybackMonths: true }
        }),
        (prisma as any).leadSequence.count({ where: { organizationId: orgId, status: "completed" } }),
    ]);

    const avgSavings = roiRows.length > 0
        ? roiRows.reduce((s: number, r: any) => s + r.operationalSavingsEstimate, 0) / roiRows.length
        : 0;
    const avgRevenue = roiRows.length > 0
        ? roiRows.reduce((s: number, r: any) => s + r.revenueIncreaseEstimate, 0) / roiRows.length
        : 0;
    const avgPayback = roiRows.length > 0
        ? roiRows.reduce((s: number, r: any) => s + (r.estimatedPaybackMonths || 0), 0) / roiRows.length
        : 0;

    return {
        monthlySnapshots: snapshots,
        totalConverted: sequences,
        avgAnnualROI: Math.round(avgSavings + avgRevenue),
        avgSavings: Math.round(avgSavings),
        avgRevenue: Math.round(avgRevenue),
        avgPaybackMonths: Math.round(avgPayback * 10) / 10,
        totalCases: roiRows.length,
    };
}

// ─── 3. Action Queue ──────────────────────────────────────────────────────────

export interface ActionItem {
    id: string;
    priority: "critical" | "high" | "medium";
    type: "alert" | "hot_lead" | "pending_approval" | "blocked_workspace" | "usage_threshold";
    label: string;
    subtext: string;
    href: string;
    orgSlug: string;
}

export async function getActionQueue(orgId: string, orgSlug: string): Promise<ActionItem[]> {
    const items: ActionItem[] = [];

    // Hot leads (score ≥ 80, no sequence yet)
    // Assessment has no direct leadSequence relation — use subquery
    const existingSeqAssessmentIds = await (prisma as any).leadSequence.findMany({
        where: { organizationId: orgId },
        select: { assessmentId: true },
    });
    const alreadyInSeq = existingSeqAssessmentIds.map((s: any) => s.assessmentId).filter(Boolean);

    const hotAssessments = await (prisma as any).assessment.findMany({
        where: {
            organizationId: orgId,
            scoreTotal: { gte: 80 },
            ...(alreadyInSeq.length > 0 ? { id: { notIn: alreadyInSeq } } : {}),
        },
        select: { id: true, company: true, scoreTotal: true },
        take: 5,
    });
    for (const a of hotAssessments) {
        items.push({
            id: `hot_${a.id}`,
            priority: "high",
            type: "hot_lead",
            label: `Lead quente: ${a.company}`,
            subtext: `Score ${a.scoreTotal}/100 — sem sequência iniciada`,
            href: `/org/${orgSlug}/admin/${a.id}`,
            orgSlug,
        });
    }

    // Content & Authority pending approval
    const [pendingContent, pendingAuthority] = await Promise.all([
        (prisma as any).contentArtifact.count({ where: { organizationId: orgId, status: { in: ["reviewed"] } } }),
        (prisma as any).authorityAsset.count({ where: { organizationId: orgId, status: "anonymized" } }),
    ]);

    if (pendingContent > 0) {
        items.push({
            id: "pending_content", priority: "medium", type: "pending_approval",
            label: `${pendingContent} content(s) aguardando aprovação`,
            subtext: "Content Engine — revisado, pendente aprovação",
            href: `/org/${orgSlug}/admin/content?status=reviewed`, orgSlug,
        });
    }
    if (pendingAuthority > 0) {
        items.push({
            id: "pending_authority", priority: "medium", type: "pending_approval",
            label: `${pendingAuthority} authority asset(s) para aprovar`,
            subtext: "Authority Library — anonimizado, pendente aprovação",
            href: `/org/${orgSlug}/admin/authority?status=anonymized`, orgSlug,
        });
    }

    // Proposals > 5 days without response
    const fiveDaysAgo = new Date(Date.now() - 5 * 86400000);
    const staleProposals = await (prisma as any).proposal.findMany({
        where: { organizationId: orgId, status: "sent", updatedAt: { lt: fiveDaysAgo } },
        select: { id: true, pricingEstimate: true, assessment: { select: { company: true } } },
        take: 3,
    });
    for (const p of staleProposals) {
        let val = 0;
        try {
            const pe = JSON.parse(p.pricingEstimate);
            val = pe.min || 0;
        } catch { }
        items.push({
            id: `proposal_${p.id}`, priority: "high", type: "pending_approval",
            label: `Proposta sem resposta: ${p.assessment?.company || "Lead"}`,
            subtext: `Enviada há mais de 5 dias — R$ ${val}`,
            href: `/org/${orgSlug}/admin/proposals/${p.id}`, orgSlug,
        });
    }

    // Critical Alerts < 24h
    const oneDayAgo = new Date(Date.now() - 86400000);
    const criticalAlerts = await (prisma as any).alertEvent.findMany({
        where: { organizationId: orgId, severity: "critical", resolved: false, createdAt: { gte: oneDayAgo } },
        select: { id: true, message: true, type: true },
        take: 3,
    });
    for (const alert of criticalAlerts) {
        items.push({
            id: `alert_${alert.id}`, priority: "critical", type: "alert",
            label: `Alerta Crítico: ${alert.type}`,
            subtext: alert.message,
            href: `/org/${orgSlug}/admin/audit`, orgSlug,
        });
    }

    // Blocked workspaces > 3 days in provisioning
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
    const blockedWs = await (prisma as any).clientWorkspace.findMany({
        where: { organizationId: orgId, status: "provisioning", createdAt: { lt: threeDaysAgo } },
        select: { id: true, assessmentId: true, createdAt: true },
        take: 3,
    });
    for (const ws of blockedWs) {
        const days = Math.round((Date.now() - new Date(ws.createdAt).getTime()) / 86400000);
        items.push({
            id: `blocked_${ws.id}`, priority: "critical", type: "blocked_workspace",
            label: `Workspace em provisioning há ${days} dias`,
            subtext: `ID: ${ws.id.slice(0, 8)} — verificar implantação`,
            href: `/org/${orgSlug}/admin/workspaces`, orgSlug,
        });
    }

    // Sort: critical → high → medium
    const order = { critical: 0, high: 1, medium: 2 };
    items.sort((a, b) => order[a.priority] - order[b.priority]);
    return items;

}

// ─── 4. AI System Snapshot ────────────────────────────────────────────────────

const AI_SYSTEMS = [
    { key: "ai.content_engine", label: "Content Engine", route: "content" },
    { key: "ai.presales", label: "PreSales Agent", route: "presales" },
    { key: "ai.funnel_engine", label: "Funnel Engine", route: "sequences" },
    { key: "ai.authority", label: "Authority Generator", route: "authority" },
] as const;

export async function getAISnapshot(orgId: string) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [settings, usageToday, usageMonth] = await Promise.all([
        (prisma as any).systemSetting.findMany({
            where: { organizationId: orgId, key: { in: AI_SYSTEMS.map(s => s.key) } },
            select: { key: true, value: true },
        }),
        (prisma as any).usageEvent.findMany({
            where: { organizationId: orgId, createdAt: { gte: today } },
            select: { type: true, quantity: true, metadata: true },
        }),
        (prisma as any).usageEvent.findMany({
            where: { organizationId: orgId, createdAt: { gte: monthStart } },
            select: { type: true, quantity: true, metadata: true },
        }),
    ]);

    const settingMap: Record<string, boolean> = {};
    for (const s of settings) settingMap[s.key] = s.value === "true";

    const aiGenerationsToday = usageToday.filter((e: any) => e.type === "ai_generation").length;
    const aiGenerationsMonth = usageMonth.filter((e: any) => e.type === "ai_generation").length;

    // Estimate cost: ~$0.002 per gpt-4o-mini call (rough)
    const estimatedCostMonth = aiGenerationsMonth * 0.002;

    return AI_SYSTEMS.map(sys => ({
        key: sys.key,
        label: sys.label,
        route: sys.route,
        enabled: settingMap[sys.key] !== false, // default ON
        callsToday: aiGenerationsToday, // simplified — could be split by system
        costMonth: estimatedCostMonth,
        successRate: 98, // Placeholder — would need tracking table for real metric
    }));
}

// ─── 5. Funnel Snapshot ───────────────────────────────────────────────────────

export async function getFunnelSnapshot(orgId: string) {
    const STAGES = ["post_click", "whatsapp_initial", "post_dossier", "schedule_pending", "proposal_sent", "follow_up_1", "follow_up_2", "converted"];

    const sequences = await (prisma as any).leadSequence.findMany({
        where: { organizationId: orgId },
        select: { currentStage: true, status: true, scoreTier: true },
    });

    const stageCounts: Record<string, number> = {};
    const tierCounts: Record<string, number> = { hot: 0, warm: 0, cold: 0 };

    for (const s of sequences) {
        const stage = s.status === "completed" ? "converted" : s.currentStage;
        stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;
        tierCounts[s.scoreTier] = (tierCounts[s.scoreTier] ?? 0) + 1;
    }

    const total = sequences.length || 1; // avoid division by zero

    const stages = STAGES.map((stage, i) => {
        const count = stageCounts[stage] ?? 0;
        const prev = i > 0 ? (stageCounts[STAGES[i - 1]] ?? 0) : total;
        return {
            stage,
            count,
            conversionRate: prev > 0 ? Math.round((count / prev) * 100) : 0,
            pct: Math.round((count / total) * 100),
        };
    });

    return {
        stages,
        tierCounts,
        totalSequences: sequences.length,
        convertedTotal: stageCounts["converted"] ?? 0,
        overallRate: total > 0 ? Math.round(((stageCounts["converted"] ?? 0) / total) * 100) : 0,
    };
}

// ─── 6. Execution Snapshot ────────────────────────────────────────────────────

export async function getExecutionSnapshot(orgId: string) {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);
    const nextWeek = new Date(now.getTime() + 7 * 86400000);

    const [active, provisioning, blocked, upcoming] = await Promise.all([
        (prisma as any).clientWorkspace.count({ where: { organizationId: orgId, status: "active" } }),
        (prisma as any).clientWorkspace.count({ where: { organizationId: orgId, status: "provisioning" } }),
        (prisma as any).clientWorkspace.count({ where: { organizationId: orgId, status: "provisioning", createdAt: { lt: threeDaysAgo } } }),
        (prisma as any).clientWorkspace.count({ where: { organizationId: orgId, goLiveAt: { gte: now, lte: nextWeek } } }).catch(() => 0),
    ]);

    const all = await (prisma as any).clientWorkspace.findMany({
        where: { organizationId: orgId },
        select: { status: true },
    });

    const topAtRiskRaw = await (prisma as any).clientWorkspace.findMany({
        where: { organizationId: orgId, status: "provisioning" },
        orderBy: { createdAt: "asc" },
        take: 5,
        select: { id: true, createdAt: true, assessmentId: true },
    });

    const assessmentIds = topAtRiskRaw.map((w: any) => w.assessmentId);
    let topAtRisk: any[] = [];

    if (assessmentIds.length > 0) {
        const assessments = await (prisma as any).assessment.findMany({
            where: { id: { in: assessmentIds } },
            select: { id: true, company: true }
        });
        const compMap: Record<string, string> = {};
        for (const a of assessments) compMap[a.id] = a.company;

        topAtRisk = topAtRiskRaw.map((w: any) => ({
            id: w.id,
            createdAt: w.createdAt,
            assessment: { company: compMap[w.assessmentId] || "Workspace" }
        }));
    }

    const byStatus: Record<string, number> = {};
    for (const w of all) byStatus[w.status] = (byStatus[w.status] ?? 0) + 1;

    return { active, provisioning, blocked, upcoming, byStatus, topAtRisk, total: all.length };

}

// ─── 7. Content Snapshot ─────────────────────────────────────────────────────

export async function getContentSnapshot(orgId: string) {
    const [contentCounts, authorityCounts, proofStats] = await Promise.all([
        (prisma as any).contentArtifact.groupBy({
            by: ["status"],
            where: { organizationId: orgId },
            _count: { _all: true },
        }),
        (prisma as any).authorityAsset.groupBy({
            by: ["status"],
            where: { organizationId: orgId },
            _count: { _all: true },
        }),
        (prisma as any).proofStatistic.findMany({
            where: { organizationId: orgId },
            select: { label: true, value: true },
            orderBy: { lastUpdatedAt: "desc" },
            take: 4,
        }),
    ]);

    const contentMap: Record<string, number> = {};
    const authorityMap: Record<string, number> = {};
    for (const c of contentCounts) contentMap[c.status] = c._count._all;
    for (const a of authorityCounts) authorityMap[a.status] = a._count._all;

    return { contentMap, authorityMap, proofStats };
}

// ─── 8. Billing Snapshot ──────────────────────────────────────────────────────

export async function getBillingSnapshot(orgId: string) {
    const [org, snapshot] = await Promise.all([
        (prisma as any).organization.findUnique({
            where: { id: orgId },
            select: {
                plan: true, subscriptionStatus: true,
                maxAssessmentsPerMonth: true, maxUsers: true,
                stripeSubscriptionId: true, currentPeriodEnd: true,
            }
        }),
        (prisma as any).monthlyUsageSnapshot.findFirst({
            where: { organizationId: orgId },
            orderBy: { createdAt: "desc" },
        }),
    ]);

    const aiGen = snapshot?.aiGenerationsCount ?? 0;
    const assessments = snapshot?.assessmentsCount ?? 0;
    const maxAssessments = org?.maxAssessmentsPerMonth ?? 10;

    return {
        plan: org?.plan ?? "free",
        subscriptionStatus: normalizeOrganizationAccountStatus(org?.subscriptionStatus),
        hasStripe: !!org?.stripeSubscriptionId,
        currentPeriodEnd: org?.currentPeriodEnd ?? null,
        maxAssessments,
        assessmentsUsed: assessments,
        assessmentsPct: Math.min(100, Math.round((assessments / maxAssessments) * 100)),
        aiGenerationsMonth: aiGen,
        estimatedAICost: Math.round(aiGen * 0.002 * 100) / 100,
    };
}

// ─── Toggle System Setting ────────────────────────────────────────────────────

export async function getSystemSetting(orgId: string, key: string): Promise<boolean> {
    const setting = await (prisma as any).systemSetting.findUnique({
        where: { key_organizationId: { key, organizationId: orgId } }
    });
    return setting ? setting.value === "true" : true; // default ON
}

export async function setSystemSetting(
    orgId: string,
    key: string,
    value: boolean,
    userId?: string,
): Promise<void> {
    await (prisma as any).systemSetting.upsert({
        where: { key_organizationId: { key, organizationId: orgId } },
        create: { organizationId: orgId, key, value: String(value) },
        update: { value: String(value) },
    });

    // Audit
    await (prisma as any).auditEvent.create({
        data: {
            assessmentId: "system",
            organizationId: orgId,
            action: "systemSettingChanged",
            details: JSON.stringify({ key, value, userId }),
        }
    }).catch(() => null);
}

// ─── Combined Cockpit Loader ──────────────────────────────────────────────────

export async function loadCockpit(orgId: string, orgSlug: string) {
    const [
        missionStatus,
        revenueSnapshot,
        actionQueue,
        aiSnapshot,
        funnelSnapshot,
        executionSnapshot,
        contentSnapshot,
        billingSnapshot,
    ] = await Promise.all([
        getMissionStatus(orgId),
        getRevenueSnapshot(orgId),
        getActionQueue(orgId, orgSlug),
        getAISnapshot(orgId),
        getFunnelSnapshot(orgId),
        getExecutionSnapshot(orgId),
        getContentSnapshot(orgId),
        getBillingSnapshot(orgId),
    ]);

    return {
        missionStatus,
        revenueSnapshot,
        actionQueue,
        aiSnapshot,
        funnelSnapshot,
        executionSnapshot,
        contentSnapshot,
        billingSnapshot,
    };
}
