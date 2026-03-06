"use client";

/**
 * components/charts/smart-alerts-panel.tsx
 * Premium Smart Alerts Panel — CEO Executive Dashboard
 *
 * Stack : React + Framer Motion + TailwindCSS
 * Style : Glassmorphism · priority color-coding · animated entrance + live simulation
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────
export type AlertPriority = "critical" | "warning" | "normal";

export interface Alert {
    id: string;
    priority: AlertPriority;
    title: string;
    detail: string;
    metric?: string;       // e.g. "32% abaixo"
    time: string;
    action?: string;       // CTA label
    onAction?: () => void;
    dismissed?: boolean;
}

interface Props {
    alerts?: Alert[];
    title?: string;
    className?: string;
    /** If true, simulates new alerts arriving every X ms */
    liveMode?: boolean;
}

// ─── Seed alerts ─────────────────────────────────────────────────────────────
const SEED_ALERTS: Alert[] = [
    {
        id: "a1", priority: "critical",
        title: "Receita abaixo da projeção",
        detail: "Receita do mês 18% abaixo da meta definida para Março.",
        metric: "−18% vs meta",
        time: "agora",
        action: "Ver relatório",
    },
    {
        id: "a2", priority: "critical",
        title: "Leads sem resposta (+24h)",
        detail: "14 leads qualificados ainda sem primeiro contato após 24 horas.",
        metric: "14 leads",
        time: "há 6min",
        action: "Atribuir agora",
    },
    {
        id: "a3", priority: "warning",
        title: "Tempo de resposta lento",
        detail: "Média de resposta subiu para 4h12min. Meta é abaixo de 2h.",
        metric: "4h 12min",
        time: "há 14min",
        action: "Ver detalhes",
    },
    {
        id: "a4", priority: "warning",
        title: "Taxa de conversão em queda",
        detail: "Conversão caiu de 12.4% → 9.1% nos últimos 7 dias.",
        metric: "−3.3 p.p.",
        time: "há 31min",
        action: "Analisar",
    },
    {
        id: "a5", priority: "warning",
        title: "Sequência de outbound parada",
        detail: "3 sequências ativas sem step enviado há mais de 48h.",
        metric: "3 seq.",
        time: "há 1h",
        action: "Reativar",
    },
    {
        id: "a6", priority: "normal",
        title: "Deal packet expirado",
        detail: "Executive One-Pager de Incorporadora Martins não foi aberto em 5 dias.",
        metric: "5 dias",
        time: "há 2h",
        action: "Reenviar",
    },
    {
        id: "a7", priority: "normal",
        title: "Ranking atualizado",
        detail: "Marina Lima assumiu a liderança de vendas com R$ 312k fechados no mês.",
        time: "há 3h",
    },
    {
        id: "a8", priority: "normal",
        title: "Meta semanal atingida",
        detail: "Time bateu 100% da meta de reuniões agendadas para a semana.",
        metric: "✓ 100%",
        time: "há 4h",
    },
];

// Simulated live alerts to inject
const LIVE_POOL: Omit<Alert, "id" | "time">[] = [
    { priority: "critical", title: "ROI Deal abaixo do esperado", detail: "RF Consultoria com ROI projetado 40% abaixo do histórico.", metric: "−40% ROI", action: "Revisar" },
    { priority: "warning", title: "Proposta não aberta", detail: "Proposta para Clínica Souza enviada há 72h sem abertura.", metric: "72h", action: "Follow-up" },
    { priority: "normal", title: "Novo lead hot detectado", detail: "Score 88/100 — Drummond Real Estate entrou no funil.", metric: "Score 88" },
];

// ─── Palette ──────────────────────────────────────────────────────────────────
const GOLD = "#d4af37";
const BORDER = "rgba(212,175,55,0.14)";

const PRIORITY_CONFIG: Record<AlertPriority, {
    dot: string; glow: string; bg: string; border: string;
    badge: string; badgeText: string; icon: string;
}> = {
    critical: {
        dot: "#ef4444",
        glow: "rgba(239,68,68,0.35)",
        bg: "rgba(239,68,68,0.07)",
        border: "rgba(239,68,68,0.22)",
        badge: "rgba(239,68,68,0.18)",
        badgeText: "#f87171",
        icon: "🚨",
    },
    warning: {
        dot: "#f59e0b",
        glow: "rgba(245,158,11,0.3)",
        bg: "rgba(245,158,11,0.06)",
        border: "rgba(245,158,11,0.22)",
        badge: "rgba(245,158,11,0.18)",
        badgeText: "#fbbf24",
        icon: "⚠️",
    },
    normal: {
        dot: "#22c55e",
        glow: "rgba(34,197,94,0.25)",
        bg: "rgba(34,197,94,0.04)",
        border: "rgba(34,197,94,0.15)",
        badge: "rgba(34,197,94,0.15)",
        badgeText: "#4ade80",
        icon: "✅",
    },
};

