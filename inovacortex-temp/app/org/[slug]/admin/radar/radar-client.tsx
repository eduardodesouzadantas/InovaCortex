"use client";

/**
 * app/org/[slug]/admin/radar/radar-client.tsx
 * V23: Business Radar — Full-screen interactive operational intelligence canvas.
 *
 * Layout:
 *   ┌────────────────────────────────────────────────────┬──────────────┐
 *   │  Filter bar (top)                                   │ Event Stream │
 *   ├──────────────────────────┬─────────────────────────┤  (right)     │
 *   │  ACQUISITION             │  REVENUE                │              │
 *   │  (top-left)              │  (top-right)            │              │
 *   ├──────────────────────────┼─────────────────────────┤              │
 *   │  DELIVERY                │  TRUST                  │              │
 *   │  (bottom-left)           │  (bottom-right)         │              │
 *   └──────────────────────────┴─────────────────────────┴──────────────┘
 *
 * Nodes are rendered as SVG circles distributed within each quadrant.
 * Click a node → opens detail drawer (right-over-event-stream).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RadarNode, RadarEvent, RadarMetrics, RadarPayload, Quadrant, NodeHealth } from "@/lib/radar/radar-loader";

// ─── Palette ─────────────────────────────────────────────────────────────────
const GOLD = "#d4af37";
const GOLD2 = "#f5cc5a";
const INDIGO = "#6366f1";

const HEALTH_COLOR: Record<NodeHealth, string> = {
    healthy: "#4ade80",
    warning: GOLD2,
    critical: "#f87171",
    stale: "rgba(255,255,255,0.3)",
};

const QUADRANT_CONFIG: Record<Quadrant, {
    label: string; icon: string;
    accentColor: string; gridX: [number, number]; gridY: [number, number];
    description: string;
}> = {
    acquisition: { label: "Aquisição", icon: "⚡", accentColor: INDIGO, gridX: [0, 0.5], gridY: [0, 0.5], description: "Leads · Outbound · Pipeline" },
    revenue: { label: "Receita", icon: "💰", accentColor: GOLD, gridX: [0.5, 1], gridY: [0, 0.5], description: "Propostas · Deals · Fechamentos" },
    delivery: { label: "Entrega", icon: "🚀", accentColor: "#34d399", gridX: [0, 0.5], gridY: [0.5, 1], description: "Workspaces · Tarefas · Go-live" },
    trust: { label: "Confiança", icon: "🛡", accentColor: "#f87171", gridX: [0.5, 1], gridY: [0.5, 1], description: "Leaks · Alertas · Saúde" },
};

// ─── Deterministic layout inside quadrant ─────────────────────────────────────
function nodePosition(node: RadarNode, index: number, total: number, svgW: number, svgH: number): { cx: number; cy: number } {
    const q = QUADRANT_CONFIG[node.quadrant];
    const pad = 40;
    const qW = (q.gridX[1] - q.gridX[0]) * svgW - pad * 2;
    const qH = (q.gridY[1] - q.gridY[0]) * svgH - pad * 2;
    const qX0 = q.gridX[0] * svgW + pad;
    const qY0 = q.gridY[0] * svgH + pad;

    // Distribute in a grid pattern within the quadrant
    const cols = Math.max(1, Math.ceil(Math.sqrt(total)));
    const row = Math.floor(index / cols);
    const col = index % cols;
    const rows = Math.ceil(total / cols);

    const cx = qX0 + (qW / Math.max(cols - 1, 1)) * col + (cols === 1 ? qW / 2 : 0);
    const cy = qY0 + (qH / Math.max(rows - 1, 1)) * row + (rows === 1 ? qH / 2 : 0);

    return { cx: Math.round(cx), cy: Math.round(cy) };
}

function nodeRadius(priority: number): number {
    return 6 + (priority / 100) * 12; // 6–18px
}

// ─── Single radar node ────────────────────────────────────────────────────────
interface NodeProps {
    node: RadarNode;
    cx: number;
    cy: number;
    selected: boolean;
    dimmed: boolean;
    onClick: () => void;
}

function Node({ node, cx, cy, selected, dimmed, onClick }: NodeProps) {
    const color = HEALTH_COLOR[node.health];
    const r = nodeRadius(node.priority);
    const qCfg = QUADRANT_CONFIG[node.quadrant];

    return (
        <g
            className="cursor-pointer"
            onClick={onClick}
            style={{ opacity: dimmed ? 0.2 : 1, transition: "opacity 0.25s" }}
        >
            {/* Pulse ring for critical */}
            {node.pulse && (
                <circle cx={cx} cy={cy} r={r + 4} fill="none"
                    stroke={color} strokeWidth={1.5} opacity={0.5}
                    style={{ animation: "radar-ping 1.8s ease-out infinite" }} />
            )}

            {/* Selection ring */}
            {selected && (
                <circle cx={cx} cy={cy} r={r + 7} fill="none"
                    stroke={GOLD2} strokeWidth={2} opacity={0.9} />
            )}

            {/* Glow blur */}
            <circle cx={cx} cy={cy} r={r + 4} fill={color} opacity={0.12} />

            {/* Main dot */}
            <circle cx={cx} cy={cy} r={r} fill={color} opacity={0.85} />

            {/* Module indicator ring */}
            <circle cx={cx} cy={cy} r={r} fill="none"
                stroke={qCfg.accentColor} strokeWidth={1} opacity={0.4} />
        </g>
    );
}

