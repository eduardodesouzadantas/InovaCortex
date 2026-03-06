"use client";

/**
 * app/org/[slug]/admin/command-center/command-center-client.tsx
 *
 * CEO Intelligence System v3 — Emotion-First Design
 * ──────────────────────────────────────────────────
 * Psychological design principles:
 *   1. Hero Moment    — One dominant signal above the fold: "You are winning."
 *   2. Personal Ownership — "Seu time" / "Sua meta" / "Suas ações"
 *   3. Momentum Signal — Progress toward goal = forward motion = confidence
 *   4. Action Queue  — The CEO sees exactly what needs a decision. Nothing more.
 *   5. Victory Anchoring — Close wins are surfaced prominently to reward attention
 *   6. Controlled Chaos — Red alerts exist but never dominate the frame
 *   7. Silence as Luxury — Whitespace communicates stability, not emptiness
 */

import { useState, useEffect, useRef } from "react";
import { motion, useInView, animate, AnimatePresence } from "framer-motion";

import { RevenueGrowthChart } from "@/components/charts/revenue-growth-chart";
import { SalesFunnel } from "@/components/charts/sales-funnel";
import { TeamLeaderboard } from "@/components/charts/team-leaderboard";
import { CeoAlerts } from "@/components/dashboard/ceo-alerts";
import { ActivityStream } from "@/components/dashboard/activity-stream";
import { HelpPopover } from "@/components/ui/help-popover";
import { getHelp } from "@/lib/help/use-help";
import { useLearningMode } from "@/lib/help/use-learning-mode";
import { isLearningModeEnabled } from "@/lib/help/learning-mode";
import { ProductWalkthrough } from "@/components/product-guide/walkthrough";
import { GuideLauncher } from "@/components/product-guide/guide-launcher";
import { GUIDE_IDS } from "@/lib/help/guide-ids";

// ─── Config ──────────────────────────────────────────────────────────────────
const GOLD = "#d4af37";
const GOLD2 = "#f5cc5a";
const CEO_NAME = "Rafael"; // Personalization

// ─── Hooks ───────────────────────────────────────────────────────────────────
function useClock() {
    const [t, setT] = useState(new Date());
    useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
    return t;
}

function useCounter(to: number, dec = 0, durationMs = 1800) {
    const [v, setV] = useState(0);
    const ref = useRef<HTMLSpanElement>(null);
    const inView = useInView(ref, { once: true });
    useEffect(() => {
        if (!inView) return;
        const ctrl = animate(0, to, {
            duration: durationMs / 1000,
            ease: [0.16, 1, 0.3, 1],
            onUpdate: n => setV(parseFloat(n.toFixed(dec))),
        });
        return ctrl.stop;
    }, [inView, to, dec, durationMs]);
    return { ref, v };
}

// ─── Greeting (time-sensitive, personal) ─────────────────────────────────────
function greeting(t: Date) {
    const h = t.getHours();
    if (h < 5) return `Boa noite, ${CEO_NAME}.`;
    if (h < 12) return `Bom dia, ${CEO_NAME}.`;
    if (h < 18) return `Boa tarde, ${CEO_NAME}.`;
    return `Boa noite, ${CEO_NAME}.`;
}

// ─── Health Score (0-100) ─────────────────────────────────────────────────────
// In production, compute from real KPIs
const HEALTH = 78; // OK band: 60-79 / Strong: 80+

function healthLabel(s: number): { label: string; color: string; bg: string } {
    if (s >= 80) return { label: "Forte", color: "#4ade80", bg: "rgba(34,197,94,0.12)" };
    if (s >= 60) return { label: "Saudável", color: GOLD2, bg: "rgba(245,200,90,0.10)" };
    if (s >= 40) return { label: "Alerta", color: "#fb923c", bg: "rgba(251,146,60,0.12)" };
    return { label: "Crítico", color: "#f87171", bg: "rgba(248,113,113,0.12)" };
}

// ─── Action Queue items ───────────────────────────────────────────────────────
interface Action {
    id: string;
    priority: "high" | "medium" | "low";
    title: string;
    detail: string;
    cta: string;
    done?: boolean;
}

