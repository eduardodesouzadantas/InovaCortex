/**
 * lib/profit-leak/leak-engine.ts
 * V22.1: Profit Leak Detector — 6 deterministic compute functions.
 *
 * All functions are PURE with respect to their inputs.
 * Database I/O lives in runProfitLeakScan() at the bottom.
 * Nothing calls an LLM. Zero tokens used.
 */

import {
    LEAD_VALUE_CENTS, CLOSE_PROBABILITY, DEDUP_WINDOW_MS,
    NO_RESPONSE_THRESHOLD_MS, PROPOSAL_STALE_THRESHOLD_MS,
    PIPELINE_STALL_THRESHOLD_MS, STALE_FOLLOWUP_THRESHOLD_MS,
    MIN_REPLY_RATE, MIN_OUTBOUND_SAMPLE, NO_SHOW_COST_CENTS,
    expectedRevenueCents, classifySeverity,
    type LeadTier, type LeakSeverity,
} from "./leak-rules";

// ─── Shared types ─────────────────────────────────────────────────────────────
export type LeakKind =
    | "lead_no_response"
    | "stale_followup"
    | "no_show"
    | "proposal_stale"
    | "pipeline_stall"
    | "low_reply_rate";

export interface LeakResult {
    kind: LeakKind;
    severity: LeakSeverity;
    title: string;
    description: string;
    estimatedLossCents: number;
    evidenceJson: string; // serialised evidence object
}

// ─── 1. Lead No-Response ──────────────────────────────────────────────────────
export interface LeadNoResponseInput {
    leads: Array<{
        id: string;
        tier?: string;       // "hot" | "warm" | "cold"
        createdAt: Date;
        firstReplyAt?: Date | null;
    }>;
    now?: Date;
}

export function computeLeadNoResponseLeak(input: LeadNoResponseInput): LeakResult | null {
    const now = input.now ?? new Date();
    const affected: typeof input.leads = [];
    let totalLoss = 0;

    for (const lead of input.leads) {
        if (lead.firstReplyAt) continue; // already replied
        const tier = (input.leads.find(l => l.id === lead.id)?.tier ?? "unknown") as LeadTier;
        const safeT = Object.keys(NO_RESPONSE_THRESHOLD_MS).includes(tier) ? tier : "unknown";
        const thresh = NO_RESPONSE_THRESHOLD_MS[safeT as LeadTier];
        const age = now.getTime() - lead.createdAt.getTime();
        if (age >= thresh) {
            affected.push(lead);
            totalLoss += expectedRevenueCents(safeT as LeadTier);
        }
    }

    if (affected.length === 0) return null;

    return {
        kind: "lead_no_response",
        severity: classifySeverity(totalLoss),
        title: `${affected.length} lead${affected.length > 1 ? "s" : ""} sem resposta`,
        description: `${affected.length} lead${affected.length > 1 ? "s qualificados" : " qualificado"} aguardando primeiro contato além do prazo.`,
        estimatedLossCents: totalLoss,
        evidenceJson: JSON.stringify({
            count: affected.length,
            sampleIds: affected.slice(0, 5).map(l => l.id),
        }),
    };
}

// ─── 2. Stale Follow-up ───────────────────────────────────────────────────────
export interface StaleFollowupInput {
    sequences: Array<{
        id: string;
        prospectId: string;
        paused: boolean;
        updatedAt: Date;
        tier?: string;        // from linked prospect
    }>;
    now?: Date;
}

export function computeStaleFollowupLeak(input: StaleFollowupInput): LeakResult | null {
    const now = input.now ?? new Date();
    const stale = input.sequences.filter(s => {
        const age = now.getTime() - s.updatedAt.getTime();
        return age >= STALE_FOLLOWUP_THRESHOLD_MS;
    });

    if (stale.length === 0) return null;

    const costPerSeq = expectedRevenueCents("warm"); // conservative estimate
    const totalLoss = stale.length * costPerSeq;

    return {
        kind: "stale_followup",
        severity: classifySeverity(totalLoss),
        title: `${stale.length} cadência${stale.length > 1 ? "s" : ""} parada${stale.length > 1 ? "s" : ""} há 4+ dias`,
        description: `Sequências de outbound estagnadas sem envio. Cada dia adicional reduz taxa de resposta em ~8%.`,
        estimatedLossCents: totalLoss,
        evidenceJson: JSON.stringify({
            count: stale.length,
            sampleIds: stale.slice(0, 5).map(s => s.id),
        }),
    };
}

