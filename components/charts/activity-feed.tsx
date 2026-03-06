"use client";

/**
 * components/charts/activity-feed.tsx
 * Real-Time Activity Feed — CEO Executive Dashboard
 *
 * Stack : React + Framer Motion + TailwindCSS
 * Style : Dark mode · gold accents · animated timeline · live event simulation
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────
export type EventType = "lead" | "ai" | "meeting" | "deal" | "proposal" | "outbound";

export interface FeedEvent {
    id: string;
    type: EventType;
    title: string;
    detail: string;
    actor?: string;          // e.g. initials
    value?: string;          // e.g. "R$ 28.000"
    time: Date | string;
    read?: boolean;
}

interface Props {
    events?: FeedEvent[];
    title?: string;
    liveMode?: boolean;
    className?: string;
    maxHeight?: number;
}

// ─── Seed events ──────────────────────────────────────────────────────────────
const now = () => new Date();
const ago = (m: number) => new Date(Date.now() - m * 60_000);

const SEED: FeedEvent[] = [
    { id: "e1", type: "deal", title: "Deal fechado", detail: "Incorporadora Martins assinou contrato.", actor: "ML", value: "R$ 28.000", time: ago(1) },
    { id: "e2", type: "ai", title: "IA respondeu lead", detail: "Resposta enviada para RF Consultoria em 38s.", actor: "🤖", time: ago(4) },
    { id: "e3", type: "meeting", title: "Reunião agendada", detail: "Diagnóstico com Clínica Torres — quinta, 14h.", actor: "RG", time: ago(8) },
    { id: "e4", type: "lead", title: "Novo lead hot", detail: "Drummond Real Estate · Score 88/100.", actor: "⚡", value: "Score 88", time: ago(15) },
    { id: "e5", type: "outbound", title: "Email de outbound enviado", detail: "DM2 enviado para Simone Ferreira.", actor: "BA", time: ago(22) },
    { id: "e6", type: "proposal", title: "Proposta enviada", detail: "Proposta R$ 42k para Alves Advisory.", actor: "CS", value: "R$ 42.000", time: ago(31) },
    { id: "e7", type: "ai", title: "Deal packet gerado", detail: "Executive One-Pager pronto para LimaTec.", actor: "🤖", time: ago(45) },
    { id: "e8", type: "lead", title: "Novo lead warm", detail: "Nunes Serviços Corporativos entrou no funil.", actor: "⚡", value: "Score 63", time: ago(58) },
    { id: "e9", type: "meeting", title: "Reunião concluída", detail: "Kickoff InovaCortex — Barros Saúde Integral.", actor: "ML", time: ago(90) },
    { id: "e10", type: "deal", title: "Deal fechado", detail: "LimaTec Serviços — contrato assinado.", actor: "RG", value: "R$ 19.500", time: ago(120) },
];

// Live simulation pool
const LIVE_POOL: Omit<FeedEvent, "id" | "time">[] = [
    { type: "lead", title: "Novo lead detectado", detail: "Peixoto Consultores · Score 74/100.", actor: "⚡", value: "Score 74" },
    { type: "ai", title: "IA qualificou lead", detail: "Ferreira & Cia classificada como warm.", actor: "🤖" },
    { type: "meeting", title: "Reunião agendada", detail: "Call com Medeiros Consultoria — sexta, 10h.", actor: "CS" },
    { type: "deal", title: "Deal fechado", detail: "Costa Limpeza — contrato assinado.", actor: "BA", value: "R$ 23.000" },
    { type: "outbound", title: "Mensagem copiada", detail: "DM1 pronto para envio a Aline Freitas.", actor: "TP" },
    { type: "proposal", title: "Proposta aberta", detail: "Natalia Barros abriu a proposta (1ª vez).", actor: "JM" },
];

// ─── Palette ─────────────────────────────────────────────────────────────────
const GOLD = "#d4af37";
const GOLD2 = "#f5cc5a";

const EVENT_CONFIG: Record<EventType, {
    color: string; bg: string; border: string; glow: string; icon: string; label: string;
}> = {
    deal: { color: GOLD2, bg: "rgba(212,175,55,0.12)", border: "rgba(212,175,55,0.25)", glow: "rgba(212,175,55,0.4)", icon: "💰", label: "Deal" },
    lead: { color: "#818cf8", bg: "rgba(99,102,241,0.10)", border: "rgba(99,102,241,0.25)", glow: "rgba(99,102,241,0.4)", icon: "⚡", label: "Lead" },
    ai: { color: "#67e8f9", bg: "rgba(6,182,212,0.08)", border: "rgba(6,182,212,0.20)", glow: "rgba(6,182,212,0.3)", icon: "🤖", label: "IA" },
    meeting: { color: "#a78bfa", bg: "rgba(139,92,246,0.10)", border: "rgba(139,92,246,0.22)", glow: "rgba(139,92,246,0.4)", icon: "📅", label: "Reunião" },
    proposal: { color: "#34d399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.20)", glow: "rgba(52,211,153,0.3)", icon: "📋", label: "Proposta" },
    outbound: { color: "#f472b6", bg: "rgba(244,114,182,0.08)", border: "rgba(244,114,182,0.20)", glow: "rgba(244,114,182,0.3)", icon: "📤", label: "Outbound" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(t: Date | string): string {
    const ms = Date.now() - new Date(t).getTime();
    const sec = Math.round(ms / 1000);
    if (sec < 60) return `${sec}s atrás`;
    const min = Math.round(sec / 60);
    if (min < 60) return `${min}min atrás`;
    const hr = Math.round(min / 60);
    return `${hr}h atrás`;
}

function actorInitials(actor: string | undefined): string | null {
    if (!actor) return null;
    if (actor.length <= 2 || actor.startsWith("🤖") || actor.startsWith("⚡")) return actor;
    return actor.slice(0, 2).toUpperCase();
}

// ─── Actor Avatar ─────────────────────────────────────────────────────────────
function Actor({ actor, color }: { actor?: string; color: string }) {
    const label = actorInitials(actor);
    if (!label) return null;
    const isEmoji = /\p{Emoji}/u.test(label);
    return (
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{
                background: isEmoji ? "rgba(255,255,255,0.07)" : `${color}22`,
                border: `1px solid ${color}44`,
                fontSize: isEmoji ? 16 : 11,
            }}>
            {label}
        </div>
    );
}

// ─── Feed Event Row ───────────────────────────────────────────────────────────
function EventRow({ event, isFirst }: { event: FeedEvent; isFirst: boolean }) {
    const cfg = EVENT_CONFIG[event.type];

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex gap-3 group"
        >
            {/* Timeline stem */}
            <div className="flex flex-col items-center flex-shrink-0" style={{ width: 28 }}>
                {/* Dot */}
                <div className="relative mt-1 flex-shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full border-2"
                        style={{
                            borderColor: cfg.color, background: isFirst ? cfg.color : "transparent",
                            boxShadow: isFirst ? `0 0 8px ${cfg.glow}` : undefined
                        }} />
                    {/* Live pulse for newest */}
                    {isFirst && (
                        <div className="absolute inset-0 rounded-full animate-ping"
                            style={{ background: cfg.color, opacity: 0.35 }} />
                    )}
                </div>
                {/* Stem line */}
                <div className="flex-1 w-px mt-1" style={{ background: "rgba(255,255,255,0.06)" }} />
            </div>

            {/* Content */}
            <div className="pb-5 flex-1 min-w-0">
                <div className="rounded-2xl p-3 transition-all group-hover:brightness-110"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    <div className="flex items-start gap-2.5">
                        {/* Actor */}
                        <Actor actor={event.actor} color={cfg.color} />

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-base leading-none flex-shrink-0">{cfg.icon}</span>
                                    <p className="text-sm font-semibold text-white leading-snug truncate">{event.title}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {event.value && (
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                            style={{ background: `${cfg.color}22`, color: cfg.color }}>
                                            {event.value}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs mt-1 leading-relaxed"
                                style={{ color: "rgba(255,255,255,0.45)" }}>
                                {event.detail}
                            </p>
                            <p className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.22)" }}>
                                {timeAgo(event.time)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ActivityFeed({
    events: initialEvents = SEED,
    title = "Atividade em Tempo Real",
    liveMode = true,
    className = "",
    maxHeight = 520,
}: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, margin: "-40px" });
    const [events, setEvents] = useState<FeedEvent[]>(initialEvents);
    const [filter, setFilter] = useState<EventType | "all">("all");
    const [paused, setPaused] = useState(false);
    const poolIdx = useRef(0);
    const [tick, setTick] = useState(0);

    // Relative time refresh every 30s
    useEffect(() => {
        const id = setInterval(() => setTick(t => t + 1), 30_000);
        return () => clearInterval(id);
    }, []);

    // Live event injection every 10s
    useEffect(() => {
        if (!liveMode || paused) return;
        const id = setInterval(() => {
            const tmpl = LIVE_POOL[poolIdx.current % LIVE_POOL.length];
            poolIdx.current++;
            setEvents(prev => [{
                ...tmpl, id: `live-${Date.now()}`, time: new Date(),
            }, ...prev].slice(0, 40));
            // Scroll to top
            listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        }, 10_000);
        return () => clearInterval(id);
    }, [liveMode, paused]);

    const visible = events.filter(e => filter === "all" || e.type === filter);

    const typeCounts = (Object.keys(EVENT_CONFIG) as EventType[]).reduce((acc, t) => {
        acc[t] = events.filter(e => e.type === t).length;
        return acc;
    }, {} as Record<EventType, number>);

    return (
        <motion.div
            ref={ref}
            data-guide-id="cc_activity_feed"
            initial={{ opacity: 0, y: 28 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className={`relative rounded-3xl flex flex-col overflow-hidden ${className}`}
            style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(212,175,55,0.14)",
                backdropFilter: "blur(24px)",
            }}
        >
            {/* Ambient glow */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
                <div className="absolute top-0 right-0 w-56 h-48 blur-3xl opacity-8"
                    style={{ background: `radial-gradient(ellipse, ${GOLD} 0%, transparent 70%)` }} />
            </div>

            {/* Header */}
            <div className="px-6 pt-6 pb-3 flex items-start justify-between gap-3 flex-wrap relative">
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: GOLD }}>
                        {title}
                    </p>
                    <div className="flex items-center gap-2">
                        <p className="text-2xl font-extrabold text-white">
                            {visible.length}
                            <span className="text-base font-semibold ml-1" style={{ color: "rgba(255,255,255,0.3)" }}>eventos</span>
                        </p>
                        {liveMode && (
                            <button
                                onClick={() => setPaused(p => !p)}
                                className="flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full transition-colors ml-1"
                                style={{
                                    background: paused ? "rgba(255,255,255,0.06)" : "rgba(34,197,94,0.12)",
                                    color: paused ? "rgba(255,255,255,0.35)" : "#4ade80",
                                }}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full inline-block ${paused ? "bg-gray-500" : "bg-green-400 animate-pulse"}`} />
                                {paused ? "pausado" : "ao vivo"}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Filter chips */}
            <div className="px-6 pb-3 flex gap-1.5 flex-wrap">
                <Chip label="Todos" count={events.length} active={filter === "all"} color={GOLD} onClick={() => setFilter("all")} />
                {(Object.entries(EVENT_CONFIG) as [EventType, typeof EVENT_CONFIG[EventType]][]).map(([t, cfg]) => (
                    <Chip key={t} label={cfg.label} count={typeCounts[t]} active={filter === t}
                        color={cfg.color} icon={cfg.icon} onClick={() => setFilter(t)} />
                ))}
            </div>

            {/* Feed list */}
            <div
                ref={listRef}
                className="px-5 pb-4 flex-1 overflow-y-auto"
                style={{ maxHeight, scrollbarWidth: "none" }}
            >
                <AnimatePresence mode="popLayout" initial={false}>
                    {visible.length === 0 ? (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="py-12 text-center">
                            <span className="text-3xl block mb-2">🌙</span>
                            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Sem eventos para exibir.</p>
                        </motion.div>
                    ) : (
                        visible.map((e, i) => (
                            <EventRow key={e.id} event={e} isFirst={i === 0} />
                        ))
                    )}
                </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t flex items-center justify-between"
                style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                    Mostrando {visible.length} de {events.length} eventos
                </p>
                {events.length > initialEvents.length && (
                    <button onClick={() => setEvents(initialEvents)}
                        className="text-xs" style={{ color: "rgba(212,175,55,0.4)" }}>
                        Limpar live events
                    </button>
                )}
            </div>
        </motion.div>
    );
}

// ─── Chip ─────────────────────────────────────────────────────────────────────
function Chip({ label, count, active, color, icon, onClick }: {
    label: string; count: number; active: boolean;
    color: string; icon?: string; onClick: () => void;
}) {
    return (
        <button onClick={onClick}
            className="px-2.5 py-1 text-xs font-semibold rounded-full transition-all flex items-center gap-1"
            style={{
                background: active ? `${color}22` : "rgba(255,255,255,0.05)",
                border: `1px solid ${active ? `${color}44` : "transparent"}`,
                color: active ? color : "rgba(255,255,255,0.35)",
            }}>
            {icon && <span style={{ fontSize: 11 }}>{icon}</span>}
            {label}
            <span className="opacity-60">{count}</span>
        </button>
    );
}