// ─── Tooltip on hover ─────────────────────────────────────────────────────────
interface TooltipState { node: RadarNode; x: number; y: number }

function NodeTooltip({ state }: { state: TooltipState }) {
    const color = HEALTH_COLOR[state.node.health];
    const fmtBRL = (c?: number) => c ? `R$ ${(c / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` : null;
    return (
        <div className="absolute z-30 pointer-events-none rounded-2xl px-4 py-3 min-w-[180px]"
            style={{
                left: state.x + 16, top: state.y - 20,
                background: "rgba(11,11,15,0.97)",
                border: `1px solid ${color}44`,
                backdropFilter: "blur(16px)",
                boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${color}22`,
            }}>
            <p className="text-xs font-bold mb-0.5" style={{ color }}>{state.node.health.toUpperCase()}</p>
            <p className="text-sm font-semibold text-white leading-snug">{state.node.label}</p>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>{state.node.stage}</p>
            {state.node.valueCents && (
                <p className="text-xs mt-1 font-bold" style={{ color: GOLD2 }}>{fmtBRL(state.node.valueCents)}</p>
            )}
        </div>
    );
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────
function DetailDrawer({ node, orgSlug, onClose }: { node: RadarNode; orgSlug: string; onClose: () => void }) {
    const color = HEALTH_COLOR[node.health];
    const qCfg = QUADRANT_CONFIG[node.quadrant];
    const fmtBRL = (c?: number) => c ? `R$ ${(c / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` : "—";

    const QUICK_ACTIONS: Record<string, { label: string; color: string }[]> = {
        assessment: [{ label: "Ver diagnóstico", color: INDIGO }, { label: "Marcar como Fechado", color: "#4ade80" }],
        proposal: [{ label: "Re-enviar proposta", color: GOLD }, { label: "Marcar como aceita", color: "#4ade80" }],
        outbound: [{ label: "Próximo passo", color: INDIGO }, { label: "Registrar resposta", color: GOLD }],
        profit_leak: [{ label: "Ver evidências", color: "#f87171" }, { label: "Reconhecer", color: GOLD }],
        delivery: [{ label: "Ver workspace", color: "#34d399" }],
    };
    const actions = QUICK_ACTIONS[node.module] ?? [];

    return (
        <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-0 bottom-0 w-80 z-40 flex flex-col"
            style={{
                background: "rgba(11,11,15,0.97)",
                border: `1px solid ${color}22`,
                backdropFilter: "blur(24px)",
            }}
        >
            {/* Header */}
            <div className="px-5 pt-5 pb-4 flex items-start justify-between"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{qCfg.icon}</span>
                        <span className="text-xs font-bold uppercase tracking-widest"
                            style={{ color: qCfg.accentColor }}>{qCfg.label}</span>
                    </div>
                    <p className="text-base font-bold text-white">{node.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{node.stage}</p>
                </div>
                <button onClick={onClose} className="text-lg" style={{ color: "rgba(255,255,255,0.3)" }}>✕</button>
            </div>

            {/* Stats */}
            <div className="px-5 py-4 space-y-3 flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                <div className="grid grid-cols-2 gap-2">
                    <StatCell label="Saúde" value={node.health} color={color} />
                    <StatCell label="Prioridade" value={`${node.priority}/100`} color={GOLD} />
                    {node.tier && <StatCell label="Tier" value={node.tier} color={INDIGO} />}
                    {node.valueCents && <StatCell label="Valor est." value={fmtBRL(node.valueCents)} color={GOLD2} />}
                </div>

                {/* Meta */}
                <div className="rounded-xl p-3 mt-2"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: GOLD }}>
                        Detalhes
                    </p>
                    {Object.entries(node.meta).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-xs py-0.5">
                            <span style={{ color: "rgba(255,255,255,0.3)" }}>{k}</span>
                            <span className="font-mono font-semibold text-white truncate ml-2 max-w-[120px]">
                                {String(v)}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Quick actions */}
                {actions.length > 0 && (
                    <div className="space-y-2 pt-2">
                        <p className="text-xs font-bold uppercase tracking-widest"
                            style={{ color: "rgba(255,255,255,0.2)" }}>Ações rápidas</p>
                        {actions.map(a => (
                            <button key={a.label}
                                className="w-full text-left text-sm font-semibold px-3 py-2 rounded-xl transition-all"
                                style={{ background: `${a.color}18`, color: a.color, border: `1px solid ${a.color}33` }}>
                                {a.label} →
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
}

function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="rounded-xl p-2.5 text-center"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</p>
            <p className="text-xs font-bold mt-0.5" style={{ color }}>{value}</p>
        </div>
    );
}

// ─── Metrics strip ────────────────────────────────────────────────────────────
function MetricStrip({ metrics }: { metrics: RadarMetrics }) {
    const fmtBRL = (c: number) => `R$ ${(c / 100 / 1000).toFixed(0)}k`;
    const items = [
        { icon: "⚡", label: "Leads ativos", value: String(metrics.acquisition.total), sub: `${metrics.acquisition.hot} hot`, color: INDIGO },
        { icon: "💰", label: "Receita exposta", value: fmtBRL(metrics.revenue.valueCents), sub: `${metrics.revenue.stale} paradas`, color: GOLD2 },
        { icon: "🚀", label: "Em entrega", value: String(metrics.delivery.total), sub: `${metrics.delivery.healthy} saudáveis`, color: "#34d399" },
        { icon: "🛡", label: "Leaks trust", value: String(metrics.trust.total), sub: fmtBRL(metrics.trust.totalLossCents) + " em risco", color: "#f87171" },
    ];
    return (
        <div className="flex gap-2 items-center flex-wrap">
            {items.map(item => (
                <div key={item.label} className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: 14 }}>{item.icon}</span>
                    <div>
                        <p className="text-xs font-bold leading-none" style={{ color: item.color }}>{item.value}</p>
                        <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>{item.sub}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Event stream ─────────────────────────────────────────────────────────────
function EventStream({ events, filterQ }: { events: RadarEvent[]; filterQ: Quadrant | null }) {
    const visible = filterQ ? events.filter(e => e.quadrant === filterQ) : events;

    function TimeAgo({ iso }: { iso: string }) {
        const ms = Date.now() - new Date(iso).getTime();
        const s = Math.round(ms / 1000);
        if (s < 60) return <>{s}s</>;
        const m = Math.round(s / 60);
        if (m < 60) return <>{m}m</>;
        return <>{Math.round(m / 60)}h</>;
    }

    return (
        <div className="flex flex-col h-full">
            <p className="text-xs font-bold uppercase tracking-widest px-4 pt-4 pb-3"
                style={{ color: GOLD, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                Event Stream
            </p>
            <div className="flex-1 overflow-y-auto px-3 pb-3" style={{ scrollbarWidth: "none" }}>
                <AnimatePresence mode="popLayout" initial={false}>
                    {visible.slice(0, 40).map(ev => (
                        <motion.div key={ev.id}
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-start gap-2 py-2"
                            style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>{ev.icon}</span>
                            <p className="text-xs flex-1 leading-snug" style={{ color: "rgba(255,255,255,0.55)" }}>
                                {ev.text}
                            </p>
                            <span className="text-xs flex-shrink-0" style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>
                                <TimeAgo iso={ev.timestamp} />
                            </span>
                        </motion.div>
                    ))}
                </AnimatePresence>
                {visible.length === 0 && (
                    <p className="text-xs text-center py-8" style={{ color: "rgba(255,255,255,0.2)" }}>
                        Sem eventos.
                    </p>
                )}
            </div>
        </div>
    );
}

// ─── Main client ──────────────────────────────────────────────────────────────
export function RadarClient({ orgSlug }: { orgSlug: string }) {
    const canvasRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [payload, setPayload] = useState<RadarPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<RadarNode | null>(null);
    const [tooltip, setTooltip] = useState<TooltipState | null>(null);
    const [filterTier, setFilterTier] = useState<string>("all");
    const [filterModule, setFilterModule] = useState<string>("all");
    const [filterQ, setFilterQ] = useState<Quadrant | null>(null);
    const [search, setSearch] = useState("");
    const [svgSize, setSvgSize] = useState({ w: 900, h: 600 });
    const [generatedAt, setGeneratedAt] = useState<string | null>(null);

    // ── Fetch ──────────────────────────────────────────────────────────────
    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/org/${orgSlug}/radar`);
            if (!res.ok) return;
            const data: RadarPayload = await res.json();
            setPayload(data);
            setGeneratedAt(data.generatedAt);
        } catch { } finally { setLoading(false); }
    }, [orgSlug]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        const id = setInterval(load, 5_000);
        return () => clearInterval(id);
    }, [load]);

    // ── Resize observer ────────────────────────────────────────────────────
    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(entries => {
            const e = entries[0];
            if (e) setSvgSize({ w: e.contentRect.width, h: e.contentRect.height });
        });
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    // ── Filtered nodes ─────────────────────────────────────────────────────
    const nodes = (payload?.nodes ?? []).filter(n => {
        if (filterTier !== "all" && n.tier !== filterTier) return false;
        if (filterModule !== "all" && n.module !== filterModule) return false;
        if (filterQ && n.quadrant !== filterQ) return false;
        if (search && !n.label.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    // Group by quadrant for layout
    const nodesByQ = new Map<Quadrant, RadarNode[]>();
    for (const n of nodes) {
        if (!nodesByQ.has(n.quadrant)) nodesByQ.set(n.quadrant, []);
        nodesByQ.get(n.quadrant)!.push(n);
    }

    // Compute positions
    const posMap = new Map<string, { cx: number; cy: number }>();
    for (const [q, qNodes] of nodesByQ.entries()) {
        qNodes.forEach((n, i) => {
            posMap.set(n.id, nodePosition(n, i, qNodes.length, svgSize.w, svgSize.h));
        });
    }

    const { w, h } = svgSize;

    function timeAgo(iso: string) {
        const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
        if (s < 60) return `${s}s atrás`;
        if (s < 3600) return `${Math.round(s / 60)}min atrás`;
        return `${Math.round(s / 3600)}h atrás`;
    }

    return (
        <div className="flex flex-col h-screen" style={{ background: "#0b0b0f", color: "#e2e2ea", fontFamily: "inherit" }}>

            {/* Inject ping animation */}
            <style>{`
                @keyframes radar-ping {
                    0%   { transform: scale(1);   opacity: 0.6; }
                    100% { transform: scale(2.2); opacity: 0; }
                }
            `}</style>

            {/* ── Top bar ─────────────────────────────────────────────────── */}
            <div className="flex-shrink-0 px-6 py-3 flex flex-wrap items-center gap-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}>

                {/* Wordmark */}
                <div className="flex items-center gap-2 mr-2">
                    <div className="w-1 h-6 rounded-full" style={{ background: `linear-gradient(to bottom, ${GOLD2}, ${GOLD})` }} />
                    <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Business Radar</p>
                </div>

                {/* Search */}
                <input
                    placeholder="Buscar empresa…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="px-3 py-1 text-xs rounded-xl border outline-none"
                    style={{
                        background: "rgba(255,255,255,0.05)",
                        borderColor: "rgba(255,255,255,0.1)",
                        color: "white",
                        width: 160,
                    }}
                />

                {/* Tier filter */}
                <FilterChips
                    value={filterTier}
                    options={[{ v: "all", l: "Todos" }, { v: "hot", l: "🔥 Hot" }, { v: "warm", l: "Warm" }, { v: "cold", l: "Cold" }]}
                    onChange={setFilterTier}
                    accent={INDIGO}
                />

                {/* Module filter */}
                <FilterChips
                    value={filterModule}
                    options={[{ v: "all", l: "Tudo" }, { v: "assessment", l: "Leads" }, { v: "outbound", l: "Outbound" }, { v: "proposal", l: "Propostas" }, { v: "profit_leak", l: "Leaks" }]}
                    onChange={setFilterModule}
                    accent={GOLD}
                />

                {/* Quadrant filter */}
                <FilterChips
                    value={filterQ ?? "all"}
                    options={[{ v: "all", l: "Todos quadrantes" }, ...Object.entries(QUADRANT_CONFIG).map(([k, v]) => ({ v: k, l: `${v.icon} ${v.label}` }))]}
                    onChange={v => setFilterQ(v === "all" ? null : v as Quadrant)}
                    accent="#34d399"
                />

                <div className="ml-auto flex items-center gap-3">
                    {payload && <MetricStrip metrics={payload.metrics} />}
                    {generatedAt && (
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                            {loading ? "↻ " : ""}{timeAgo(generatedAt)}
                        </p>
                    )}
                </div>
            </div>

            {/* ── Main area ──────────────────────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden">

                {/* SVG canvas */}
                <div ref={containerRef} className="flex-1 relative overflow-hidden">
                    <svg
                        ref={canvasRef}
                        width="100%" height="100%"
                        viewBox={`0 0 ${w} ${h}`}
                        style={{ position: "absolute", inset: 0 }}
                    >
                        <defs>
                            <radialGradient id="glow-gold" cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor={GOLD} stopOpacity={0.15} />
                                <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                            </radialGradient>
                            <radialGradient id="glow-indigo" cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor={INDIGO} stopOpacity={0.12} />
                                <stop offset="100%" stopColor={INDIGO} stopOpacity={0} />
                            </radialGradient>
                        </defs>

                        {/* Background glows per quadrant */}
                        <ellipse cx={w * 0.25} cy={h * 0.25} rx={w * 0.22} ry={h * 0.22} fill="url(#glow-indigo)" />
                        <ellipse cx={w * 0.75} cy={h * 0.25} rx={w * 0.22} ry={h * 0.22} fill="url(#glow-gold)" />
                        <ellipse cx={w * 0.25} cy={h * 0.75} rx={w * 0.20} ry={h * 0.20} fill="url(#glow-indigo)" opacity={0.5} />
                        <ellipse cx={w * 0.75} cy={h * 0.75} rx={w * 0.20} ry={h * 0.20} fill="url(#glow-gold)" opacity={0.4} />

                        {/* Grid lines */}
                        {Array.from({ length: 9 }).map((_, i) => (
                            <line key={`hg${i}`}
                                x1={0} y1={h * (i + 1) / 10} x2={w} y2={h * (i + 1) / 10}
                                stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                        ))}
                        {Array.from({ length: 9 }).map((_, i) => (
                            <line key={`vg${i}`}
                                x1={w * (i + 1) / 10} y1={0} x2={w * (i + 1) / 10} y2={h}
                                stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                        ))}

                        {/* Quadrant dividers */}
                        <line x1={w / 2} y1={0} x2={w / 2} y2={h} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
                        <line x1={0} y1={h / 2} x2={w} y2={h / 2} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

                        {/* Quadrant labels */}
                        {Object.entries(QUADRANT_CONFIG).map(([qKey, qCfg]) => {
                            const lx = qCfg.gridX[0] === 0 ? 18 : w / 2 + 18;
                            const ly = qCfg.gridY[0] === 0 ? 20 : h / 2 + 20;
                            return (
                                <g key={qKey}
                                    onClick={() => setFilterQ(filterQ === qKey as Quadrant ? null : qKey as Quadrant)}
                                    style={{ cursor: "pointer" }}>
                                    <text x={lx} y={ly} fontSize={11} fontWeight={700}
                                        fill={qCfg.accentColor} fontFamily="inherit"
                                        style={{ letterSpacing: "0.12em", textTransform: "uppercase" }}>
                                        {qCfg.icon} {qCfg.label}
                                    </text>
                                    <text x={lx} y={ly + 14} fontSize={9}
                                        fill="rgba(255,255,255,0.2)" fontFamily="inherit">
                                        {qCfg.description}
                                    </text>
                                </g>
                            );
                        })}

                        {/* Nodes */}
                        {nodes.map(n => {
                            const pos = posMap.get(n.id);
                            if (!pos) return null;
                            return (
                                <Node
                                    key={n.id}
                                    node={n}
                                    cx={pos.cx}
                                    cy={pos.cy}
                                    selected={selected?.id === n.id}
                                    dimmed={!!selected && selected.id !== n.id}
                                    onClick={() => setSelected(selected?.id === n.id ? null : n)}
                                />
                            );
                        })}
                    </svg>

                    {/* HTML tooltip (follows mouse) */}
                    {tooltip && <NodeTooltip state={tooltip} />}

                    {/* Empty state */}
                    {!loading && nodes.length === 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center"
                            style={{ pointerEvents: "none" }}>
                            <p className="text-3xl mb-2">🌌</p>
                            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                                Nenhum nó encontrado para os filtros selecionados.
                            </p>
                        </div>
                    )}

                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center"
                            style={{ pointerEvents: "none" }}>
                            <p className="text-xs animate-pulse" style={{ color: GOLD }}>Carregando radar…</p>
                        </div>
                    )}
                </div>

                {/* ── Right panel: Event Stream OR Detail Drawer ─────────── */}
                <div className="flex-shrink-0 relative" style={{ width: 280, borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
                    <EventStream events={payload?.events ?? []} filterQ={filterQ} />

                    <AnimatePresence>
                        {selected && (
                            <DetailDrawer
                                key={selected.id}
                                node={selected}
                                orgSlug={orgSlug}
                                onClose={() => setSelected(null)}
                            />
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

// ─── Filter chip group ────────────────────────────────────────────────────────
function FilterChips({ value, options, onChange, accent }: {
    value: string; options: { v: string; l: string }[];
    onChange: (v: string) => void; accent: string;
}) {
    return (
        <div className="flex gap-1">
            {options.map(o => (
                <button key={o.v} onClick={() => onChange(o.v)}
                    className="text-xs px-2 py-1 rounded-full transition-all"
                    style={{
                        background: value === o.v ? `${accent}22` : "rgba(255,255,255,0.04)",
                        color: value === o.v ? accent : "rgba(255,255,255,0.3)",
                        border: `1px solid ${value === o.v ? `${accent}44` : "transparent"}`,
                    }}>
                    {o.l}
                </button>
            ))}
        </div>
    );
}
