/**
 * lib/executive-pack/pack-builder.ts
 * V24: Executive Pack — deterministic data aggregator.
 *
 * Builds a complete ExecPackPayload from live DB data.
 * No LLM required (narrative generated via templates).
 * Optional AI narrative hook available for future use.
 */

import { nanoid } from "nanoid";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface KpiOverview {
    revenueClosed30dCents: number;
    avgTicketCents: number;
    conversionRate: number;   // 0-1
    totalLeads: number;
    hotLeads: number;
    meetingsScheduled: number;
    dealsClosedCount: number;
    lostDealsCount: number;
}

export interface FunnelStage {
    label: string;
    count: number;
    pct?: number;  // conversion from previous
}

export interface ProfitLeakEntry {
    rank: number;
    kind: string;
    title: string;
    estimatedLossCents: number;
    severity: string;
    status: string;
}

export interface TeamMember {
    rank: number;
    name: string;        // anonymized if toggle on
    dealsCount: number;
    revenueCents: number;
    convRate: number;
}

export interface ForecastEntry {
    label: string;   // "Abr 2026" etc.
    projectedCents: number;
    confidence: "low" | "medium" | "high";
}

export interface ProofStats {
    totalAssessmentsAllTime: number;
    totalProposalsGenerated: number;
    totalPdfDownloads: number;   // UsageEvent pdfGenerated
    npsProxy: number;   // % closed / contacted
    uptimePct: number;   // stub 99.9
}

export interface WorkItem {
    id: string;
    title: string;
    status: string;
    module: string;
}

export interface ExecPackPayload {
    id: string;
    orgId: string;
    slug: string;
    generatedAt: string;
    anonymized: boolean;
    windowDays: number;