// ─── 3. No-Show ───────────────────────────────────────────────────────────────
export interface NoShowInput {
    noShowCount: number;
    windowDays?: number;
}

export function computeNoShowLeak(input: NoShowInput): LeakResult | null {
    if (input.noShowCount === 0) return null;

    const totalLoss = input.noShowCount * NO_SHOW_COST_CENTS;
    const win = input.windowDays ?? 30;

    return {
        kind: "no_show",
        severity: classifySeverity(totalLoss),
        title: `${input.noShowCount} no-show${input.noShowCount > 1 ? "s" : ""} em ${win} dias`,
        description: `Reuniões marcadas sem comparecimento. Incluem custo de oportunidade e tempo de vendedor.`,
        estimatedLossCents: totalLoss,
        evidenceJson: JSON.stringify({ count: input.noShowCount, windowDays: win }),
    };
}

// ─── 4. Proposal Stale ────────────────────────────────────────────────────────
export interface ProposalStaleInput {
    proposals: Array<{
        id: string;
        tier?: string;
        status: string;      // "sent" | "viewed"
        sentAt: Date;
        value?: number;      // proposal value in cents (optional override)
    }>;
    now?: Date;
}

export function computeProposalStaleLeak(input: ProposalStaleInput): LeakResult | null {
    const now = input.now ?? new Date();
    const stale: typeof input.proposals = [];
    let totalLoss = 0;

    for (const p of input.proposals) {
        if (!["sent", "viewed"].includes(p.status)) continue;
        const tier = (p.tier ?? "unknown") as LeadTier;
        const safeT = Object.keys(PROPOSAL_STALE_THRESHOLD_MS).includes(tier) ? tier : "unknown";
        const thresh = PROPOSAL_STALE_THRESHOLD_MS[safeT as LeadTier];
        const age = now.getTime() - p.sentAt.getTime();
        if (age >= thresh) {
            stale.push(p);
            // Use explicit value if given, else expected revenue
            totalLoss += p.value ?? expectedRevenueCents(safeT as LeadTier);
        }
    }

    if (stale.length === 0) return null;

    return {
        kind: "proposal_stale",
        severity: classifySeverity(totalLoss),
        title: `${stale.length} proposta${stale.length > 1 ? "s" : ""} sem resposta`,
        description: `Propostas enviadas/abertas mas sem avanço. Probabilidade de fechamento cai 50% após limite de tempo.`,
        estimatedLossCents: totalLoss,
        evidenceJson: JSON.stringify({
            count: stale.length,
            sampleIds: stale.slice(0, 5).map(p => p.id),
        }),
    };
}

// ─── 5. Pipeline Stall ────────────────────────────────────────────────────────
export interface PipelineStallInput {
    leads: Array<{
        id: string;
        stage: string;    // e.g. "qualified" | "meeting" | "proposal"
        stageUpdatedAt: Date;
        tier?: string;
    }>;
    now?: Date;
    thresholdMs?: number;
}

export function computePipelineStallLeak(input: PipelineStallInput): LeakResult | null {
    const now = input.now ?? new Date();
    const thresh = input.thresholdMs ?? PIPELINE_STALL_THRESHOLD_MS;
    const stalled = input.leads.filter(l => (now.getTime() - l.stageUpdatedAt.getTime()) >= thresh);

    if (stalled.length === 0) return null;

    const costPerLead = expectedRevenueCents("warm"); // conservative
    const totalLoss = stalled.length * costPerLead;

    return {
        kind: "pipeline_stall",
        severity: classifySeverity(totalLoss),
        title: `${stalled.length} lead${stalled.length > 1 ? "s" : ""} travado${stalled.length > 1 ? "s" : ""} no pipeline`,
        description: `Leads sem mudança de estágio há 5+ dias. Deals travados esfriaram e reduzem taxa de fechamento.`,
        estimatedLossCents: totalLoss,
        evidenceJson: JSON.stringify({
            count: stalled.length,
            stages: [...new Set(stalled.map(l => l.stage))],
            sampleIds: stalled.slice(0, 5).map(l => l.id),
        }),
    };
}

