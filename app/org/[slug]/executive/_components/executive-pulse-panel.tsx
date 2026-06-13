"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Siren } from "lucide-react";
import type { ExecutivePriorityAlert } from "@/lib/executive/tenant-intelligence";
import type { ExecutivePulseActionStatus } from "@/lib/executive/pulse-actions";

type Props = {
    orgSlug: string;
    alerts: ExecutivePriorityAlert[];
};

type PulseStateFilter = "all" | ExecutivePulseActionStatus;

const PULSE_CATEGORY_LABELS: Record<ExecutivePriorityAlert["category"], string> = {
    revenue_risk: "Risco de receita",
    stalled_deal: "Negocio travado",
    accelerating_loss: "Perda em aceleracao",
    recovery: "Retomada em curso",
    growth_above_average: "Crescimento acima da media",
};

const PULSE_CATEGORY_ORDER: ExecutivePriorityAlert["category"][] = [
    "accelerating_loss",
    "revenue_risk",
    "stalled_deal",
    "recovery",
    "growth_above_average",
];

const PULSE_STATE_FILTER_OPTIONS: Array<{
    value: PulseStateFilter;
    label: string;
}> = [
    { value: "all", label: "Todos" },
    { value: "open", label: "Abertos" },
    { value: "tracking", label: "Em acompanhamento" },
    { value: "delegated", label: "Delegados" },
    { value: "resolved", label: "Resolvidos" },
];

function alertToneClasses(severity: ExecutivePriorityAlert["severity"]): string {
    switch (severity) {
        case "critical":
            return "border-rose-400/20 bg-rose-400/10 text-rose-100";
        case "high":
            return "border-orange-400/20 bg-orange-400/10 text-orange-100";
        case "warning":
            return "border-amber-400/20 bg-amber-400/10 text-amber-100";
        default:
            return "border-cyan-400/20 bg-cyan-400/10 text-cyan-100";
    }
}

function pulseCategoryClasses(category: ExecutivePriorityAlert["category"]): string {
    switch (category) {
        case "accelerating_loss":
            return "border-rose-400/20 bg-rose-400/10 text-rose-100";
        case "stalled_deal":
            return "border-orange-400/20 bg-orange-400/10 text-orange-100";
        case "recovery":
            return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
        case "growth_above_average":
            return "border-cyan-400/20 bg-cyan-400/10 text-cyan-100";
        default:
            return "border-amber-400/20 bg-amber-400/10 text-amber-100";
    }
}

function pulseStatusLabel(status: ExecutivePulseActionStatus): string {
    switch (status) {
        case "tracking":
            return "Em acompanhamento";
        case "delegated":
            return "Delegado";
        case "resolved":
            return "Resolvido";
        default:
            return "Aberto";
    }
}

function pulseStatusClasses(status: ExecutivePulseActionStatus): string {
    switch (status) {
        case "tracking":
            return "border-sky-400/20 bg-sky-400/10 text-sky-100";
        case "delegated":
            return "border-violet-400/20 bg-violet-400/10 text-violet-100";
        case "resolved":
            return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
        default:
            return "border-white/10 bg-white/5 text-slate-200";
    }
}

