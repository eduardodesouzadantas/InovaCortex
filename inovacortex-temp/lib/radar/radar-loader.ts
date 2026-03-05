/**
 * lib/radar/radar-loader.ts
 * V23: Business Radar — deterministic data loader.
 *
 * Aggregates data from:
 *   - Assessment     → Acquisition + Revenue quadrants
 *   - Proposal       → Revenue quadrant
 *   - Prospect       → Acquisition quadrant (outbound)
 *   - OutboundSequence → Acquisition
 *   - ProfitLeak     → Trust quadrant
 *
 * No LLM calls. No heavy blobs.
 * Server-side in-memory cache: 5s TTL.
 */

// ─── Types ────────────────────────────────────────────────────────────────────
export type Quadrant = "acquisition" | "revenue" | "delivery" | "trust";

export type NodeHealth = "healthy" | "warning" | "critical" | "stale";

export interface RadarNode {
    id: string;
    label: string;          // company or short title
    quadrant: Quadrant;
    health: NodeHealth;
    tier?: "hot" | "warm" | "cold";
    stage?: string;          // human-readable stage label
    valueCents?: number;       // for sizing
    priority: number;          // 0-100 (drives dot size)
    pulse: boolean;         // animate-ping for critical
    module: string;          // source module tag
    meta: Record<string, string | number | boolean | null>;
}

export interface RadarEvent {
    id: string;
    timestamp: string;
    icon: string;
    text: string;
    quadrant: Quadrant;
    health: NodeHealth;
}

export interface RadarMetrics {
    acquisition: { total: number; hot: number; stuck: number };
    revenue: { total: number; valueCents: number; stale: number };
    delivery: { total: number; healthy: number };
    trust: { total: number; criticalLeaks: number; totalLossCents: number };
}

export interface RadarPayload {
    nodes: RadarNode[];
    events: RadarEvent[];
    metrics: RadarMetrics;
    generatedAt: string;
}

// ─── 5s in-memory cache ───────────────────────────────────────────────────────
const CACHE = new Map<string, { data: RadarPayload; at: number }>();
const CACHE_TTL_MS = 5_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function msAgo(ms: number) { return new Date(Date.now() - ms); }

/** Derive tier from Assessment score */
function tierFromScore(score: number): "hot" | "warm" | "cold" {
    if (score >= 70) return "hot";
    if (score >= 40) return "warm";
    return "cold";
}

/** Derive health from status string */
function assessmentHealth(status: string, updatedAt: Date): NodeHealth {
    const ageDays = (Date.now() - updatedAt.getTime()) / 86_400_000;
    if (status === "Fechado") return "healthy";
    if (status === "Perdido") return "stale";
    if (ageDays > 7) return "warning";
    if (ageDays > 14) return "critical";
    return "healthy";
}

function proposalHealth(status: string, updatedAt: Date): NodeHealth {
    if (status === "accepted") return "healthy";
    if (status === "rejected") return "stale";
    const ageDays = (Date.now() - updatedAt.getTime()) / 86_400_000;
    if (ageDays > 5) return "warning";
    if (ageDays > 10) return "critical";
    return "healthy";
}

function prospectHealth(status: string): NodeHealth {
    if (status === "meeting") return "healthy";
    if (["lost", "do_not_contact"].includes(status)) return "stale";
    if (status === "replied") return "healthy";
    if (status === "connected") return "warning";
    return "warning";
}

function leakHealth(severity: string): NodeHealth {
    if (severity === "critical") return "critical";
    if (severity === "high") return "warning";
    return "warning";
}

function mkEvent(id: string, icon: string, text: string, q: Quadrant, h: NodeHealth, ts: Date): RadarEvent {
    return { id, timestamp: ts.toISOString(), icon, text, quadrant: q, health: h };
}