// ─── 6. Low Reply Rate ────────────────────────────────────────────────────────
export interface LowReplyRateInput {
    totalMessages: number;
    replies: number;
    windowDays?: number;
}

export function computeLowReplyRateLeak(input: LowReplyRateInput): LeakResult | null {
    if (input.totalMessages < MIN_OUTBOUND_SAMPLE) return null;

    const rate = input.replies / input.totalMessages;
    if (rate >= MIN_REPLY_RATE) return null;

    // Opportunity cost: messages below baseline that could have replied
    const missedReplies = Math.round((MIN_REPLY_RATE - rate) * input.totalMessages);
    const totalLoss = missedReplies * expectedRevenueCents("warm");

    return {
        kind: "low_reply_rate",
        severity: classifySeverity(totalLoss),
        title: `Taxa de resposta abaixo do baseline (${(rate * 100).toFixed(1)}%)`,
        description: `Meta mínima: ${(MIN_REPLY_RATE * 100).toFixed(0)}%. Taxa atual sugere mensagens genéricas ou ICP incorreto.`,
        estimatedLossCents: totalLoss,
        evidenceJson: JSON.stringify({
            totalMessages: input.totalMessages,
            replies: input.replies,
            rate: parseFloat(rate.toFixed(4)),
            baseline: MIN_REPLY_RATE,
            windowDays: input.windowDays ?? 30,
        }),
    };
}