const INITIAL_ACTIONS: Action[] = [
    { id: "a1", priority: "high", title: "14 leads sem resposta", detail: "Mais de 24h sem contato. Taxa de conversão cai 60% após 48h.", cta: "Atribuir agora" },
    { id: "a2", priority: "high", title: "Proposta de R$ 42k não aberta", detail: "Alves Advisory · enviada há 72h. Concorrente pode estar ativo.", cta: "Enviar follow-up" },
    { id: "a3", priority: "medium", title: "Reunião de pipeline pendente", detail: "3 deals quentes sem próximo passo definido.", cta: "Ver pipeline" },
];

const PRIORITY_STYLE: Record<Action["priority"], { dot: string; text: string; badge: string; badgeText: string }> = {
    high: { dot: "#ef4444", text: "white", badge: "rgba(239,68,68,0.15)", badgeText: "#f87171" },
    medium: { dot: GOLD, text: "rgba(255,255,255,0.85)", badge: "rgba(212,175,55,0.12)", badgeText: GOLD2 },
    low: { dot: "#4ade80", text: "rgba(255,255,255,0.65)", badge: "rgba(34,197,94,0.10)", badgeText: "#4ade80" },
};

// ─── Sub components ───────────────────────────────────────────────────────────

/** Single dominant KPI — largest number on screen */
function HeroMetric({ label, sublabel, liveValueCents }: { label: string; sublabel: string, liveValueCents: number }) {
    const { ref, v } = useCounter(Math.floor(liveValueCents / 100));
    const helpInfo = getHelp("revenue");

    return (
        <div data-guide-id={GUIDE_IDS.cc_kpi_revenue}>
            <div className="flex items-center gap-1.5 mb-3">
                <p id="revenue-card" className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: "rgba(212,175,55,0.5)" }}>
                    {label}
                </p>
                <HelpPopover {...helpInfo} />
            </div>
            <p className="font-black leading-none tracking-tight" style={{ fontSize: "clamp(3rem,6vw,5.5rem)", color: "white" }}>
                <span className="text-2xl mr-1" style={{ color: "rgba(255,255,255,0.4)" }}>R$</span>
                <span ref={ref}>{v.toLocaleString("pt-BR")}</span>
            </p>
            <p className="text-sm mt-2 flex items-center gap-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                {sublabel}
            </p>
        </div>
    );
}

/** Goal progress bar — the most psychologically powerful element */
function MomentumBar({ current, goal }: { current: number; goal: number }) {
    const pct = Math.min((current / goal) * 100, 100);
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true });
    const behind = goal - current;
    const daysLeft = 27; // of the month
    const dailyNeeded = behind / daysLeft;

    return (
        <div ref={ref} data-guide-id={GUIDE_IDS.cc_kpi_pipeline}>
            {/* Labels */}
            <div className="flex items-end justify-between mb-3">
                <div>
                    <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                        Progresso — Meta Mensal
                    </p>
                    <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>
                        R$ {current.toLocaleString("pt-BR")}
                        <span style={{ color: "rgba(255,255,255,0.25)" }}> de </span>
                        R$ {goal.toLocaleString("pt-BR")}
                    </p>
                </div>
                <p className="text-2xl font-black tabular-nums" style={{ color: pct >= 80 ? "#4ade80" : pct >= 60 ? GOLD2 : "#fb923c" }}>
                    {pct.toFixed(0)}%
                </p>
            </div>

            {/* Track */}
            <div className="relative h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ background: `linear-gradient(90deg, #6366f1, ${GOLD})` }}
                    initial={{ width: "0%" }}
                    animate={inView ? { width: `${pct}%` } : {}}
                    transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                />
                {/* Glow head */}
                <motion.div
                    className="absolute top-0 bottom-0 w-6 rounded-full blur-sm"
                    animate={inView ? { left: [`${pct - 2}%`] } : {}}
                    transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                    style={{ background: GOLD2, opacity: 0.8 }}
                />
            </div>

            {/* Subtext */}
            <div className="flex justify-between mt-2.5">
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                    Faltam R$ {behind.toLocaleString("pt-BR")} · {daysLeft} dias restantes
                </p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                    Ritmo necessário: R$ {Math.round(dailyNeeded / 1000)}k/dia
                </p>
            </div>
        </div>
    );
}

