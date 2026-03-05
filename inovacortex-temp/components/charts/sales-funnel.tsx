"use client";

/**
 * components/charts/sales-funnel.tsx
 * Premium Animated Sales Funnel Visualization
 *
 * Stack : React + Framer Motion + TailwindCSS
 * Style : #0b0b0f · gold gradient · glass panels · Palantir/Stripe/Apple inspired
 */

import { useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface FunnelStage {
    label: string;
    value: number;
    icon: string;
    detail?: string; // Hover detail line
}

interface Props {
    stages?: FunnelStage[];
    title?: string;
    className?: string;
}

// ─── Default data ─────────────────────────────────────────────────────────────
const DEFAULT_STAGES: FunnelStage[] = [
    { label: "Leads", value: 3840, icon: "⚡", detail: "Entradas brutas do período" },
    { label: "Qualificados", value: 1920, icon: "🎯", detail: "Score ≥ 50 · ICP confirmado" },
    { label: "Reuniões", value: 768, icon: "📅", detail: "Diagnóstico agendado" },
    { label: "Propostas", value: 294, icon: "📋", detail: "Proposta comercial enviada" },
    { label: "Fechados", value: 112, icon: "💰", detail: "Contrato assinado" },
];

// ─── Palette ──────────────────────────────────────────────────────────────────
const GOLD = "#d4af37";
const GOLD2 = "#f5cc5a";
const GOLD_DARK = "#b8963e";
const INDIGO = "#6366f1";
const BG_CARD = "rgba(255,255,255,0.035)";
const BORDER = "rgba(212,175,55,0.15)";

// Stage gradient palette: indigo → violet → gold
const STAGE_COLORS = [
    { from: "#6366f1", to: "#818cf8", glow: "rgba(99,102,241,0.35)" },
    { from: "#7c3aed", to: "#a78bfa", glow: "rgba(124,58,237,0.30)" },
    { from: "#9333ea", to: "#c084fc", glow: "rgba(147,51,234,0.30)" },
    { from: "#b45309", to: "#d4af37", glow: "rgba(180,83,9,0.35)" },
    { from: GOLD_DARK, to: GOLD2, glow: "rgba(212,175,55,0.45)" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(v: number) {
    return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
}

function pct(a: number, b: number) {
    return ((a / b) * 100).toFixed(1);
}

// ─── Drop Arrow between stages ───────────────────────────────────────────────
function DropIndicator({
    from, to, visible,
}: { from: number; to: number; visible: boolean }) {
    const drop = (((from - to) / from) * 100).toFixed(0);
    const kept = ((to / from) * 100).toFixed(0);

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.85, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, y: -4 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="flex items-center justify-center gap-2 py-0.5"
                >
                    <span className="text-xs font-semibold text-red-400">−{drop}%</span>
                    <div className="flex-1 h-px" style={{ background: "rgba(239,68,68,0.25)" }} />
                    <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>
                        {kept}% avançam
                    </span>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// ─── Funnel Bar ───────────────────────────────────────────────────────────────
function FunnelBar({
    stage, index, widthPct, maxValue, isTop, delay,
}: {
    stage: FunnelStage;
    index: number;
    widthPct: number;
    maxValue: number;
    isTop: boolean;
    delay: number;
}) {
    const [hovered, setHovered] = useState(false);
    const col = STAGE_COLORS[index] ?? STAGE_COLORS[STAGE_COLORS.length - 1];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
            onHoverStart={() => setHovered(true)}
            onHoverEnd={() => setHovered(false)}
            className="group relative cursor-default"
        >
            {/* Label row */}
            <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{stage.icon}</span>
                    <span className="text-sm font-semibold text-white">{stage.label}</span>
                    {stage.detail && (
                        <motion.span
                            initial={false}
                            animate={{ opacity: hovered ? 1 : 0, x: hovered ? 0 : -6 }}
                            transition={{ duration: 0.2 }}
                            className="text-xs"
                            style={{ color: "rgba(255,255,255,0.3)" }}
                        >
                            · {stage.detail}
                        </motion.span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <motion.span
                        animate={{ color: hovered ? GOLD2 : "rgba(255,255,255,0.7)" }}
                        className="text-sm font-bold tabular-nums"
                    >
                        {fmt(stage.value)}
                    </motion.span>
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                        ({pct(stage.value, maxValue)}%)
                    </span>
                </div>
            </div>

            {/* Bar track */}
            <div
                className="relative h-12 rounded-xl overflow-hidden"
                style={{ background: "rgba(255,255,255,0.04)" }}
            >
                {/* Animated fill */}
                <motion.div
                    className="absolute inset-y-0 left-0 rounded-xl"
                    style={{
                        background: `linear-gradient(90deg, ${col.from}, ${col.to})`,
                    }}
                    initial={{ width: "0%" }}
                    animate={{ width: `${widthPct}%` }}
                    transition={{ duration: 1.0, delay: delay + 0.15, ease: [0.16, 1, 0.3, 1] }}
                />

                {/* Glow overlay on hover */}
                <motion.div
                    className="absolute inset-0 rounded-xl pointer-events-none"
                    animate={{ opacity: hovered ? 1 : 0 }}
                    transition={{ duration: 0.2 }}
                    style={{
                        background: `radial-gradient(ellipse at 30% 50%, ${col.glow}, transparent 70%)`,
                    }}
                />

                {/* Shine shimmer */}
                <motion.div
                    className="absolute inset-y-0 w-1/3 pointer-events-none"
                    style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }}
                    initial={{ x: "-100%" }}
                    animate={{ x: "350%" }}
                    transition={{ duration: 1.6, delay: delay + 0.3, ease: "easeOut" }}
                />

                {/* Value inside bar (if wide enough) */}
                {widthPct > 20 && (
                    <motion.div
                        className="absolute inset-0 flex items-center px-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: delay + 0.6 }}
                    >
                        <span className="text-xs font-bold text-white/60">{fmt(stage.value)} {stage.label.toLowerCase()}</span>
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function SalesFunnel({ stages = DEFAULT_STAGES, title = "Funil de Vendas", className = "" }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, margin: "-60px" });
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    const maxValue = stages[0]?.value ?? 1;
    const totalClose = stages[stages.length - 1]?.value ?? 0;
    const overallConv = ((totalClose / maxValue) * 100).toFixed(1);

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 28 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className={`relative rounded-3xl overflow-hidden ${className}`}
            style={{ background: BG_CARD, border: `1px solid ${BORDER}`, backdropFilter: "blur(24px)" }}
        >
            {/* Ambient glow */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-2/3 h-48 blur-3xl opacity-10"
                    style={{ background: `radial-gradient(ellipse, ${GOLD} 0%, transparent 70%)` }} />
                <div className="absolute bottom-0 right-0 w-48 h-48 blur-3xl opacity-8"
                    style={{ background: `radial-gradient(ellipse, ${INDIGO} 0%, transparent 70%)` }} />
            </div>

            {/* Header */}
            <div className="px-7 pt-7 pb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: GOLD }}>
                        {title}
                    </p>
                    <p className="text-3xl font-extrabold text-white tracking-tight">
                        {inView ? fmt(totalClose) : "—"}
                        <span className="text-lg font-semibold ml-1" style={{ color: "rgba(255,255,255,0.4)" }}> deals</span>
                    </p>
                </div>

                {/* Summary pills */}
                <motion.div
                    initial={{ opacity: 0, x: 12 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.3 }}
                    className="flex flex-wrap gap-2"
                >
                    <Pill label="Conversão geral" value={`${overallConv}%`} color="#4ade80" />
                    <Pill label="Entradas" value={fmt(maxValue)} color={INDIGO} />
                    <Pill label="Fechados" value={fmt(totalClose)} color={GOLD} />
                </motion.div>
            </div>

            {/* Funnel bars */}
            <div className="px-7 pb-7 space-y-1">
                {stages.map((stage, i) => {
                    const widthPct = (stage.value / maxValue) * 100;
                    const prevValue = i > 0 ? stages[i - 1].value : null;

                    return (
                        <div key={stage.label}
                            onMouseEnter={() => setHoveredIdx(i)}
                            onMouseLeave={() => setHoveredIdx(null)}
                        >
                            {/* Drop indicator between stages */}
                            {prevValue !== null && inView && (
                                <DropIndicator
                                    from={prevValue}
                                    to={stage.value}
                                    visible={true}
                                />
                            )}
                            <FunnelBar
                                stage={stage}
                                index={i}
                                widthPct={widthPct}
                                maxValue={maxValue}
                                isTop={i === 0}
                                delay={inView ? i * 0.1 : 0}
                            />
                        </div>
                    );
                })}
            </div>

            {/* Stage-to-stage conversion table */}
            <div className="mx-7 mb-7 rounded-2xl overflow-hidden"
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="px-4 py-3 grid grid-cols-4 text-xs font-bold uppercase tracking-wider"
                    style={{ color: "rgba(255,255,255,0.3)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span>Etapa</span>
                    <span className="text-center">Volume</span>
                    <span className="text-center">Conv. parcial</span>
                    <span className="text-right">Conv. total</span>
                </div>
                {stages.map((stage, i) => {
                    const partialConv = i > 0 ? pct(stage.value, stages[i - 1].value) : "—";
                    const totalConvPct = pct(stage.value, maxValue);
                    const isLast = i === stages.length - 1;
                    return (
                        <motion.div
                            key={stage.label}
                            initial={{ opacity: 0, x: -8 }}
                            animate={inView ? { opacity: 1, x: 0 } : {}}
                            transition={{ delay: 0.5 + i * 0.07, duration: 0.35 }}
                            className="px-4 py-2.5 grid grid-cols-4 text-xs transition-colors"
                            style={{
                                borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.04)",
                                color: isLast ? GOLD : "rgba(255,255,255,0.65)",
                                fontWeight: isLast ? 700 : 400,
                            }}
                        >
                            <span className="flex items-center gap-1.5">{stage.icon} {stage.label}</span>
                            <span className="text-center tabular-nums">{fmt(stage.value)}</span>
                            <span className="text-center tabular-nums" style={{ color: i > 0 ? (Number(partialConv) < 50 ? "#f87171" : "#4ade80") : "rgba(255,255,255,0.3)" }}>
                                {partialConv !== "—" ? `${partialConv}%` : "—"}
                            </span>
                            <span className="text-right tabular-nums" style={{ color: isLast ? GOLD : undefined }}>
                                {totalConvPct}%
                            </span>
                        </motion.div>
                    );
                })}
            </div>

            {/* Bottom stat bar */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : {}}
                transition={{ delay: 0.9 }}
                className="mx-7 mb-7 grid grid-cols-3 gap-3"
            >
                {[
                    { label: "Leads → Qualif.", value: pct(stages[1]?.value ?? 0, maxValue) + "%", color: "#818cf8" },
                    { label: "Qualif. → Reunião", value: pct(stages[2]?.value ?? 0, stages[1]?.value ?? 1) + "%", color: "#a78bfa" },
                    { label: "Proposta → Fechado", value: pct(stages[4]?.value ?? 0, stages[3]?.value ?? 1) + "%", color: GOLD },
                ].map(s => (
                    <div key={s.label} className="rounded-xl py-3 px-4 text-center"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <p className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{s.label}</p>
                    </div>
                ))}
            </motion.div>
        </motion.div>
    );
}

// ─── Pill ─────────────────────────────────────────────────────────────────────
function Pill({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="rounded-xl px-3 py-2"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="text-xs leading-none mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>{label}</p>
            <p className="text-xs font-bold leading-none" style={{ color }}>{value}</p>
        </div>
    );
}