// ─── Orchestrator: runProfitLeakScan ─────────────────────────────────────────
/** Full scan: queries DB, runs 6 rules, upserts ProfitLeak rows + snapshots. */
export async function runProfitLeakScan(orgId: string): Promise<{
    leaksCreated: number;
    leaksUpdated: number;
    snapshot: { today: number; "7d": number; "30d": number };
}> {
    const { prisma } = await import("@/lib/prisma");
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ── Gather raw data ───────────────────────────────────────────────────────
    const [
        rawLeads,
        rawSequences,
        rawProposals,
        noShowCount,
        outboundStats,
    ] = await Promise.all([
        // Leads / Prospects
        (prisma as any).prospect.findMany({
            where: { orgId },
            select: { id: true, status: true, createdAt: true, updatedAt: true, industry: true },
        }).catch(() => [] as any[]),

        // Sequences
        (prisma as any).outboundSequence.findMany({
            where: { orgId },
            select: { id: true, prospectId: true, paused: true, updatedAt: true, stage: true },
        }).catch(() => [] as any[]),

        // Proposals — use Assessment or DealPacket as proxy
        (prisma as any).dealPacket?.findMany?.({
            where: { orgId, status: { in: ["sent", "viewed"] } },
            select: { id: true, status: true, createdAt: true },
        }).catch(() => [] as any[]) ?? [],

        // No-shows counted from DealSignal if available
        (prisma as any).dealSignal?.count?.({
            where: { orgId, signal: "no_show", createdAt: { gte: d30 } },
        }).catch(() => 0) ?? 0,

        // Outbound message stats
        (prisma as any).outboundMessage.aggregate({
            where: { orgId, createdAt: { gte: d30 } },
            _count: { id: true },
        }).catch(() => ({ _count: { id: 0 } })),
    ]);

    // Replies = prospects who replied
    const repliedCount = ((await (prisma as any).prospect.count({
        where: { orgId, status: "replied", updatedAt: { gte: d30 } },
    }).catch(() => 0)) as number);

    // ── Run rules ─────────────────────────────────────────────────────────────
    const leakInputs: LeakResult[] = [];

    const r1 = computeLeadNoResponseLeak({
        leads: rawLeads.map((l: any) => ({
            id: l.id, tier: "warm", createdAt: new Date(l.createdAt), firstReplyAt: l.status === "replied" ? l.updatedAt : null,
        })), now,
    });
    if (r1) leakInputs.push(r1);

    const r2 = computeStaleFollowupLeak({
        sequences: rawSequences.map((s: any) => ({ id: s.id, prospectId: s.prospectId, paused: s.paused, updatedAt: new Date(s.updatedAt) })), now,
    });
    if (r2) leakInputs.push(r2);

    const r3 = computeNoShowLeak({ noShowCount: noShowCount as number });
    if (r3) leakInputs.push(r3);

    const r4 = computeProposalStaleLeak({
        proposals: (rawProposals as any[]).map((p: any) => ({ id: p.id, tier: "hot", status: p.status, sentAt: new Date(p.createdAt) })), now,
    });
    if (r4) leakInputs.push(r4);

    const r5 = computePipelineStallLeak({
        leads: rawLeads.filter((l: any) => !["meeting", "lost", "do_not_contact"].includes(l.status)).map((l: any) => ({
            id: l.id, stage: l.status, stageUpdatedAt: new Date(l.updatedAt), tier: "warm",
        })), now,
    });
    if (r5) leakInputs.push(r5);

    const r6 = computeLowReplyRateLeak({
        totalMessages: (outboundStats as any)?._count?.id ?? 0,
        replies: repliedCount,
    });
    if (r6) leakInputs.push(r6);

    // ── Upsert ProfitLeak rows (idempotent per org+kind within DEDUP_WINDOW_MS) ─
    let created = 0, updated = 0;
    const dedupCutoff = new Date(now.getTime() - DEDUP_WINDOW_MS);

    for (const leak of leakInputs) {
        const existing = await (prisma as any).profitLeak.findFirst({
            where: { orgId, kind: leak.kind, createdAt: { gte: dedupCutoff } },
            orderBy: { createdAt: "desc" },
        }).catch(() => null);

        if (existing) {
            await (prisma as any).profitLeak.update({
                where: { id: existing.id },
                data: {
                    severity: leak.severity,
                    title: leak.title,
                    description: leak.description,
                    estimatedLossCents: leak.estimatedLossCents,
                    evidenceJson: leak.evidenceJson,
                },
            }).catch(() => null);
            updated++;
        } else {
            await (prisma as any).profitLeak.create({
                data: { orgId, status: "open", ...leak },
            }).catch(() => null);
            created++;
        }
    }

    // ── Build snapshots per window ────────────────────────────────────────────
    const windowConfigs = [
        { window: "today", cutoff: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
        { window: "7d", cutoff: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
        { window: "30d", cutoff: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
    ];

    const snapshotTotals: Record<string, number> = {};

    for (const wc of windowConfigs) {
        const rows = await (prisma as any).profitLeak.findMany({
            where: { orgId, status: { not: "resolved" }, createdAt: { gte: wc.cutoff } },
        }).catch(() => [] as any[]);

        const breakdown: Record<string, number> = {};
        let total = 0;
        for (const row of rows) {
            breakdown[row.kind] = (breakdown[row.kind] ?? 0) + row.estimatedLossCents;
            total += row.estimatedLossCents;
        }
        snapshotTotals[wc.window] = total;

        const topKind = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

        await (prisma as any).profitLeakSnapshot.upsert({
            where: { orgId_window: { orgId, window: wc.window } },
            create: { orgId, window: wc.window, totalLossCents: total, topLeakKind: topKind, breakdownJson: JSON.stringify(breakdown) },
            update: { totalLossCents: total, topLeakKind: topKind, breakdownJson: JSON.stringify(breakdown), createdAt: now },
        }).catch(() => null);
    }

    return {
        leaksCreated: created,
        leaksUpdated: updated,
        snapshot: {
            today: snapshotTotals["today"] ?? 0,
            "7d": snapshotTotals["7d"] ?? 0,
            "30d": snapshotTotals["30d"] ?? 0,
        },
    };
}
