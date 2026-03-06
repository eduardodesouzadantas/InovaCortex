"use client";

/**
 * components/charts/profit-leak-panel.tsx
 * V22.2: Profit Leak Detector — CEO Dashboard Section
 *
 * Structure:
 *   1. Header row — snapshot KPIs + window picker + last-scan + Scan Now CTA
 *   2. Loss Arc Gauge (animated SVG) — Closed vs Leaking
 *   3. Breakdown Bars (Recharts BarChart) — by leak kind, click to filter
 *   4. Leak List — actionable cards with severity pill, evidence modal, status CTAs
 *   5. Auto-refresh every 12s
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip,
    ResponsiveContainer, Cell,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────
type Window = "today" | "7d" | "30d";
type Severity = "low" | "medium" | "high" | "critical";
type LeakStatus = "open" | "acknowledged" | "resolved";
type LeakKind =
    | "lead_no_response" | "stale_followup" | "no_show"
    | "proposal_stale" | "pipeline_stall" | "low_reply_rate";

interface Leak {
    id: string;
    kind: LeakKind;
    severity: Severity;
    title: string;
    description: string;
    estimatedLossCents: number;
    evidenceJson: string;
    status: LeakStatus;
    createdAt: string;
}

interface Snapshot {
    totalLossCents: number;
    topLeakKind: string | null;
    breakdownJson: string;
}

interface Props {
    orgSlug: string;
    closedRevenueCents?: number;  // from external source for gauge ratio
    className?: string;
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const GOLD = "#d4af37";
const GOLD2 = "#f5cc5a";
const INDIGO = "#6366f1";

const SEV_CONFIG: Record<Severity, { color: string; bg: string; label: string }> = {
    critical: { color: "#f87171", bg: "rgba(239,68,68,0.15)", label: "Crítico" },
    high: { color: "#fb923c", bg: "rgba(251,146,60,0.15)", label: "Alto" },
    medium: { color: GOLD2, bg: "rgba(212,175,55,0.15)", label: "Médio" },
    low: { color: "#4ade80", bg: "rgba(34,197,94,0.12)", label: "Baixo" },
};

const KIND_LABELS: Record<LeakKind, string> = {
    lead_no_response: "Leads s/ Resposta",
    stale_followup: "Follow-up Parado",
    no_show: "No-Shows",
    proposal_stale: "Proposta Parada",
    pipeline_stall: "Pipeline Travado",
    low_reply_rate: "Resposta Baixa",
};

const KIND_COLORS: Record<LeakKind, string> = {
    lead_no_response: "#f87171",
    stale_followup: "#fb923c",
    no_show: "#f59e0b",
    proposal_stale: GOLD2,
    pipeline_stall: INDIGO,
    low_reply_rate: "#a78bfa",
};

// ─── Formatting ───────────────────────────────────────────────────────────────
function fmtBRL(cents: number) {
    const v = cents / 100;
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
    return `R$ ${v.toFixed(0)}`;
}

function timeAgo(iso: string) {
    const ms = Date.now() - new Date(iso).getTime();
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s atrás`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m}min atrás`;
    return `${Math.round(m / 60)}h atrás`;
}

// ─── 1. Loss Arc Gauge ────────────────────────────────────────────────────────
function LossArcGauge({
    closedCents, lostCents, topKind,
}: { closedCents: number; lostCents: number; topKind: string | null }) {
    const ref = useRef<SVGPathElement>(null);
    const inView = useInView(ref as any, { once: true });
    const [hovered, setHovered] = useState(false);

    const total = closedCents + lostCents;
    const pctLost = total > 0 ? lostCents / total : 0;
    const ARC_LEN = 251; // full semicircle dash-array
    const filledLost = ARC_LEN * pctLost;
    const filledClosed = ARC_LEN * (1 - pctLost);

    return (
        <div className="flex flex-col items-center"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}>
            <svg viewBox="0 0 160 90" width={200} className="overflow-visible">
                {/* Track */}
                <path d="M 15 82 A 65 65 0 0 1 145 82"
                    fill="none" stroke="rgba(255,255,255,0.06)"
                    strokeWidth={14} strokeLinecap="round" />

                {/* Closed (green) */}
                <motion.path
                    d="M 15 82 A 65 65 0 0 1 145 82"
                    fill="none" stroke="#4ade80" strokeWidth={14} strokeLinecap="round"
                    strokeDasharray={`${ARC_LEN} ${ARC_LEN}`}
                    initial={{ strokeDashoffset: ARC_LEN }}
                    animate={inView ? { strokeDashoffset: ARC_LEN - filledClosed } : {}}
                    transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                    style={{ filter: hovered ? "drop-shadow(0 0 6px #4ade8088)" : undefined }}
                />

                {/* Lost (red) — drawn from right side */}
                <motion.path
                    ref={ref}
                    d="M 145 82 A 65 65 0 0 0 15 82"
                    fill="none" stroke="#ef4444" strokeWidth={14} strokeLinecap="round"
                    strokeDasharray={`${ARC_LEN} ${ARC_LEN}`}
                    initial={{ strokeDashoffset: ARC_LEN }}
                    animate={inView ? { strokeDashoffset: ARC_LEN - filledLost } : {}}
                    transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
                    style={{ filter: hovered ? "drop-shadow(0 0 10px #ef444488)" : undefined }}
                />

                {/* Center text */}
                <text x="80" y="62" textAnchor="middle" fontSize="11"
                    fontWeight="700" fill="white" fontFamily="inherit">
                    {fmtBRL(lostCents)}
                </text>
                <text x="80" y="75" textAnchor="middle" fontSize="8"
                    fill="rgba(255,255,255,0.35)" fontFamily="inherit">
                    perda est. 30d
                </text>
            </svg>

            {/* Legend */}
            <div className="flex gap-4 mt-1">
                <LegendDot color="#4ade80" label={`Fechado ${fmtBRL(closedCents)}`} />
                <LegendDot color="#ef4444" label={`Vazando ${fmtBRL(lostCents)}`} />
            </div>

            {topKind && (
                <p className="text-xs mt-2 text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
                    top leak: <span style={{ color: GOLD2 }}>{KIND_LABELS[topKind as LeakKind] ?? topKind}</span>
                </p>
            )}
        </div>
    );
}