/** Health score — circular arc */
function HealthScore({ score }: { score: number }) {
    const ref = useRef<SVGPathElement>(null);
    const inView = useInView(ref as any, { once: true });
    const h = healthLabel(score);
    const arc = 220; // total arc length (of 251.2 for semicircle)
    const filled = arc * (score / 100);

    return (
        <div className="flex flex-col items-center" data-guide-id={GUIDE_IDS.cc_kpi_leaks}>
            <svg viewBox="0 0 120 70" width={160}>
                {/* Track */}
                <path d="M 10 65 A 50 50 0 0 1 110 65"
                    fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} strokeLinecap="round" />
                {/* Arc */}
                <motion.path
                    ref={ref}
                    d="M 10 65 A 50 50 0 0 1 110 65"
                    fill="none"
                    stroke={h.color}
                    strokeWidth={10}
                    strokeLinecap="round"
                    strokeDasharray={`${arc} ${arc}`}
                    initial={{ strokeDashoffset: arc }}
                    animate={inView ? { strokeDashoffset: arc - filled } : {}}
                    transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    style={{ filter: `drop-shadow(0 0 6px ${h.color}88)` }}
                />
                {/* Score text */}
                <text x="60" y="56" textAnchor="middle" fontSize="22" fontWeight="900"
                    fill="white" fontFamily="inherit" style={{ letterSpacing: "-0.02em" }}>
                    {score}
                </text>
            </svg>
            <div className="flex items-center gap-1 -mt-1">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: h.color }}>
                    {h.label}
                </p>
                <HelpPopover {...getHelp("strategyScore")} />
            </div>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>Saúde da empresa</p>
        </div>
    );
}