// ─── Main loader ──────────────────────────────────────────────────────────────
export async function loadRadar(orgId: string): Promise<RadarPayload> {
    const cached = CACHE.get(orgId);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

    const { prisma } = await import("@/lib/prisma");
    const since30d = msAgo(30 * 86_400_000);

    // ── Parallel queries ──────────────────────────────────────────────────────
    const [
        assessments,
        proposals,
        prospects,
        sequences,
        leaks,
    ] = await Promise.all([
        (prisma as any).assessment.findMany({
            where: { organizationId: orgId, createdAt: { gte: since30d } },
            select: { id: true, company: true, scoreTotal: true, status: true, updatedAt: true, createdAt: true },
            orderBy: { updatedAt: "desc" },
            take: 60,
        }).catch(() => [] as any[]),

        (prisma as any).proposal.findMany({
            where: { organizationId: orgId, createdAt: { gte: since30d } },
            select: { id: true, assessmentId: true, status: true, pricingEstimate: true, updatedAt: true, createdAt: true },
            orderBy: { updatedAt: "desc" },
            take: 40,
        }).catch(() => [] as any[]),

        (prisma as any).prospect.findMany({
            where: { orgId, updatedAt: { gte: since30d } },
            select: { id: true, fullName: true, company: true, status: true, updatedAt: true, createdAt: true },
            orderBy: { updatedAt: "desc" },
            take: 50,
        }).catch(() => [] as any[]),

        (prisma as any).outboundSequence.findMany({
            where: { orgId, updatedAt: { gte: since30d } },
            select: { id: true, prospectId: true, stage: true, paused: true, nextAt: true, updatedAt: true },
            take: 50,
        }).catch(() => [] as any[]),

        (prisma as any).profitLeak.findMany({
            where: { orgId, status: { not: "resolved" } },
            select: { id: true, kind: true, severity: true, title: true, estimatedLossCents: true, createdAt: true },
            orderBy: { estimatedLossCents: "desc" },
            take: 20,
        }).catch(() => [] as any[]),
    ]);

    // ── Build nodes ───────────────────────────────────────────────────────────
    const nodes: RadarNode[] = [];
    const events: RadarEvent[] = [];

    // — Acquisition: Prospects (outbound) ————————————————————————————————————
    const seqByProspect = new Map<string, any>();
    for (const s of sequences) seqByProspect.set(s.prospectId, s);

    for (const p of prospects) {
        const seq = seqByProspect.get(p.id);
        const health = prospectHealth(p.status);
        const stageLabel = seq ? `Outbound · ${seq.stage}` : `Prospect · ${p.status}`;
        nodes.push({
            id: `prospect-${p.id}`,
            label: p.company ?? p.fullName ?? "Lead",
            quadrant: "acquisition",
            health,
            tier: "warm",
            stage: stageLabel,
            priority: health === "critical" ? 80 : health === "warning" ? 55 : 35,
            pulse: health === "critical",
            module: "outbound",
            meta: { prospectId: p.id, status: p.status, sequenceStage: seq?.stage ?? null },
        });

        if (p.status === "replied") {
            events.push(mkEvent(`ev-p-${p.id}`, "💬", `${p.company ?? p.fullName} respondeu · outbound`, "acquisition", "healthy", new Date(p.updatedAt)));
        }
    }

    // — Acquisition: Assessments (inbound leads) ——————————————————————————————
    for (const a of assessments) {
        const tier = tierFromScore(a.scoreTotal);
        const health = assessmentHealth(a.status, new Date(a.updatedAt));
        const quadrant: Quadrant = ["Qualificado", "Contatado", "Agendado"].includes(a.status)
            ? "acquisition" : a.status === "Fechado" ? "revenue" : "acquisition";
        nodes.push({
            id: `assessment-${a.id}`,
            label: a.company,
            quadrant,
            health,
            tier,
            stage: `Lead · ${a.status}`,
            priority: tier === "hot" ? 85 : tier === "warm" ? 60 : 35,
            pulse: tier === "hot" && health === "warning",
            module: "assessment",
            meta: { assessmentId: a.id, score: a.scoreTotal, status: a.status, tier },
        });

        if (a.status === "Agendado")
            events.push(mkEvent(`ev-a-${a.id}`, "📅", `${a.company} — reunião agendada`, "acquisition", "healthy", new Date(a.updatedAt)));
        if (a.status === "Fechado")
            events.push(mkEvent(`ev-af-${a.id}`, "💰", `${a.company} — deal fechado`, "revenue", "healthy", new Date(a.updatedAt)));
    }

    // — Revenue: Proposals ————————————————————————————————————————————————————
    for (const pr of proposals) {
        const health = proposalHealth(pr.status, new Date(pr.updatedAt));
        let valueCents = 0;
        try {
            const pe = JSON.parse(pr.pricingEstimate ?? "{}");
            valueCents = Math.round(((pe.min ?? 0) + (pe.max ?? 0)) / 2 * 100);
        } catch { }

        // Find linked company from assessments
        const linked = assessments.find((a: any) => a.id === pr.assessmentId);
        nodes.push({
            id: `proposal-${pr.id}`,
            label: linked?.company ?? "Proposta",
            quadrant: "revenue",
            health,
            stage: `Proposta · ${pr.status}`,
            valueCents,
            priority: health === "critical" ? 90 : health === "warning" ? 65 : 45,
            pulse: health === "critical",
            module: "proposal",
            meta: { proposalId: pr.id, status: pr.status, valueCents },
        });

        if (pr.status === "viewed")
            events.push(mkEvent(`ev-pr-${pr.id}`, "👁", `Proposta aberta — ${linked?.company ?? "cliente"}`, "revenue", "warning", new Date(pr.updatedAt)));
        if (pr.status === "accepted")
            events.push(mkEvent(`ev-pa-${pr.id}`, "✅", `Proposta aceita — ${linked?.company ?? "cliente"}`, "revenue", "healthy", new Date(pr.updatedAt)));
    }

    // — Trust: Profit Leaks ———————————————————————————————————————————————————
    let totalLossCents = 0;
    let criticalLeaks = 0;
    for (const lk of leaks) {
        const health = leakHealth(lk.severity);
        if (lk.severity === "critical") criticalLeaks++;
        totalLossCents += lk.estimatedLossCents;
        nodes.push({
            id: `leak-${lk.id}`,
            label: lk.title,
            quadrant: "trust",
            health,
            stage: `Leak · ${lk.kind}`,
            valueCents: lk.estimatedLossCents,
            priority: lk.severity === "critical" ? 95 : lk.severity === "high" ? 75 : 50,
            pulse: lk.severity === "critical",
            module: "profit_leak",
            meta: { leakId: lk.id, kind: lk.kind, severity: lk.severity, lossCents: lk.estimatedLossCents },
        });
        if (lk.severity === "critical")
            events.push(mkEvent(`ev-lk-${lk.id}`, "🚨", `Leak crítico: ${lk.title}`, "trust", "critical", new Date(lk.createdAt)));
    }

    // ── Delivery stub (no Workspace model yet — placeholder healthy node) ─────
    nodes.push({
        id: "delivery-stub", label: "Entregas em andamento", quadrant: "delivery",
        health: "healthy", stage: "Delivery · Ativo", priority: 30, pulse: false,
        module: "delivery", meta: { note: "Connect Workspace model in V24" },
    });

    // ── Sort events by time desc, take 50 ————————————————————————————————————
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const topEvents = events.slice(0, 50);

    // ── Metrics ───────────────────────────────────────────────────────────────
    const acqNodes = nodes.filter(n => n.quadrant === "acquisition");
    const revNodes = nodes.filter(n => n.quadrant === "revenue");
    const delNodes = nodes.filter(n => n.quadrant === "delivery");
    const trnNodes = nodes.filter(n => n.quadrant === "trust");

    const metrics: RadarMetrics = {
        acquisition: {
            total: acqNodes.length,
            hot: acqNodes.filter(n => n.tier === "hot").length,
            stuck: acqNodes.filter(n => n.health === "warning" || n.health === "critical").length,
        },
        revenue: {
            total: revNodes.length,
            valueCents: revNodes.reduce((s, n) => s + (n.valueCents ?? 0), 0),
            stale: revNodes.filter(n => n.health === "stale" || n.health === "warning").length,
        },
        delivery: {
            total: delNodes.length,
            healthy: delNodes.filter(n => n.health === "healthy").length,
        },
        trust: {
            total: trnNodes.length,
            criticalLeaks,
            totalLossCents,
        },
    };

    const payload: RadarPayload = {
        nodes, events: topEvents, metrics, generatedAt: new Date().toISOString(),
    };

    CACHE.set(orgId, { data: payload, at: Date.now() });
    return payload;
}