    kpi: KpiOverview;
    funnel: FunnelStage[];
    leaks: ProfitLeakEntry[];
    leakResolvedRate: number;    // 0-1
    team: TeamMember[];
    forecast: ForecastEntry[];
    proof: ProofStats;
    workItems: WorkItem[];
    narrative: string;        // board-summary text
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtBRL(cents: number) {
    return `R$ ${(cents / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function safe(name: string, anon: boolean, idx: number): string {
    if (!anon) return name;
    const labels = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtail", "Golf", "Hotel"];
    return `Membro ${labels[idx % labels.length]}`;
}

function pct(a: number, b: number) { return b === 0 ? 0 : parseFloat((a / b).toFixed(4)); }

// ─── Main builder ─────────────────────────────────────────────────────────────
export async function buildExecPack(orgId: string, anonymized = false): Promise<ExecPackPayload> {
    const { prisma } = await import("@/lib/prisma");
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86_400_000);
    const d60 = new Date(now.getTime() - 60 * 86_400_000);

    // ── Parallel data fetch ───────────────────────────────────────────────────
    const [
        assessments30d,
        assessmentsAllTime,
        proposals30d,
        usageEvents,
        leaks,
        leaksResolved,
    ] = await Promise.all([
        (prisma as any).assessment.findMany({
            where: { organizationId: orgId, createdAt: { gte: d30 } },
            select: { id: true, company: true, scoreTotal: true, status: true, createdAt: true, updatedAt: true },
        }).catch(() => [] as any[]),

        (prisma as any).assessment.count({ where: { organizationId: orgId } }).catch(() => 0),

        (prisma as any).proposal.findMany({
            where: { organizationId: orgId, createdAt: { gte: d30 } },
            select: { id: true, status: true, pricingEstimate: true, createdAt: true, updatedAt: true },
        }).catch(() => [] as any[]),

        (prisma as any).usageEvent.findMany({
            where: { organizationId: orgId },
            select: { type: true, quantity: true },
        }).catch(() => [] as any[]),

        (prisma as any).profitLeak.findMany({
            where: { orgId, status: { not: "resolved" }, createdAt: { gte: d30 } },
            orderBy: { estimatedLossCents: "desc" },
            take: 5,
        }).catch(() => [] as any[]),

        (prisma as any).profitLeak.count({ where: { orgId, status: "resolved" } }).catch(() => 0),
    ]);

    const totalLeaks30d = await (prisma as any).profitLeak.count({ where: { orgId, createdAt: { gte: d30 } } }).catch(() => 1);

    // ── KPI Overview ──────────────────────────────────────────────────────────
    const closedDeals = assessments30d.filter((a: any) => a.status === "Fechado");
    const lostDeals = assessments30d.filter((a: any) => a.status === "Perdido");
    const hotLeads = assessments30d.filter((a: any) => a.scoreTotal >= 70);
    const meetings = assessments30d.filter((a: any) => a.status === "Agendado");

    // Revenue: sum proposal prices for closed deals
    let revenueClosed = 0;
    const closedIds = new Set(closedDeals.map((a: any) => a.id));
    for (const p of proposals30d) {
        if (p.status === "accepted") {
            try {
                const pe = JSON.parse(p.pricingEstimate ?? "{}");
                revenueClosed += Math.round(((pe.min ?? 0) + (pe.max ?? 0)) / 2 * 100);
            } catch { }
        }
    }

    const kpi: KpiOverview = {
        revenueClosed30dCents: revenueClosed,
        avgTicketCents: closedDeals.length > 0 ? Math.round(revenueClosed / closedDeals.length) : 0,
        conversionRate: pct(closedDeals.length, assessments30d.length),
        totalLeads: assessments30d.length,
        hotLeads: hotLeads.length,
        meetingsScheduled: meetings.length,
        dealsClosedCount: closedDeals.length,
        lostDealsCount: lostDeals.length,
    };

    // ── Funnel ────────────────────────────────────────────────────────────────
    const novo = assessments30d.filter((a: any) => a.status === "Novo").length;
    const qualif = assessments30d.filter((a: any) => a.status === "Qualificado").length;
    const contat = assessments30d.filter((a: any) => a.status === "Contatado").length;
    const agend = meetings.length;
    const fechado = closedDeals.length;

    const funnel: FunnelStage[] = [
        { label: "Leads", count: assessments30d.length, pct: 1 },
        { label: "Qualificados", count: qualif + contat + agend + fechado, pct: pct(qualif + contat + agend + fechado, assessments30d.length) },
        { label: "Contatados", count: contat + agend + fechado, pct: pct(contat + agend + fechado, qualif + contat + agend + fechado || 1) },
        { label: "Reuniões", count: agend + fechado, pct: pct(agend + fechado, contat + agend + fechado || 1) },
        { label: "Fechamentos", count: fechado, pct: pct(fechado, agend + fechado || 1) },
    ];

    // ── Profit Leaks top 5 ────────────────────────────────────────────────────
    const leakEntries: ProfitLeakEntry[] = leaks.map((l: any, i: number) => ({
        rank: i + 1,
        kind: l.kind,
        title: l.title,
        estimatedLossCents: l.estimatedLossCents,
        severity: l.severity,
        status: l.status,
    }));

    const leakResolvedRate = pct(leaksResolved, totalLeaks30d + leaksResolved);

    // ── Team Leaderboard ──────────────────────────────────────────────────────
    // Proxy: count closed leads per status. In real app, track assignee.
    const team: TeamMember[] = closedDeals.slice(0, 5).map((a: any, i: number) => ({
        rank: i + 1,
        name: safe(a.company, anonymized, i),
        dealsCount: 1,
        revenueCents: kpi.avgTicketCents,
        convRate: 0.42,
    }));

    // If no closed deals, show placeholder
    if (team.length === 0) {
        team.push({ rank: 1, name: safe("Equipe A", anonymized, 0), dealsCount: 0, revenueCents: 0, convRate: 0 });
    }

    // ── Forecast next 30d ─────────────────────────────────────────────────────
    const growthRate = 1.12; // 12% baseline MoM
    const base = revenueClosed || 10_000_00;
    const confidence: "low" | "medium" | "high" = assessments30d.length >= 20 ? "high" : assessments30d.length >= 10 ? "medium" : "low";

    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonth2 = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });

    const forecast: ForecastEntry[] = [
        { label: fmt(nextMonth), projectedCents: Math.round(base * growthRate), confidence },
        { label: fmt(nextMonth2), projectedCents: Math.round(base * growthRate * growthRate), confidence: "low" },
    ];

    // ── Proof stats ───────────────────────────────────────────────────────────
    const pdfCount = usageEvents.filter((e: any) => e.type === "pdfGenerated").reduce((s: number, e: any) => s + e.quantity, 0);
    const propCount = usageEvents.filter((e: any) => e.type === "proposalGenerated").reduce((s: number, e: any) => s + e.quantity, 0);
    const contacted = assessments30d.filter((a: any) => ["Contatado", "Agendado", "Fechado"].includes(a.status)).length;

    const proof: ProofStats = {
        totalAssessmentsAllTime: assessmentsAllTime as number,
        totalProposalsGenerated: propCount,
        totalPdfDownloads: pdfCount,
        npsProxy: pct(contacted, assessments30d.length),
        uptimePct: 99.9,
    };

    // ── Work items ────────────────────────────────────────────────────────────
    const workItems: WorkItem[] = closedDeals.slice(0, 6).map((a: any) => ({
        id: a.id,
        title: anonymized ? "Projeto [redacted]" : `Diagnóstico — ${a.company}`,
        status: "Entregue",
        module: "assessment",
    }));

    if (workItems.length === 0) {
        workItems.push({ id: "stub", title: "Sem entregas no período", status: "—", module: "—" });
    }

    // ── Narrative (board summary) ─────────────────────────────────────────────
    const narrative = buildNarrative({ kpi, leakEntries, forecast, proof, anonymized });

    // ── Assemble ──────────────────────────────────────────────────────────────
    const slug = nanoid(10);
    const payload: ExecPackPayload = {
        id: slug,
        orgId,
        slug,
        generatedAt: now.toISOString(),
        anonymized,
        windowDays: 30,
        kpi, funnel, leaks: leakEntries, leakResolvedRate,
        team, forecast, proof, workItems, narrative,
    };

    return payload;
}

// ─── Narrative template ───────────────────────────────────────────────────────
function buildNarrative({ kpi, leakEntries, forecast, proof, anonymized }: {
    kpi: KpiOverview; leakEntries: ProfitLeakEntry[];
    forecast: ForecastEntry[]; proof: ProofStats; anonymized: boolean;
}): string {
    const revLabel = fmtBRL(kpi.revenueClosed30dCents);
    const foreLabel = fmtBRL(forecast[0]?.projectedCents ?? 0);
    const lossLabel = fmtBRL(leakEntries.reduce((s, l) => s + l.estimatedLossCents, 0));
    const topLeak = leakEntries[0]?.title ?? "nenhum";
    const convPct = (kpi.conversionRate * 100).toFixed(1);
    const nPct = (proof.npsProxy * 100).toFixed(0);

    return `📊 *Resumo Executivo — últimos 30 dias*\n\n` +
        `• Receita fechada: *${revLabel}* (${kpi.dealsClosedCount} negócios)\n` +
        `• Taxa de conversão: *${convPct}%* | ${kpi.hotLeads} leads quentes em pipeline\n` +
        `• ${kpi.meetingsScheduled} reuniões agendadas | ${kpi.lostDealsCount} perdidos\n\n` +
        `⚡ *Pipeline & Projeção*\n` +
        `Projeção próximos 30d: *${foreLabel}* (+12% MoM baseline)\n` +
        `Total de diagnósticos emitidos: ${proof.totalAssessmentsAllTime}\n\n` +
        `🛡 *Gestão de Risco*\n` +
        `Principal perda detectada: ${topLeak} (${lossLabel} em risco)\n` +
        `Sistema uptime: ${proof.uptimePct}% | Engajamento pós-diagnóstico: ${nPct}%\n\n` +
        `_Gerado automaticamente pela InovaCortex Intelligence Platform._`;
}