function formatDateTime(value: string | null): string {
    if (!value) {
        return "-";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(date);
}

function actionLabel(status: Exclude<ExecutivePulseActionStatus, "open">): string {
    switch (status) {
        case "tracking":
            return "Acompanhar";
        case "delegated":
            return "Delegar";
        case "resolved":
            return "Marcar como resolvido";
    }

    return status;
}

function formatLinkedEntity(alert: ExecutivePriorityAlert): string | null {
    if (!alert.linkedEntityId || !alert.linkedEntityType) {
        return null;
    }

    return alert.linkedEntityType === "deal"
        ? "Vinculado a deal"
        : "Vinculado a contato";
}

function sortPulseSummary(left: ExecutivePriorityAlert["category"], right: ExecutivePriorityAlert["category"]): number {
    return PULSE_CATEGORY_ORDER.indexOf(left) - PULSE_CATEGORY_ORDER.indexOf(right);
}

function pulseFilterLabel(filter: PulseStateFilter): string {
    return PULSE_STATE_FILTER_OPTIONS.find((option) => option.value === filter)?.label ?? "Todos";
}

export function ExecutivePulsePanel({ orgSlug, alerts }: Props) {
    const [items, setItems] = useState(alerts);
    const [pendingPulseKey, setPendingPulseKey] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [selectedFilter, setSelectedFilter] = useState<PulseStateFilter>("all");

    useEffect(() => {
        setItems(alerts);
    }, [alerts]);

    const pulseSummary = useMemo(() => {
        const summary = items.reduce<Record<ExecutivePriorityAlert["category"], number>>((accumulator, alert) => {
            accumulator[alert.category] = (accumulator[alert.category] ?? 0) + 1;
            return accumulator;
        }, {
            revenue_risk: 0,
            stalled_deal: 0,
            accelerating_loss: 0,
            recovery: 0,
            growth_above_average: 0,
        });

        return Object.entries(summary)
            .map(([category, count]) => ({
                category: category as ExecutivePriorityAlert["category"],
                label: PULSE_CATEGORY_LABELS[category as ExecutivePriorityAlert["category"]],
                count,
            }))
            .filter((item) => item.count > 0)
            .sort((left, right) => sortPulseSummary(left.category, right.category));
    }, [items]);

    const filteredItems = useMemo(() => {
        if (selectedFilter === "all") {
            return items;
        }

        return items.filter((alert) => alert.status === selectedFilter);
    }, [items, selectedFilter]);

    const filterCounts = useMemo(() => {
        return items.reduce<Record<PulseStateFilter, number>>((accumulator, alert) => {
            accumulator.all += 1;
            accumulator[alert.status] += 1;
            return accumulator;
        }, {
            all: 0,
            open: 0,
            tracking: 0,
            delegated: 0,
            resolved: 0,
        });
    }, [items]);

    const handleAction = async (alert: ExecutivePriorityAlert, status: Exclude<ExecutivePulseActionStatus, "open">) => {
        if (pendingPulseKey && pendingPulseKey !== alert.pulseKey) {
            return;
        }

        const previousItems = items;
        const optimisticTimestamp = new Date().toISOString();
        setPendingPulseKey(alert.pulseKey);
        setErrorMessage(null);
        setItems((current) => current.map((item) => item.pulseKey === alert.pulseKey ? {
            ...item,
            status,
            lastActionAt: optimisticTimestamp,
            lastActionBy: item.lastActionBy ?? "Voce",
        } : item));

        try {
            const response = await fetch(`/api/org/${orgSlug}/executive/pulse-actions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    pulseKey: alert.pulseKey,
                    action: status,
                    linkedEntityType: alert.linkedEntityType ?? null,
                    linkedEntityId: alert.linkedEntityId ?? null,
                }),
            });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(payload?.message ?? payload?.error ?? "Nao foi possivel registrar a acao do Pulse.");
            }

            const nextState = payload?.data?.alertState ?? payload?.data?.state ?? null;
            if (nextState) {
                setItems((current) => current.map((item) => item.pulseKey === alert.pulseKey ? {
                    ...item,
                    ...nextState,
                } : item));
            }
        } catch (error) {
            setItems(previousItems);
            setErrorMessage(error instanceof Error ? error.message : "Falha ao registrar a acao do Pulse.");
        } finally {
            setPendingPulseKey(null);
        }
    };

    return (
        <div className="rounded-[34px] border border-white/8 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">CEO Pulse</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight">Onde intervir primeiro</h3>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                        Sinais curtos e priorizados por risco, perda, retomada e crescimento.
                        O sync automatico continua ativo. O filtro abaixo apenas organiza a leitura. Sem realtime.
                    </p>
                </div>
                <Siren className="h-6 w-6 text-amber-300" />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
                {PULSE_STATE_FILTER_OPTIONS.map((option) => {
                    const isActive = selectedFilter === option.value;
                    const count = filterCounts[option.value];

                    return (
                        <button
                            key={option.value}
                            type="button"
                            aria-pressed={isActive}
                            onClick={() => setSelectedFilter(option.value)}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] transition ${
                                isActive
                                    ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-100"
                                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                            }`}
                            >
                                <span>{option.label}</span>
                            <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                                isActive
                                    ? "bg-cyan-100/15 text-cyan-50"
                                    : "bg-white/10 text-slate-200"
                            }`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                Filtro de leitura apenas. {pulseFilterLabel(selectedFilter)}.
            </p>

            {pulseSummary.length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2">
                    {pulseSummary.map((item) => (
                        <span
                            key={item.category}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${pulseCategoryClasses(item.category)}`}
                        >
                            {item.label}
                            <span className="text-[10px] opacity-80">{item.count}</span>
                        </span>
                    ))}
                </div>
            ) : null}

            {errorMessage ? (
                <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                    {errorMessage}
                </div>
            ) : null}

            <div className="mt-6 space-y-3">
                {filteredItems.length > 0 ? filteredItems.map((alert) => {
                    const pending = pendingPulseKey === alert.pulseKey;
                    const linkedEntityLabel = formatLinkedEntity(alert);

                    return (
                        <article
                            key={alert.pulseKey}
                            className={`rounded-2xl border p-4 ${alertToneClasses(alert.severity)}`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold uppercase tracking-[0.18em]">{alert.title}</p>
                                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] opacity-80">
                                            {alert.categoryLabel}
                                        </span>
                                        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${pulseStatusClasses(alert.status)}`}>
                                            {pulseStatusLabel(alert.status)}
                                        </span>
                                        {linkedEntityLabel ? (
                                            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] opacity-80">
                                                {linkedEntityLabel}
                                            </span>
                                        ) : null}
                                    </div>
                                    <p className="mt-3 text-sm leading-6">{alert.message}</p>
                                    <p className="mt-3 text-xs uppercase tracking-[0.18em] opacity-70">Por que agora</p>
                                    <p className="mt-2 text-sm leading-6">{alert.whyNow}</p>
                                    <p className="mt-3 text-xs uppercase tracking-[0.18em] opacity-70">Foco recomendado</p>
                                    <p className="mt-2 text-sm leading-6">{alert.recommendedFocus}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs uppercase tracking-[0.18em] opacity-70">Impacto</p>
                                    <p className="mt-2 text-sm font-semibold">{alert.impact}</p>
                                    <p className="mt-3 text-xs uppercase tracking-[0.18em] opacity-70">Acao</p>
                                    <p className="mt-2 text-sm font-semibold">{alert.ctaLabel}</p>
                                    {alert.lastActionAt ? (
                                        <p className="mt-3 text-xs opacity-80">Atualizado {formatDateTime(alert.lastActionAt)}</p>
                                    ) : (
                                        <p className="mt-3 text-xs opacity-80">Ainda sem intervencao registrada</p>
                                    )}
                                    {alert.lastActionBy ? (
                                        <p className="mt-1 text-xs opacity-80">Por {alert.lastActionBy}</p>
                                    ) : null}
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() => void handleAction(alert, "tracking")}
                                    className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-sky-100 transition hover:bg-sky-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {pending && alert.status === "tracking" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                    {actionLabel("tracking")}
                                </button>
                                <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() => void handleAction(alert, "delegated")}
                                    className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-violet-100 transition hover:bg-violet-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {pending && alert.status === "delegated" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                    {actionLabel("delegated")}
                                </button>
                                <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() => void handleAction(alert, "resolved")}
                                    className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {pending && alert.status === "resolved" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                    {actionLabel("resolved")}
                                </button>
                            </div>
                        </article>
                    );
                }) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-8 text-sm text-slate-400">
                        Nenhum alerta executivo neste recorte. O filtro apenas organiza a leitura.
                    </div>
                )}
            </div>
        </div>
    );
}