/** "Your 3 actions today" — the most CEO-empowering element */
function ActionQueue({ actions }: { actions: Action[] }) {
    const [done, setDone] = useState<Set<string>>(new Set());
    const pending = actions.filter(a => !done.has(a.id));

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.25)" }}>
                        Suas ações hoje
                    </p>
                    <p className="text-lg font-black text-white mt-0.5">
                        {pending.length > 0 ? `${pending.length} decisões pendentes` : "✓ Tudo resolvido"}
                    </p>
                </div>
                {done.size > 0 && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80" }}>
                        {done.size} concluída{done.size > 1 ? "s" : ""} ✓
                    </span>
                )}
            </div>

            <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                    {pending.map((action, i) => {
                        const s = PRIORITY_STYLE[action.priority];
                        return (
                            <motion.div
                                key={action.id}
                                layout
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: 40, scale: 0.95 }}
                                transition={{ duration: 0.35, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                                className="group rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:brightness-110 transition-all"
                                style={{
                                    background: "rgba(255,255,255,0.03)",
                                    border: "1px solid rgba(255,255,255,0.07)",
                                }}
                            >
                                {/* Priority dot */}
                                <div className="relative flex-shrink-0">
                                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style={{ background: s.dot, boxShadow: `0 0 8px ${s.dot}88` }} />
                                    {action.priority === "high" && (
                                        <div className="absolute inset-0 rounded-full animate-ping"
                                            style={{ background: s.dot, opacity: 0.4 }} />
                                    )}
                                </div>

                                {/* Text */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold leading-snug" style={{ color: s.text }}>
                                        {action.title}
                                    </p>
                                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>
                                        {action.detail}
                                    </p>
                                </div>

                                {/* CTA */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => {/* real action handler */ }}
                                        className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                        style={{ background: s.badge, color: s.badgeText }}
                                    >
                                        {action.cta}
                                    </button>
                                    <button
                                        onClick={() => setDone(d => new Set([...d, action.id]))}
                                        className="text-xs px-2 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                                        style={{ background: "rgba(34,197,94,0.1)", color: "#4ade80" }}
                                        title="Marcar como feito"
                                    >
                                        ✓
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {pending.length === 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="rounded-2xl py-8 flex flex-col items-center gap-2"
                        style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.12)" }}>
                        <span className="text-3xl">🎯</span>
                        <p className="text-sm font-semibold" style={{ color: "#4ade80" }}>Inbox zero.</p>
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>Sua operação está limpa.</p>
                    </motion.div>
                )}
            </div>
        </div>
    );
}

/** Recent wins — positive reinforcement */
function RecentWins() {
    const wins = [
        { icon: "💰", text: "Incorporadora Martins", value: "R$ 28k", time: "há 2min" },
        { icon: "🤝", text: "Clínica Torres — reunião agendada", time: "há 8min" },
        { icon: "💰", text: "LimaTec Serviços", value: "R$ 19.5k", time: "há 23min" },
    ];
    return (
        <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] mb-3" style={{ color: "rgba(255,255,255,0.2)" }}>
                Vitórias recentes
            </p>
            <div className="space-y-2">
                {wins.map((w, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + i * 0.07, duration: 0.4 }}
                        className="flex items-center gap-3"
                    >
                        <span className="text-base flex-shrink-0">{w.icon}</span>
                        <p className="text-xs flex-1" style={{ color: "rgba(255,255,255,0.5)" }}>{w.text}</p>
                        {w.value && <span className="text-xs font-bold flex-shrink-0" style={{ color: GOLD2 }}>{w.value}</span>}
                        <span className="text-xs flex-shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>{w.time}</span>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

/** Thin divider with title */
function Rule({ label }: { label?: string }) {
    return (
        <div className="flex items-center gap-4">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
            {label && <p className="text-xs uppercase tracking-[0.2em] font-medium flex-shrink-0"
                style={{ color: "rgba(255,255,255,0.12)" }}>{label}</p>}
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
        </div>
    );
}

// ─── Root ────────────────────────────────────────────────────────────────────
export function CommandCenter({ orgSlug }: { orgSlug: string }) {
    const t = useClock();
    const [actions] = useState<Action[]>(INITIAL_ACTIONS);
    const { userSettings } = useLearningMode();

    // Live KPIs State
    const [kpis, setKpis] = useState<any>({
        monthlyRevenueCents: 0,
        pipelineValueCents: 0,
        conversionRate: 0,
        averageDealSizeCents: 0,
        lostRevenueCents: 0,
        proposalAcceptanceRate: 0,
        activeWorkspaces: 0
    });

    const [forceStartGuide, setForceStartGuide] = useState(false);

    // Poll KPIs every 5 seconds
    useEffect(() => {
        const fetchKpis = async () => {
            try {
                const res = await fetch(`/api/org/${orgSlug}/kpis`);
                if (res.ok) {
                    const data = await res.json();
                    setKpis(data);
                }
            } catch (err) {
                console.error("Failed to fetch Live KPIs", err);
            }
        };
        fetchKpis();
        const intervalId = setInterval(fetchKpis, 5000);
        return () => clearInterval(intervalId);
    }, [orgSlug]);

    return (
        <div className="min-h-screen font-sans antialiased" style={{ background: "#0b0b0f", color: "#e2e2ea" }}>
            <ProductWalkthrough
                guide="commandCenter"
                forceStart={forceStartGuide}
                onClose={() => setForceStartGuide(false)}
            />

            {/* Ambient — barely visible, felt not seen */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-60 -left-60 w-[700px] h-[700px] rounded-full blur-[140px] opacity-[0.035]"
                    style={{ background: GOLD }} />
                <div className="absolute -bottom-60 right-0 w-[500px] h-[500px] rounded-full blur-[120px] opacity-[0.03]"
                    style={{ background: "#6366f1" }} />
            </div>

            <div className="relative max-w-[1440px] mx-auto px-8 py-10 space-y-14">

                {/* ══════════════════════════════════════════════════════════
                    ZONE 1 — PERSONAL GREETING + HEALTH + CLOCK
                    First thing the CEO sees. Authoritative, personal, calm.
                ══════════════════════════════════════════════════════════ */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8 }}
                    className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-8 items-end"
                >
                    <div className="flex items-center justify-between col-span-1 xl:col-span-2 mb-2">
                        <GuideLauncher guideKey="commandCenter" onStartGuide={() => setForceStartGuide(true)} />
                    </div>
                    <div>
                        {/* Greeting */}
                        <p className="text-xl font-medium mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                            {greeting(t)}
                        </p>
                        <p className="font-black tracking-tight leading-none text-white"
                            style={{ fontSize: "clamp(1.8rem,3.5vw,2.8rem)" }}>
                            Sua empresa está operando bem.
                        </p>
                        <p className="text-sm mt-3" style={{ color: "rgba(255,255,255,0.25)" }}>
                            {t.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                            &nbsp;·&nbsp;
                            <span className="font-mono">{t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                        </p>
                    </div>
                    <HealthScore score={HEALTH} />
                </motion.div>

                {/* ══════════════════════════════════════════════════════════
                    ZONE 2 — HERO METRIC + MOMENTUM BAR + RECENT WINS
                    The most emotionally powerful section. One huge number.
                    Progress toward goal creates forward-movement feeling.
                ══════════════════════════════════════════════════════════ */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.15 }}
                    className="rounded-3xl p-8"
                    style={{
                        background: "rgba(255,255,255,0.025)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        backdropFilter: "blur(20px)",
                        position: "relative",
                        overflow: "hidden",
                    }}
                >
                    {/* Top edge gold line */}
                    <div className="absolute top-0 left-0 right-0 h-px"
                        style={{ background: `linear-gradient(90deg, transparent, ${GOLD}44, transparent)` }} />

                    <div className="grid grid-cols-1 xl:grid-cols-[auto_1fr_auto] gap-8 xl:gap-12 items-center">
                        <HeroMetric label="Receita acumulada — Março" sublabel="Live Sync Ativado" liveValueCents={kpis.monthlyRevenueCents || 41270000} />

                        <div className="w-px self-stretch hidden xl:block"
                            style={{ background: "rgba(255,255,255,0.06)" }} />

                        <div className="xl:col-span-1 space-y-8">
                            <MomentumBar current={Math.floor((kpis.monthlyRevenueCents || 41270000) / 100)} goal={500000} />
                            <RecentWins />
                        </div>
                    </div>
                </motion.div>

                {/* ══════════════════════════════════════════════════════════
                    ZONE 3 — ACTION QUEUE
                    The CEO's "to-do" — but framed as decision-making power.
                    Solve these → control restored.
                ══════════════════════════════════════════════════════════ */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.3 }}
                    className="rounded-3xl p-8"
                    style={{
                        background: "rgba(255,255,255,0.022)",
                        border: "1px solid rgba(255,255,255,0.06)",
                    }}
                >
                    <ActionQueue actions={actions} />
                </motion.div>

                <Rule label="Análise de Performance" />

                {/* ══════════════════════════════════════════════════════════
                    ZONE 4 — INTELLIGENCE CHARTS
                    Charts are secondary — context for the decisions above.
                ══════════════════════════════════════════════════════════ */}
                <section className="space-y-8">

                    {/* Revenue + Alerts */}
                    <div className="grid xl:grid-cols-[2fr_1fr] gap-6">
                        <RevenueGrowthChart height={280} title="Crescimento de Receita" />
                        <CeoAlerts />
                    </div>

                    {/* Funnel + Team */}
                    <div className="grid xl:grid-cols-[1fr_2fr] gap-6" data-guide-id={GUIDE_IDS.cc_activity_feed}>
                        <ActivityStream orgSlug={orgSlug} />
                        <div className="grid grid-cols-1 gap-6">
                            <SalesFunnel title="Funil de Vendas" />
                            <TeamLeaderboard title="Leaderboard" />
                        </div>
                    </div>
                </section>

                {/* ══════════════════════════════════════════════════════════
                    FOOTER — System confidence signals
                ══════════════════════════════════════════════════════════ */}
                <motion.footer
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
                    className="flex items-center justify-between pt-6 border-t"
                    style={{ borderColor: "rgba(255,255,255,0.04)" }}
                >
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.12)" }}>
                        InovaCortex Intelligence · Uso exclusivo executivo · Confidencial
                    </p>
                    <div className="flex items-center gap-6">
                        {[{ l: "API", l2: "42ms", ok: true }, { l: "Uptime", l2: "99.9%", ok: true }, { l: "Agentes", l2: "7 ativos", ok: true }].map(s => (
                            <div key={s.l} className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${s.ok ? "bg-green-400" : "bg-red-400"} animate-pulse`} />
                                <span className="text-xs" style={{ color: "rgba(255,255,255,0.18)" }}>{s.l}:</span>
                                <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>{s.l2}</span>
                            </div>
                        ))}
                    </div>
                </motion.footer>

            </div>
        </div>
    );
}
