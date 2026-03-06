"use client";

/**
 * components/charts/team-leaderboard.tsx
 * Premium Animated Sales Team Performance Chart
 *
 * Stack : React + Framer Motion + TailwindCSS (no Recharts — pure CSS bars for max control)
 * Style : #0b0b0f · gold bars · top-performer glow · glassmorphism · Palantir/Stripe inspired
 */

import { useState, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Salesperson {
    name: string;
    avatar?: string;   // initials fallback if no image
    revenue: number;   // R$
    deals: number;
    convRate: number;   // 0–100
    trend?: "up" | "down" | "flat";
}

interface Props {
    data?: Salesperson[];
    title?: string;
    className?: string;
}

// ─── Default data ─────────────────────────────────────────────────────────────
const DEFAULT_DATA: Salesperson[] = [
    { name: "Marina Lima", revenue: 312000, deals: 24, convRate: 42, trend: "up" },
    { name: "Rafael Gomes", revenue: 267500, deals: 19, convRate: 38, trend: "up" },
    { name: "Camila Santos", revenue: 218000, deals: 17, convRate: 35, trend: "flat" },
    { name: "Bruno Alves", revenue: 184300, deals: 14, convRate: 31, trend: "down" },
    { name: "Juliana Matos", revenue: 157600, deals: 12, convRate: 28, trend: "up" },
    { name: "Thiago Peixoto", revenue: 124100, deals: 10, convRate: 24, trend: "flat" },
    { name: "Larissa Vieira", revenue: 98500, deals: 8, convRate: 21, trend: "down" },
];

// ─── Palette ──────────────────────────────────────────────────────────────────
const GOLD = "#d4af37";
const GOLD2 = "#f5cc5a";
const GOLD3 = "#7d631f";
const BG_CARD = "rgba(255,255,255,0.035)";
const BORDER = "rgba(212,175,55,0.15)";

function fmt(v: number) {
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
    return `R$ ${v}`;
}

function initials(name: string) {
    return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

const TREND_ICON: Record<string, string> = { up: "↑", down: "↓", flat: "→" };
const TREND_COLOR: Record<string, string> = { up: "#4ade80", down: "#f87171", flat: "rgba(255,255,255,0.35)" };

const RANK_MEDAL: Record<number, { icon: string; color: string }> = {
    0: { icon: "🥇", color: GOLD2 },
    1: { icon: "🥈", color: "#94a3b8" },
    2: { icon: "🥉", color: "#cd7f32" },
};

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, rank }: { name: string; rank: number }) {
    const isTop = rank === 0;
    return (
        <div className="relative flex-shrink-0">
            <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                style={{
                    background: isTop
                        ? `linear-gradient(135deg, ${GOLD3}, ${GOLD})`
                        : "rgba(255,255,255,0.07)",
                    color: isTop ? "#0b0b0f" : "rgba(255,255,255,0.6)",
                    boxShadow: isTop ? `0 0 16px rgba(212,175,55,0.4)` : undefined,
                }}
            >
                {initials(name)}
            </div>
            {rank < 3 && (
                <span className="absolute -top-1.5 -right-1.5 text-base leading-none">
                    {RANK_MEDAL[rank]?.icon}
                </span>
            )}
        </div>
    );
}