function LegendDot({ color, label }: { color: string; label: string }) {
    return (
        <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
        </div>
    );
}

// ─── 2. Breakdown Bars ────────────────────────────────────────────────────────
interface BreakdownBarProps {
    breakdown: Record<string, number>;
    activeKind: string | null;
    onKindClick: (kind: string | null) => void;
}

function GlassTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl px-3 py-2 text-xs"
            style={{
                background: "rgba(11,11,15,0.95)",
                border: "1px solid rgba(212,175,55,0.25)",
                backdropFilter: "blur(16px)",
            }}>
            <p className="font-semibold text-white mb-1">{KIND_LABELS[label as LeakKind] ?? label}</p>
            <p style={{ color: GOLD2 }}>{fmtBRL(payload[0]?.value)}</p>
        </div>
    );
}

function BreakdownBars({ breakdown, activeKind, onKindClick }: BreakdownBarProps) {
    const data = Object.entries(breakdown)
        .map(([kind, cents]) => ({ kind, cents, label: KIND_LABELS[kind as LeakKind] ?? kind }))
        .sort((a, b) => b.cents - a.cents);

    if (data.length === 0) return (
        <div className="flex items-center justify-center h-32 text-xs"
            style={{ color: "rgba(255,255,255,0.2)" }}>
            Nenhuma perda detectada neste período.
        </div>
    );

    return (
        <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="label" width={110}
                        tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <RTooltip content={<GlassTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="cents" radius={[0, 6, 6, 0]}
                        onClick={(d: any) => onKindClick(activeKind === d.kind ? null : d.kind)}
                        style={{ cursor: "pointer" }}>
                        {data.map((d, i) => (
                            <Cell key={d.kind}
                                fill={KIND_COLORS[d.kind as LeakKind] ?? GOLD}
                                opacity={activeKind && activeKind !== d.kind ? 0.3 : 1}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─── 3. Evidence Modal ────────────────────────────────────────────────────────
function EvidenceModal({ leak, onClose }: { leak: Leak; onClose: () => void }) {
    let evidence: any = {};
    try { evidence = JSON.parse(leak.evidenceJson); } catch { } // intentional no-op

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.94, y: 16 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.94, y: 8 }}
                transition={{ duration: 0.22 }}
                className="relative rounded-3xl p-7 max-w-md w-full"
                style={{
                    background: "rgba(14,14,20,0.98)",
                    border: "1px solid rgba(212,175,55,0.2)",
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <SeverityPill s={leak.severity} />
                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                                {KIND_LABELS[leak.kind] ?? leak.kind}
                            </span>
                        </div>
                        <p className="text-base font-bold text-white">{leak.title}</p>
                    </div>
                    <button onClick={onClose} className="text-lg leading-none"
                        style={{ color: "rgba(255,255,255,0.3)" }}>✕</button>
                </div>

                <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {leak.description}
                </p>

                {/* Evidence */}
                <div className="rounded-xl p-4 space-y-2"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GOLD }}>
                        Evidências
                    </p>
                    {Object.entries(evidence).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-xs">
                            <span style={{ color: "rgba(255,255,255,0.35)" }}>{k}</span>
                            <span className="font-mono font-semibold text-white">{String(v)}</span>
                        </div>
                    ))}
                </div>

                <div className="mt-4 text-right">
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                        Perda estimada: <span style={{ color: GOLD2, fontWeight: 700 }}>{fmtBRL(leak.estimatedLossCents)}</span>
                    </p>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ─── 4. Leak Card ─────────────────────────────────────────────────────────────
function SeverityPill({ s }: { s: Severity }) {
    const cfg = SEV_CONFIG[s];
    return (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: cfg.bg, color: cfg.color }}>
            {cfg.label}
        </span>
    );
}

interface LeakCardProps {
    leak: Leak;
    orgSlug: string;
    isAdmin: boolean;
    onUpdated: (id: string, status: LeakStatus) => void;
    onEvidence: (leak: Leak) => void;
}

function LeakCard({ leak, orgSlug, isAdmin, onUpdated, onEvidence }: LeakCardProps) {
    const [busy, setBusy] = useState(false);
    const cfg = SEV_CONFIG[leak.severity];

    async function changeStatus(status: LeakStatus) {
        setBusy(true);
        try {
            const res = await fetch(`/api/org/${orgSlug}/profit-leaks/${leak.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            if (res.ok) onUpdated(leak.id, status);
        } finally { setBusy(false); }
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="group rounded-2xl p-4"
            style={{
                background: `${cfg.color}09`,
                border: `1px solid ${cfg.color}22`,
            }}
        >
            {/* Top row */}
            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                    <SeverityPill s={leak.severity} />
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                        {KIND_LABELS[leak.kind] ?? leak.kind}
                    </span>
                </div>
                <span className="text-sm font-black tabular-nums flex-shrink-0"
                    style={{ color: cfg.color }}>
                    {fmtBRL(leak.estimatedLossCents)}
                </span>
            </div>

            {/* Title */}
            <p className="text-sm font-semibold text-white mb-1">{leak.title}</p>
            <p className="text-xs leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                {leak.description}
            </p>

            {/* CTA row */}
            <div className="flex items-center gap-2 flex-wrap">
                <button
                    onClick={() => onEvidence(leak)}
                    className="text-xs px-2.5 py-1 rounded-xl transition-opacity"
                    style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}
                >
                    Ver evidências
                </button>

                {leak.status === "open" && (
                    <button
                        onClick={() => changeStatus("acknowledged")}
                        disabled={busy}
                        className="text-xs px-2.5 py-1 rounded-xl"
                        style={{ background: "rgba(245,200,90,0.12)", color: GOLD2 }}
                    >
                        Reconhecer
                    </button>
                )}

                {isAdmin && leak.status !== "resolved" && (
                    <button
                        onClick={() => changeStatus("resolved")}
                        disabled={busy}
                        className="text-xs px-2.5 py-1 rounded-xl"
                        style={{ background: "rgba(34,197,94,0.1)", color: "#4ade80" }}
                    >
                        Resolver ✓
                    </button>
                )}

                <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.18)" }}>
                    {timeAgo(leak.createdAt)}
                </span>
            </div>
        </motion.div>
    );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export function ProfitLeakPanel({
    orgSlug,
    closedRevenueCents = 412_700_00,
    className = "",
}: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, margin: "-40px" });

    const [win, setWin] = useState<Window>("30d");
    const [leaks, setLeaks] = useState<Leak[]>([]);
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const [loading, setLoading] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [lastScan, setLastScan] = useState<Date | null>(null);
    const [kindFilter, setKindFilter] = useState<string | null>(null);
    const [evidence, setEvidence] = useState<Leak | null>(null);
    // For demo: assume admin if running locally (real app checks session)
    const isAdmin = true;

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/org/${orgSlug}/profit-leaks?window=${win}`);
            if (!res.ok) return;
            const data = await res.json();
            setSnapshot(data.snapshot ?? null);
            setLeaks(data.leaks ?? []);
            setLastScan(new Date());
        } catch { } finally { setLoading(false); }
    }, [orgSlug, win]);

    // Initial + auto-refresh every 12s
    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        const id = setInterval(load, 12_000);
        return () => clearInterval(id);
    }, [load]);

    // ── Scan Now ──────────────────────────────────────────────────────────────
    async function scanNow() {
        setScanning(true);
        try {
            const org = await fetch(`/api/org/${orgSlug}/profit-leaks`).then(r => r.json());
            const orgId = org?.leaks?.[0]?.orgId;
            await fetch("/api/admin/orchestrator/scan-profit-leaks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orgId: orgId ?? orgSlug }),
            });
            await load();
        } finally { setScanning(false); }
    }

    // ── Status update ─────────────────────────────────────────────────────────
    function handleUpdated(id: string, status: LeakStatus) {
        setLeaks(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    }

    // ── Derived ───────────────────────────────────────────────────────────────
    const breakdown: Record<string, number> = snapshot ? (() => {
        try { return JSON.parse(snapshot.breakdownJson); } catch { return {}; }
    })() : {};

    const visibleLeaks = kindFilter
        ? leaks.filter(l => l.kind === kindFilter)
        : leaks;

    const totalLoss = snapshot?.totalLossCents ?? 0;
    const topKind = snapshot?.topLeakKind ?? null;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <>
            <motion.div
                ref={ref}
                data-guide-id="cc_kpi_leaks"
                initial={{ opacity: 0, y: 24 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className={`rounded-3xl overflow-hidden relative ${className}`}
                style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(212,175,55,0.12)",
                    backdropFilter: "blur(24px)",
                }}
            >
                {/* Red ambient glow when losses exist */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
                    <div className="absolute -top-20 right-0 w-80 h-64 blur-3xl opacity-[0.07] transition-colors duration-1000"
                        style={{
                            background: totalLoss > 5_000_00
                                ? "radial-gradient(ellipse,#ef4444 0%,transparent 70%)"
                                : "radial-gradient(ellipse,#d4af37 0%,transparent 70%)"
                        }} />
                </div>

                {/* ── Header ───────────────────────────────────────────── */}
                <div className="px-7 pt-7 pb-4 flex flex-wrap items-start justify-between gap-4 relative">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.22em] mb-1"
                            style={{ color: GOLD }}>
                            Profit Leak Detector
                        </p>
                        <p className="text-3xl font-black text-white">
                            {fmtBRL(totalLoss)}
                            <span className="text-base font-semibold ml-1"
                                style={{ color: "rgba(255,255,255,0.3)" }}>
                                em risco
                            </span>
                        </p>
                        {lastScan && (
                            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
                                Último scan: {timeAgo(lastScan.toISOString())}
                                {loading && <span className="ml-2 animate-pulse">↻</span>}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Window picker */}
                        <div className="flex gap-1">
                            {(["today", "7d", "30d"] as Window[]).map(w => (
                                <button key={w} onClick={() => setWin(w)}
                                    className="text-xs px-2.5 py-1 rounded-full transition-all"
                                    style={{
                                        background: win === w ? "rgba(212,175,55,0.18)" : "rgba(255,255,255,0.05)",
                                        color: win === w ? GOLD2 : "rgba(255,255,255,0.3)",
                                        border: `1px solid ${win === w ? "rgba(212,175,55,0.3)" : "transparent"}`,
                                    }}>
                                    {w}
                                </button>
                            ))}
                        </div>

                        {/* Scan Now CTA */}
                        {(!snapshot || isAdmin) && (
                            <button
                                onClick={scanNow}
                                disabled={scanning}
                                className="text-xs px-3 py-1.5 rounded-xl font-semibold transition-all"
                                style={{
                                    background: scanning ? "rgba(255,255,255,0.05)" : "rgba(212,175,55,0.15)",
                                    color: scanning ? "rgba(255,255,255,0.3)" : GOLD2,
                                    border: `1px solid ${scanning ? "transparent" : "rgba(212,175,55,0.25)"}`,
                                }}>
                                {scanning ? "Escaneando…" : "⚡ Scan Now"}
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Body grid ────────────────────────────────────────── */}
                <div className="px-7 pb-7 grid xl:grid-cols-[220px_1fr_1fr] gap-8">

                    {/* Arc Gauge */}
                    <div className="flex items-center justify-center">
                        <LossArcGauge
                            closedCents={closedRevenueCents}
                            lostCents={totalLoss}
                            topKind={topKind}
                        />
                    </div>

                    {/* Breakdown Bars */}
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest mb-3"
                            style={{ color: "rgba(255,255,255,0.25)" }}>
                            Breakdown por tipo
                            {kindFilter && (
                                <button onClick={() => setKindFilter(null)} className="ml-2 normal-case"
                                    style={{ color: GOLD2 }}>× limpar filtro</button>
                            )}
                        </p>
                        <BreakdownBars
                            breakdown={breakdown}
                            activeKind={kindFilter}
                            onKindClick={setKindFilter}
                        />
                    </div>

                    {/* Leak List */}
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest mb-3"
                            style={{ color: "rgba(255,255,255,0.25)" }}>
                            {visibleLeaks.length} leak{visibleLeaks.length !== 1 ? "s" : ""} {kindFilter ? `· ${KIND_LABELS[kindFilter as LeakKind] ?? kindFilter}` : "ativos"}
                        </p>
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1"
                            style={{ scrollbarWidth: "none" }}>
                            <AnimatePresence mode="popLayout">
                                {visibleLeaks.length === 0 ? (
                                    <motion.div key="empty"
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                        className="py-8 text-center rounded-2xl"
                                        style={{ background: "rgba(255,255,255,0.03)" }}>
                                        <p className="text-2xl mb-1">✅</p>
                                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                                            Nenhum leak detectado.
                                        </p>
                                    </motion.div>
                                ) : (
                                    visibleLeaks.map(l => (
                                        <LeakCard
                                            key={l.id}
                                            leak={l}
                                            orgSlug={orgSlug}
                                            isAdmin={isAdmin}
                                            onUpdated={handleUpdated}
                                            onEvidence={setEvidence}
                                        />
                                    ))
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Evidence modal */}
            <AnimatePresence>
                {evidence && (
                    <EvidenceModal leak={evidence} onClose={() => setEvidence(null)} />
                )}
            </AnimatePresence>
        </>
    );
}