const PRIORITY_ORDER: Record<AlertPriority, number> = { critical: 0, warning: 1, normal: 2 };

// ─── Single Alert Row ─────────────────────────────────────────────────────────
function AlertRow({
    alert, onDismiss,
}: { alert: Alert; onDismiss: (id: string) => void }) {
    const [expanded, setExpanded] = useState(false);
    const cfg = PRIORITY_CONFIG[alert.priority];

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 16, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -16, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl overflow-hidden cursor-pointer group"
            style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
            onClick={() => setExpanded(e => !e)}
        >
            <div className="p-3.5 flex items-start gap-3">
                {/* Priority dot */}
                <div className="flex-shrink-0 mt-1 relative">
                    <div className="w-2 h-2 rounded-full" style={{ background: cfg.dot, boxShadow: `0 0 6px ${cfg.glow}` }} />
                    {alert.priority === "critical" && (
                        <div className="absolute inset-0 rounded-full animate-ping" style={{ background: cfg.dot, opacity: 0.4 }} />
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-white leading-snug">{alert.title}</p>
                        {alert.metric && (
                            <span className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full"
                                style={{ background: cfg.badge, color: cfg.badgeText }}>
                                {alert.metric}
                            </span>
                        )}
                    </div>

                    <AnimatePresence initial={false}>
                        {expanded ? (
                            <motion.p
                                key="expanded"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.22 }}
                                className="text-xs leading-relaxed mb-1.5"
                                style={{ color: "rgba(255,255,255,0.55)" }}
                            >
                                {alert.detail}
                            </motion.p>
                        ) : (
                            <motion.p
                                key="collapsed"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="text-xs truncate"
                                style={{ color: "rgba(255,255,255,0.4)" }}
                            >
                                {alert.detail}
                            </motion.p>
                        )}
                    </AnimatePresence>

                    <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>{alert.time}</span>

                        {expanded && alert.action && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                onClick={e => { e.stopPropagation(); alert.onAction?.(); }}
                                className="text-xs font-semibold px-2.5 py-0.5 rounded-full transition-all"
                                style={{ background: cfg.badge, color: cfg.badgeText }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.97 }}
                            >
                                {alert.action} →
                            </motion.button>
                        )}

                        <motion.button
                            onClick={e => { e.stopPropagation(); onDismiss(alert.id); }}
                            className="ml-auto text-xs opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.35)" }}
                            whileHover={{ scale: 1.05 }}
                        >
                            ✕
                        </motion.button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function SmartAlertsPanel({
    alerts: initialAlerts = SEED_ALERTS,
    title = "Smart Alerts",
    className = "",
    liveMode = true,
}: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, margin: "-40px" });
    const [alerts, setAlerts] = useState<Alert[]>(initialAlerts);
    const [filter, setFilter] = useState<AlertPriority | "all">("all");
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const poolIdx = useRef(0);

    // Live alert simulation
    useEffect(() => {
        if (!liveMode) return;
        const id = setInterval(() => {
            const template = LIVE_POOL[poolIdx.current % LIVE_POOL.length];
            poolIdx.current++;
            const newAlert: Alert = {
                ...template,
                id: `live-${Date.now()}`,
                time: "agora",
            };
            setAlerts(prev => [newAlert, ...prev].slice(0, 20));
        }, 18000);
        return () => clearInterval(id);
    }, [liveMode]);

    const visible = alerts
        .filter(a => !dismissed.has(a.id))
        .filter(a => filter === "all" || a.priority === filter)
        .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

    const counts = {
        critical: alerts.filter(a => a.priority === "critical" && !dismissed.has(a.id)).length,
        warning: alerts.filter(a => a.priority === "warning" && !dismissed.has(a.id)).length,
        normal: alerts.filter(a => a.priority === "normal" && !dismissed.has(a.id)).length,
    };

    function dismiss(id: string) {
        setDismissed(prev => new Set([...prev, id]));
    }

    function dismissAll() {
        setDismissed(new Set(alerts.map(a => a.id)));
    }

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 28 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className={`relative rounded-3xl overflow-hidden flex flex-col ${className}`}
            style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${BORDER}`,
                backdropFilter: "blur(24px)",
            }}
        >
            {/* Ambient glow — red if criticals exist */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
                <div className="absolute -top-16 right-0 w-64 h-48 blur-3xl opacity-10 transition-colors duration-1000"
                    style={{
                        background: counts.critical > 0
                            ? "radial-gradient(ellipse, #ef4444 0%, transparent 70%)"
                            : "radial-gradient(ellipse, #d4af37 0%, transparent 70%)"
                    }} />
            </div>

            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-3 flex-wrap relative">
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: GOLD }}>
                        {title}
                    </p>
                    <div className="flex items-center gap-2">
                        <p className="text-2xl font-extrabold text-white">
                            {visible.length}
                            <span className="text-base font-semibold ml-1" style={{ color: "rgba(255,255,255,0.3)" }}>alertas</span>
                        </p>
                        {liveMode && (
                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ml-1"
                                style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80" }}>
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                                ao vivo
                            </span>
                        )}
                    </div>
                </div>

                {/* Summary dots */}
                <div className="flex items-center gap-3">
                    {(["critical", "warning", "normal"] as AlertPriority[]).map(p => {
                        const cfg = PRIORITY_CONFIG[p];
                        const count = counts[p];
                        return (
                            <div key={p} className="flex items-center gap-1.5 text-xs">
                                <div className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ background: cfg.dot, boxShadow: count > 0 ? `0 0 6px ${cfg.glow}` : undefined }} />
                                <span style={{ color: count > 0 ? cfg.badgeText : "rgba(255,255,255,0.25)" }}>
                                    {count}
                                </span>
                            </div>
                        );
                    })}
                    {dismissed.size < alerts.length && (
                        <button onClick={dismissAll}
                            className="text-xs px-2 py-0.5 rounded-full transition-colors"
                            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}>
                            Limpar todos
                        </button>
                    )}
                </div>
            </div>

            {/* Filter tabs */}
            <div className="px-6 pb-3 flex gap-1.5 flex-wrap">
                {(["all", "critical", "warning", "normal"] as const).map(f => {
                    const cfg = f !== "all" ? PRIORITY_CONFIG[f] : null;
                    const active = filter === f;
                    return (
                        <button key={f} onClick={() => setFilter(f)}
                            className="px-3 py-1 text-xs font-semibold rounded-full transition-all"
                            style={{
                                background: active ? (cfg?.badge ?? "rgba(212,175,55,0.18)") : "rgba(255,255,255,0.05)",
                                color: active ? (cfg?.badgeText ?? GOLD) : "rgba(255,255,255,0.35)",
                                border: `1px solid ${active ? (cfg?.border ?? BORDER) : "transparent"}`,
                            }}
                        >
                            {f === "all" ? "Todos" : f === "critical" ? "Crítico" : f === "warning" ? "Alerta" : "Normal"}
                            {f !== "all" && <span className="ml-1" style={{ opacity: 0.7 }}>{counts[f]}</span>}
                        </button>
                    );
                })}
            </div>

            {/* Alert list */}
            <div className="px-4 pb-5 space-y-2 flex-1 overflow-y-auto" style={{ maxHeight: 480 }}>
                <AnimatePresence mode="popLayout">
                    {visible.length === 0 ? (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center py-12 text-center"
                        >
                            <span className="text-3xl mb-2">✅</span>
                            <p className="text-sm font-semibold text-white/60">Tudo em ordem</p>
                            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                                Nenhum alerta ativo no momento.
                            </p>
                        </motion.div>
                    ) : (
                        visible.map(alert => (
                            <AlertRow key={alert.id} alert={alert} onDismiss={dismiss} />
                        ))
                    )}
                </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t flex items-center justify-between"
                style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                    {dismissed.size > 0 ? `${dismissed.size} alertas arquivados` : "Clique num alerta para expandir"}
                </p>
                <button
                    onClick={() => setDismissed(new Set())}
                    className="text-xs transition-opacity"
                    style={{ color: dismissed.size > 0 ? "rgba(212,175,55,0.5)" : "rgba(255,255,255,0.1)" }}
                >
                    {dismissed.size > 0 ? "Restaurar" : ""}
                </button>
            </div>
        </motion.div>
    );
}
