"use client";

/**
 * components/charts/revenue-growth-chart.tsx
 * Premium Animated Revenue Growth Chart
 *
 * Stack : React + Recharts + Framer Motion + TailwindCSS
 * Style : #0b0b0f bg · #d4af37 gold line · glow filter · gradient area
 * Inspiration: Bloomberg Terminal · Apple Finance · Tesla Analytics
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, useInView, useAnimation, animate } from "framer-motion";
import {
    ComposedChart,
    Line,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine,
    ResponsiveContainer,
    Dot,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface RevenueDataPoint {
    month: string;
    revenue: number;
    target?: number;
    growth?: number; // month-over-month %
}

interface Props {
    data?: RevenueDataPoint[];
    title?: string;
    subtitle?: string;
    className?: string;
    height?: number;
}

// ─── Default Data ─────────────────────────────────────────────────────────────
const DEFAULT_DATA: RevenueDataPoint[] = [
    { month: "Jul", revenue: 28400, target: 32000, growth: 0 },
    { month: "Ago", revenue: 34200, target: 35000, growth: 20.4 },
    { month: "Set", revenue: 31800, target: 36000, growth: -7.0 },
    { month: "Out", revenue: 42100, target: 38000, growth: 32.4 },
    { month: "Nov", revenue: 45600, target: 40000, growth: 8.3 },
    { month: "Dez", revenue: 52300, target: 44000, growth: 14.7 },
    { month: "Jan", revenue: 49700, target: 46000, growth: -5.0 },
    { month: "Fev", revenue: 61400, target: 50000, growth: 23.5 },
    { month: "Mar", revenue: 72100, target: 55000, growth: 17.4 },
    { month: "Abr", revenue: 68900, target: 58000, growth: -4.4 },
    { month: "Mai", revenue: 84300, target: 63000, growth: 22.4 },
    { month: "Jun", revenue: 97600, target: 68000, growth: 15.8 },
];

// ─── Palette ──────────────────────────────────────────────────────────────────
const GOLD = "#d4af37";
const GOLD2 = "#f5cc5a";
const GOLD3 = "#b8963e";
const INDIGO = "#6366f1";
const BG = "#0b0b0f";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatCurrency(v: number) {
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
    return `R$ ${v}`;
}

function formatPct(v: number) {
    return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

// ─── Animated Count ───────────────────────────────────────────────────────────
function AnimatedValue({ value, prefix = "R$ ", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
    const [display, setDisplay] = useState(0);
    const controls = useAnimation();

    useEffect(() => {
        const ctrl = animate(0, value, {
            duration: 1.4,
            ease: [0.16, 1, 0.3, 1],
            onUpdate(v) { setDisplay(Math.round(v)); },
        });
        return ctrl.stop;
    }, [value]);

    return (
        <span>
            {prefix}{display.toLocaleString("pt-BR")}{suffix}
        </span>
    );
}

// ─── Custom Dot ───────────────────────────────────────────────────────────────
interface CustomDotProps {
    cx?: number;
    cy?: number;
    index?: number;
    dataLength?: number;
    isActive?: boolean;
}

function GoldenDot({ cx = 0, cy = 0, index = 0, dataLength = 0, isActive = false }: CustomDotProps) {
    const isLast = index === dataLength - 1;
    if (!isLast && !isActive) return null;

    return (
        <g>
            {/* Outer pulse ring */}
            {isLast && (
                <>
                    <circle cx={cx} cy={cy} r={10} fill="none" stroke={GOLD} strokeOpacity={0.2} strokeWidth={1}>
                        <animate attributeName="r" values="8;14;8" dur="2.5s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.5;0;0.5" dur="2.5s" repeatCount="indefinite" />
                    </circle>
                    <circle cx={cx} cy={cy} r={5} fill="none" stroke={GOLD} strokeOpacity={0.4} strokeWidth={1.5}>
                        <animate attributeName="r" values="5;9;5" dur="2.5s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.8;0;0.8" dur="2.5s" repeatCount="indefinite" />
                    </circle>
                </>
            )}
            <circle cx={cx} cy={cy} r={5} fill={GOLD} />
            <circle cx={cx} cy={cy} r={3} fill={GOLD2} />
        </g>
    );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function RevenueTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const revenue = payload.find((p: any) => p.dataKey === "revenue");
    const target = payload.find((p: any) => p.dataKey === "target");
    const d = payload[0]?.payload as RevenueDataPoint;
    const vs = target ? revenue.value - target.value : 0;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="min-w-[172px] rounded-2xl px-4 py-3 text-sm"
            style={{
                background: "rgba(11,11,15,0.97)",
                border: `1px solid rgba(212,175,55,0.25)`,
                backdropFilter: "blur(20px)",
                boxShadow: `0 0 24px rgba(212,175,55,0.08)`,
            }}
        >
            <p className="font-bold text-base mb-2.5" style={{ color: GOLD2 }}>{label}</p>

            <div className="space-y-1.5">
                <div className="flex justify-between items-center gap-4">
                    <span style={{ color: "rgba(255,255,255,0.45)" }}>Receita</span>
                    <span className="font-semibold text-white">{formatCurrency(revenue?.value ?? 0)}</span>
                </div>
                {target && (
                    <div className="flex justify-between items-center gap-4">
                        <span style={{ color: "rgba(255,255,255,0.35)" }}>Meta</span>
                        <span style={{ color: INDIGO }}>{formatCurrency(target?.value ?? 0)}</span>
                    </div>
                )}
                {target && (
                    <div className="flex justify-between items-center gap-4 pt-1.5 mt-1.5 border-t"
                        style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                        <span style={{ color: "rgba(255,255,255,0.35)" }}>vs meta</span>
                        <span className={vs >= 0 ? "text-green-400" : "text-red-400"} style={{ fontWeight: 600 }}>
                            {vs >= 0 ? "+" : ""}{formatCurrency(Math.abs(vs))}
                        </span>
                    </div>
                )}
                {d.growth !== undefined && (
                    <div className="flex justify-between items-center gap-4">
                        <span style={{ color: "rgba(255,255,255,0.35)" }}>MoM</span>
                        <span style={{ color: d.growth >= 0 ? "#4ade80" : "#f87171", fontWeight: 600 }}>
                            {formatPct(d.growth)}
                        </span>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function RevenueGrowthChart({
    data = DEFAULT_DATA,
    title = "Crescimento de Receita",
    subtitle = "12 meses · ao vivo",
    className = "",
    height = 340,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const isInView = useInView(containerRef, { once: true, margin: "-80px" });
    const [drawn, setDrawn] = useState(false);
    const [opacity, setOpacity] = useState(0);

    // Trigger line draw on scroll-into-view
    useEffect(() => {
        if (isInView) {
            const t1 = setTimeout(() => setDrawn(true), 200);
            const t2 = setTimeout(() => setOpacity(1), 100);
            return () => { clearTimeout(t1); clearTimeout(t2); };
        }
    }, [isInView]);

    // Summary stats
    const last = data[data.length - 1];
    const first = data[0];
    const totalGrowth = (((last.revenue - first.revenue) / first.revenue) * 100).toFixed(1);
    const positiveMonths = data.filter(d => (d.growth ?? 0) > 0).length;
    const maxRevenue = Math.max(...data.map(d => d.revenue));
    const bestMonth = data.find(d => d.revenue === maxRevenue);

    return (
        <motion.div
            ref={containerRef}
            data-guide-id="cc_kpi_revenue"
            initial={{ opacity: 0, y: 32 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className={`relative rounded-3xl overflow-hidden ${className}`}
            style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(212,175,55,0.14)",
                backdropFilter: "blur(24px)",
            }}
        >
            {/* SVG Defs (filters + gradients) — rendered once */}
            <svg width="0" height="0" className="absolute">
                <defs>
                    {/* Gold glow filter */}
                    <filter id="goldGlow" x="-20%" y="-80%" width="140%" height="260%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                        <feColorMatrix in="blur" type="matrix"
                            values="1 0.8 0   0 0
                                    0.85 0.7 0  0 0
                                    0   0   0.1 0 0
                                    0   0   0   1.2 0" result="goldBlur" />
                        <feMerge>
                            <feMergeNode in="goldBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>

                    {/* Area gradient */}
                    <linearGradient id="areaGold" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={GOLD} stopOpacity={0.28} />
                        <stop offset="45%" stopColor={GOLD} stopOpacity={0.10} />
                        <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                    </linearGradient>

                    {/* Target gradient */}
                    <linearGradient id="areaTarget" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={INDIGO} stopOpacity={0.12} />
                        <stop offset="100%" stopColor={INDIGO} stopOpacity={0} />
                    </linearGradient>

                    {/* Line gradient (left→right) */}
                    <linearGradient id="lineGold" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={GOLD3} stopOpacity={0.6} />
                        <stop offset="60%" stopColor={GOLD} stopOpacity={1} />
                        <stop offset="100%" stopColor={GOLD2} stopOpacity={1} />
                    </linearGradient>

                    {/* Clip path for line-draw animation */}
                    <clipPath id="lineReveal">
                        <motion.rect
                            x="0" y="-20" height="200%"
                            initial={{ width: "0%" }}
                            animate={drawn ? { width: "100%" } : { width: "0%" }}
                            transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                        />
                    </clipPath>
                </defs>
            </svg>

            {/* Ambient background glow */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-40 rounded-full blur-3xl opacity-10"
                    style={{ background: `radial-gradient(ellipse, ${GOLD} 0%, transparent 70%)` }} />
            </div>

            {/* Header */}
            <div className="px-7 pt-7 pb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <motion.p
                        initial={{ opacity: 0, x: -12 }}
                        animate={isInView ? { opacity: 1, x: 0 } : {}}
                        transition={{ delay: 0.15, duration: 0.4 }}
                        className="text-xs font-bold uppercase tracking-widest mb-1"
                        style={{ color: GOLD }}
                    >
                        {title}
                    </motion.p>
                    <motion.div
                        initial={{ opacity: 0, x: -12 }}
                        animate={isInView ? { opacity: 1, x: 0 } : {}}
                        transition={{ delay: 0.25, duration: 0.4 }}
                        className="text-3xl font-extrabold tracking-tight text-white"
                    >
                        {isInView && <AnimatedValue value={last.revenue} />}
                    </motion.div>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={isInView ? { opacity: 1 } : {}}
                        transition={{ delay: 0.4 }}
                        className="text-xs mt-1"
                        style={{ color: "rgba(255,255,255,0.35)" }}
                    >
                        {subtitle}
                    </motion.p>
                </div>

                {/* Stat pills */}
                <motion.div
                    initial={{ opacity: 0, x: 12 }}
                    animate={isInView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    className="flex flex-wrap gap-2"
                >
                    <StatPill label="Crescimento" value={`+${totalGrowth}%`} color="#4ade80" />
                    <StatPill label="Melhor mês" value={`${bestMonth?.month} · ${formatCurrency(maxRevenue)}`} color={GOLD} />
                    <StatPill label="Meses positivos" value={`${positiveMonths}/${data.length}`} color="#818cf8" />
                </motion.div>
            </div>

            {/* Chart */}
            <motion.div
                style={{ opacity }}
                transition={{ duration: 0.4 }}
                className="px-2 pb-6"
            >
                <ResponsiveContainer width="100%" height={height}>
                    <ComposedChart data={data} margin={{ top: 24, right: 24, left: 8, bottom: 4 }}>
                        <defs>
                            {/* Already defined in SVG above, replicate for Recharts internal SVG */}
                            <linearGradient id="rcAreaGold" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={GOLD} stopOpacity={0.28} />
                                <stop offset="50%" stopColor={GOLD} stopOpacity={0.08} />
                                <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="rcAreaTarget" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={INDIGO} stopOpacity={0.12} />
                                <stop offset="100%" stopColor={INDIGO} stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="rcLineGold" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor={GOLD3} stopOpacity={0.4} />
                                <stop offset="100%" stopColor={GOLD2} stopOpacity={1} />
                            </linearGradient>
                            <filter id="rcGlow">
                                <feGaussianBlur stdDeviation="3.5" result="b" />
                                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                        </defs>

                        <CartesianGrid
                            strokeDasharray="0"
                            stroke="rgba(255,255,255,0.04)"
                            vertical={false}
                        />

                        <XAxis
                            dataKey="month"
                            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 12, fontWeight: 500 }}
                            axisLine={false}
                            tickLine={false}
                            dy={8}
                        />
                        <YAxis
                            tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                            tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            width={44}
                        />

                        <Tooltip
                            content={<RevenueTooltip />}
                            cursor={{
                                stroke: `rgba(212,175,55,0.25)`,
                                strokeWidth: 1,
                                strokeDasharray: "4 3",
                            }}
                        />

                        {/* Target area (behind) */}
                        <Area
                            type="monotone"
                            dataKey="target"
                            name="Meta"
                            stroke={INDIGO}
                            strokeWidth={1.5}
                            strokeDasharray="5 4"
                            fill="url(#rcAreaTarget)"
                            dot={false}
                            activeDot={false}
                            isAnimationActive={true}
                            animationDuration={1600}
                            animationEasing="ease-out"
                            animationBegin={300}
                        />

                        {/* Revenue area fill */}
                        <Area
                            type="monotone"
                            dataKey="revenue"
                            name="Receita"
                            stroke="none"
                            fill="url(#rcAreaGold)"
                            dot={false}
                            activeDot={false}
                            isAnimationActive={true}
                            animationDuration={1800}
                            animationEasing="ease-out"
                            animationBegin={100}
                        />

                        {/* Revenue line (glow) — drawn with clip animation */}
                        <Line
                            type="monotone"
                            dataKey="revenue"
                            name="Receita"
                            stroke={`rgba(212,175,55,0.3)`}
                            strokeWidth={8}
                            dot={false}
                            activeDot={false}
                            filter="url(#rcGlow)"
                            isAnimationActive={true}
                            animationDuration={2000}
                            animationEasing="ease-out"
                            animationBegin={0}
                        />

                        {/* Revenue line (crisp, on top) */}
                        <Line
                            type="monotone"
                            dataKey="revenue"
                            name="Receita"
                            stroke="url(#rcLineGold)"
                            strokeWidth={2.5}
                            dot={(props: any) => (
                                <GoldenDot
                                    key={`dot-${props.index}`}
                                    cx={props.cx}
                                    cy={props.cy}
                                    index={props.index}
                                    dataLength={data.length}
                                />
                            )}
                            activeDot={{ r: 7, fill: GOLD2, stroke: "rgba(212,175,55,0.4)", strokeWidth: 6 }}
                            isAnimationActive={true}
                            animationDuration={2000}
                            animationEasing="ease-out"
                            animationBegin={0}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </motion.div>

            {/* Bottom legend */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : {}}
                transition={{ delay: 0.7 }}
                className="px-7 pb-6 flex items-center gap-6 flex-wrap"
            >
                <LegendItem color={GOLD} label="Receita" dotStyle="solid" />
                <LegendItem color={INDIGO} label="Meta" dotStyle="dashed" />
                <div className="ml-auto flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-xs">Atualização em tempo real</span>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="rounded-xl px-3 py-2"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="text-xs leading-none mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>{label}</p>
            <p className="text-xs font-bold leading-none" style={{ color }}>{value}</p>
        </div>
    );
}

function LegendItem({ color, label, dotStyle }: { color: string; label: string; dotStyle: "solid" | "dashed" }) {
    return (
        <div className="flex items-center gap-2">
            <div className="relative w-7 h-0.5" style={{ background: dotStyle === "solid" ? color : "transparent" }}>
                {dotStyle === "dashed" ? (
                    <svg width="28" height="2"><line x1="0" y1="1" x2="28" y2="1" stroke={color} strokeWidth="2" strokeDasharray="5 3" /></svg>
                ) : (
                    <div className="absolute inset-y-0 right-0 w-0.5 h-0.5 rounded-full translate-y-[-1px]"
                        style={{ background: color }} />
                )}
            </div>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
        </div>
    );
}