// ─── Bar Row ─────────────────────────────────────────────────────────────────
function BarRow({
    person, rank, maxRevenue, delay, isTop,
}: {
    person: Salesperson;
    rank: number;
    maxRevenue: number;
    delay: number;
    isTop: boolean;
}) {
    const [hovered, setHovered] = useState(false);
    const widthPct = (person.revenue / maxRevenue) * 100;

    return (
        <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
            onHoverStart={() => setHovered(true)}
            onHoverEnd={() => setHovered(false)}
            className="group relative rounded-2xl p-3 transition-colors cursor-default"
            style={{
                background: hovered
                    ? "rgba(255,255,255,0.055)"
                    : isTop ? "rgba(212,175,55,0.04)" : "transparent",
                border: `1px solid ${hovered || isTop ? BORDER : "transparent"}`,
            }}
        >
            <div className="flex items-center gap-4">
                {/* Rank number */}
                <span className="w-5 text-xs font-bold text-center tabular-nums flex-shrink-0"
                    style={{ color: rank < 3 ? RANK_MEDAL[rank]?.color : "rgba(255,255,255,0.25)" }}>
                    {rank + 1}
                </span>

                {/* Avatar */}
                <Avatar name={person.name} rank={rank} />

                {/* Name + Trend */}
                <div className="w-32 flex-shrink-0">
                    <p className="text-sm font-semibold truncate text-white">{person.name.split(" ")[0]}</p>
                    <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
                        {person.name.split(" ").slice(1).join(" ")}
                    </p>
                </div>

                {/* Bar track */}
                <div className="flex-1 min-w-0">
                    <div className="relative h-7 rounded-lg overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.05)" }}>

                        {/* Fill */}
                        <motion.div
                            className="absolute inset-y-0 left-0 rounded-lg"
                            initial={{ width: "0%" }}
                            animate={{ width: `${widthPct}%` }}
                            transition={{ duration: 1.0, delay: delay + 0.2, ease: [0.16, 1, 0.3, 1] }}
                            style={{
                                background: isTop
                                    ? `linear-gradient(90deg, ${GOLD3}aa, ${GOLD}, ${GOLD2})`
                                    : `linear-gradient(90deg, rgba(99,102,241,0.6), rgba(139,92,246,0.8))`,
                            }}
                        />

                        {/* Top performer glow pulse */}
                        {isTop && (
                            <motion.div
                                className="absolute inset-0 rounded-lg pointer-events-none"
                                animate={{
                                    opacity: [0, 0.5, 0],
                                    boxShadow: [`inset 0 0 0px ${GOLD}`, `inset 0 0 16px ${GOLD}`, `inset 0 0 0px ${GOLD}`],
                                }}
                                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
                            />
                        )}

                        {/* Revenue label inside bar */}
                        <div className="absolute inset-0 flex items-center px-3">
                            <span className="text-xs font-bold text-white/70">{fmt(person.revenue)}</span>
                        </div>
                    </div>
                </div>

                {/* Right metrics */}
                <div className="flex-shrink-0 text-right w-24">
                    <p className="text-sm font-bold" style={{ color: isTop ? GOLD2 : "rgba(255,255,255,0.8)" }}>
                        {person.deals} deals
                    </p>
                    <p className="text-xs flex items-center justify-end gap-1">
                        <span style={{ color: TREND_COLOR[person.trend ?? "flat"] }}>
                            {TREND_ICON[person.trend ?? "flat"]}
                        </span>
                        <span style={{ color: "rgba(255,255,255,0.4)" }}>{person.convRate}% conv.</span>
                    </p>
                </div>
            </div>

            {/* Hover detail tooltip */}
            <AnimatePresence>
                {hovered && (
                    <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.97 }}
                        transition={{ duration: 0.18 }}
                        className="absolute right-3 -bottom-[72px] z-20 rounded-2xl px-4 py-3 min-w-[200px]"
                        style={{
                            background: "rgba(11,11,15,0.97)",
                            border: `1px solid ${BORDER}`,
                            backdropFilter: "blur(16px)",
                            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                        }}
                    >
                        <p className="text-xs font-bold mb-2" style={{ color: GOLD }}>{person.name}</p>
                        <div className="space-y-1">
                            <Row label="Receita" value={fmt(person.revenue)} color={isTop ? GOLD2 : "white"} />
                            <Row label="Deals" value={String(person.deals)} />
                            <Row label="Conversão" value={`${person.convRate}%`} />
                            <Row label="Tendência" value={`${TREND_ICON[person.trend ?? "flat"]} ${person.trend ?? "flat"}`}
                                color={TREND_COLOR[person.trend ?? "flat"]} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function Row({ label, value, color = "rgba(255,255,255,0.75)" }: { label: string; value: string; color?: string }) {
    return (
        <div className="flex justify-between items-center gap-4">
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>{label}</span>
            <span style={{ color, fontSize: 12, fontWeight: 600 }}>{value}</span>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function TeamLeaderboard({ data = DEFAULT_DATA, title = "Leaderboard do Time", className = "" }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, margin: "-60px" });

    // Sort by revenue desc
    const sorted = [...data].sort((a, b) => b.revenue - a.revenue);
    const maxRevenue = sorted[0]?.revenue ?? 1;
    const totalRevenue = sorted.reduce((s, p) => s + p.revenue, 0);
    const totalDeals = sorted.reduce((s, p) => s + p.deals, 0);
    const avgConv = (sorted.reduce((s, p) => s + p.convRate, 0) / sorted.length).toFixed(1);

    return (
        <motion.div
            ref={ref}
            data-guide-id="perf_leaderboard"
            initial={{ opacity: 0, y: 28 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className={`relative rounded-3xl overflow-visible ${className}`}
            style={{ background: BG_CARD, border: `1px solid ${BORDER}`, backdropFilter: "blur(24px)" }}
        >
            {/* Ambient glow */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
                <div className="absolute top-0 left-0 w-64 h-64 blur-3xl opacity-8"
                    style={{ background: `radial-gradient(ellipse, ${GOLD} 0%, transparent 70%)` }} />
            </div>

            {/* Header */}
            <div className="px-7 pt-7 pb-4 flex flex-wrap items-start justify-between gap-4 relative">
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: GOLD }}>
                        {title}
                    </p>
                    <p className="text-3xl font-extrabold text-white tracking-tight">
                        {sorted.length}
                        <span className="text-lg font-semibold ml-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                            vendedores
                        </span>
                    </p>
                </div>

                <motion.div
                    initial={{ opacity: 0, x: 12 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.25 }}
                    className="flex flex-wrap gap-2"
                >
                    <Pill label="Receita total" value={fmt(totalRevenue)} color={GOLD} />
                    <Pill label="Total de deals" value={String(totalDeals)} color="#818cf8" />
                    <Pill label="Conv. média" value={`${avgConv}%`} color="#4ade80" />
                </motion.div>
            </div>

            {/* Column headers */}
            <div className="px-7 pb-1">
                <div className="flex items-center gap-4 text-xs uppercase tracking-widest mb-1"
                    style={{ color: "rgba(255,255,255,0.2)" }}>
                    <span className="w-5 text-center">#</span>
                    <span className="w-10" />
                    <span className="w-32">Vendedor</span>
                    <span className="flex-1 ml-0">Receita</span>
                    <span className="w-24 text-right">Deals · Conv.</span>
                </div>
            </div>

            {/* Rows */}
            <div className="px-4 pb-6 space-y-1 relative">
                {sorted.map((person, i) => (
                    <BarRow
                        key={person.name}
                        person={person}
                        rank={i}
                        maxRevenue={maxRevenue}
                        delay={inView ? i * 0.07 : 0}
                        isTop={i === 0}
                    />
                ))}
            </div>

            {/* Share stats strip */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : {}}
                transition={{ delay: 0.8 }}
                className="mx-7 mb-7 rounded-2xl overflow-hidden"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}
            >
                <div className="grid border-b" style={{
                    gridTemplateColumns: `repeat(${sorted.length}, 1fr)`,
                    borderColor: "rgba(255,255,255,0.05)",
                }}>
                    {sorted.map((p, i) => {
                        const share = ((p.revenue / totalRevenue) * 100).toFixed(0);
                        const isTop = i === 0;
                        return (
                            <div key={p.name} className="text-center py-0.5" style={{ position: "relative", overflow: "hidden" }}>
                                <motion.div
                                    className="absolute bottom-0 left-0 right-0"
                                    style={{ background: isTop ? `${GOLD}33` : "rgba(99,102,241,0.2)" }}
                                    initial={{ height: "0%" }}
                                    animate={{ height: `${share}%` }}
                                    transition={{ duration: 0.9, delay: 0.6 + i * 0.06, ease: "easeOut" }}
                                />
                            </div>
                        );
                    })}
                </div>
                <div className="grid px-0"
                    style={{ gridTemplateColumns: `repeat(${sorted.length}, 1fr)` }}>
                    {sorted.map((p, i) => {
                        const share = ((p.revenue / totalRevenue) * 100).toFixed(0);
                        return (
                            <div key={p.name} className="text-center py-2 px-1">
                                <p className="text-xs font-bold" style={{ color: i === 0 ? GOLD2 : "rgba(255,255,255,0.5)" }}>
                                    {share}%
                                </p>
                                <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>
                                    {p.name.split(" ")[0]}
                                </p>
                            </div>
                        );
                    })}
                </div>
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
