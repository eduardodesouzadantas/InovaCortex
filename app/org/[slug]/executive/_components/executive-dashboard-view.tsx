import {
    AlertTriangle,
    ArrowDownRight,
    ArrowRight,
    ArrowUpRight,
    BriefcaseBusiness,
    Gauge,
    Layers3,
    Siren,
    TrendingDown,
    TrendingUp,
    ShieldAlert,
} from "lucide-react";

import type {
    ExecutiveDashboardModel,
    ExecutivePeriodComparisonItem,
    ExecutivePriorityAlert,
} from "@/lib/executive/tenant-intelligence";
import { ExecutivePulsePanel } from "./executive-pulse-panel";

function toneClasses(tone: "neutral" | "positive" | "warning" | "critical"): string {
    switch (tone) {
        case "positive":
            return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
        case "warning":
            return "border-amber-400/20 bg-amber-400/10 text-amber-100";
        case "critical":
            return "border-rose-400/20 bg-rose-400/10 text-rose-100";
        default:
            return "border-cyan-400/20 bg-cyan-400/10 text-cyan-100";
    }
}

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

function formatDateTime(value: string): string {
    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(new Date(value));
}

function comparisonIcon(item: ExecutivePeriodComparisonItem) {
    if (item.direction === "up") {
        return item.tone === "critical"
            ? <ArrowUpRight className="h-4 w-4 text-rose-200" />
            : <ArrowUpRight className="h-4 w-4 text-emerald-200" />;
    }

    if (item.direction === "down") {
        return item.tone === "positive"
            ? <ArrowDownRight className="h-4 w-4 text-emerald-200" />
            : <ArrowDownRight className="h-4 w-4 text-rose-200" />;
    }

    return <ArrowRight className="h-4 w-4 text-cyan-200" />;
}

function formatCurrencyFromCents(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
    }).format((value || 0) / 100);
}

function seriesBarWidth(value: number, maxValue: number): string {
    if (maxValue <= 0 || value <= 0) {
        return "10%";
    }

    return `${Math.max(10, Math.round((value / maxValue) * 100))}%`;
}

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

export function ExecutiveDashboardView({
    data,
}: {
    data: ExecutiveDashboardModel;
}) {
    const maxSeriesRevenue = Math.max(
        1,
        ...data.recentSeries.points.map((point) => point.revenueClosedCents),
    );
    const pulseSummary = Object.entries(
        data.prioritizedAlerts.reduce<Record<ExecutivePriorityAlert["category"], number>>((accumulator, alert) => {
            accumulator[alert.category] = (accumulator[alert.category] || 0) + 1;
            return accumulator;
        }, {
            revenue_risk: 0,
            stalled_deal: 0,
            accelerating_loss: 0,
            recovery: 0,
            growth_above_average: 0,
        }),
    ).flatMap(([category, count]) => count > 0
        ? [{
            category: category as ExecutivePriorityAlert["category"],
            label: PULSE_CATEGORY_LABELS[category as ExecutivePriorityAlert["category"]],
            count,
        }]
        : []);
    pulseSummary.sort((left, right) => PULSE_CATEGORY_ORDER.indexOf(left.category) - PULSE_CATEGORY_ORDER.indexOf(right.category));

    return (
        <div className="space-y-12">
            <section id="overview" className="space-y-8">
                <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
                    <div className="rounded-[34px] border border-white/8 bg-white/[0.04] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                            <Layers3 className="h-3.5 w-3.5 text-amber-300" />
                            {data.org.plan} · atualizado em {formatDateTime(data.generatedAt)}
                        </div>
                        <h2 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">{data.overview.headline}</h2>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
                            {data.overview.subheadline}
                        </p>

                        <div className={`mt-6 rounded-[28px] border p-5 ${toneClasses(data.decisionNarrative.tone)}`}>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">Resumo executivo</p>
                            <p className="mt-3 text-lg font-semibold tracking-tight">{data.decisionNarrative.summary}</p>
                            <p className="mt-3 text-sm leading-6 opacity-90">{data.decisionNarrative.stateOfPlay}</p>
                        </div>

                        {!data.hasData && data.emptyReason ? (
                            <div className="mt-6 rounded-[32px] border border-amber-400/20 bg-amber-400/10 p-6 text-amber-100">
                                <p className="text-sm font-semibold uppercase tracking-[0.18em]">Leitura honesta</p>
                                <p className="mt-3 max-w-3xl text-sm leading-7">{data.emptyReason}</p>
                            </div>
                        ) : null}
                    </div>

                    <div className="grid gap-4">
                        {data.summaryCards.map((card) => (
                            <article
                                key={card.id}
                                className={`rounded-[28px] border p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] ${toneClasses(card.tone)}`}
                            >
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">{card.title}</p>
                                <p className="mt-3 text-3xl font-semibold tracking-tight">{card.value}</p>
                                <p className="mt-2 text-sm opacity-80">{card.detail}</p>
                            </article>
                        ))}
                    </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-4">
                    {data.headlineMetrics.map((metric) => (
                        <article
                            key={metric.id}
                            className={`rounded-[30px] border p-6 backdrop-blur ${toneClasses(metric.tone)}`}
                        >
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">{metric.label}</p>
                            <p className="mt-4 text-4xl font-semibold tracking-tight">{metric.value}</p>
                            <p className="mt-3 text-sm opacity-80">{metric.detail}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-[34px] border border-white/8 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Serie recente</p>
                            <h3 className="mt-2 text-2xl font-semibold tracking-tight">Trajetoria curta do negocio</h3>
                        </div>
                        <TrendingUp className="h-6 w-6 text-cyan-200" />
                    </div>

                    <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">{data.recentSeries.insight}</p>

                    {data.recentSeries.hasData ? (
                        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            {data.recentSeries.points.map((point) => (
                                <article key={point.id} className="rounded-[28px] border border-white/8 bg-black/10 p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{point.shortLabel}</p>
                                            <p className="mt-2 text-sm font-medium text-white">{point.label}</p>
                                        </div>
                                        <div className="rounded-full border border-white/8 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
                                            Receita
                                        </div>
                                    </div>

                                    <p className="mt-4 text-2xl font-semibold tracking-tight text-white">
                                        {formatCurrencyFromCents(point.revenueClosedCents)}
                                    </p>

                                    <div className="mt-4 h-2 rounded-full bg-white/6">
                                        <div
                                            className="h-2 rounded-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300"
                                            style={{ width: seriesBarWidth(point.revenueClosedCents, maxSeriesRevenue) }}
                                        />
                                    </div>

                                    <div className="mt-4 grid gap-3 text-sm text-slate-300">
                                        <div className="flex items-center justify-between gap-3">
                                            <span>Propostas</span>
                                            <span className="font-semibold text-white">{point.proposalsSent}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span>Fechamentos</span>
                                            <span className="font-semibold text-white">{point.acceptedProposals}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span>Alertas criticos</span>
                                            <span className="font-semibold text-white">{point.criticalAlerts}</span>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-8 text-sm text-slate-400">
                            Ainda nao ha historico suficiente para a serie executiva curta.
                        </div>
                    )}
                </div>

                <div className="rounded-[34px] border border-white/8 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Revenue intelligence</p>
                            <h3 className="mt-2 text-2xl font-semibold tracking-tight">Impacto e direcao de receita</h3>
                        </div>
                        <Gauge className="h-6 w-6 text-amber-300" />
                    </div>

                    <div className={`mt-6 rounded-[28px] border p-5 ${toneClasses(data.revenueIntelligence.tone)}`}>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">Leitura executiva</p>
                        <p className="mt-3 text-lg font-semibold tracking-tight">{data.revenueIntelligence.outlook}</p>
                        <p className="mt-3 text-sm leading-6 opacity-90">{data.revenueIntelligence.pipelineDirection}</p>
                        <p className="mt-3 text-sm leading-6 opacity-90">{data.revenueIntelligence.riskNarrative}</p>
                    </div>

                    <div className="mt-6 rounded-[28px] border border-white/10 bg-black/10 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">War Room</p>
                        <p className="mt-2 text-sm text-slate-200">Leitura central de risco e intervencao imediata</p>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Receita aberta</p>
                                <p className="mt-1 text-lg font-semibold text-white">{data.revenueIntelligence.warRoomSnapshot.estimatedOpenRevenue}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Receita em risco</p>
                                <p className="mt-1 text-lg font-semibold text-white">{data.revenueIntelligence.warRoomSnapshot.estimatedRevenueAtRisk}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Momentum</p>
                                <p className="mt-1 text-lg font-semibold text-white">{data.revenueIntelligence.warRoomSnapshot.momentumDirection}</p>
                            </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Stage mais travado</p>
                                <p className="mt-1 text-sm font-semibold text-white">{data.revenueIntelligence.warRoomSnapshot.stagnantStage}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Top risk stage</p>
                                <p className="mt-1 text-sm font-semibold text-white">{data.revenueIntelligence.warRoomSnapshot.topRiskStage}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Top risk owner</p>
                                <p className="mt-1 text-sm font-semibold text-white">{data.revenueIntelligence.warRoomSnapshot.topRiskOwner}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Frente principal</p>
                                <p className="mt-1 text-sm font-semibold text-white">{data.revenueIntelligence.warRoomSnapshot.primaryFocus}</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 rounded-[28px] border border-white/10 bg-black/10 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Focos imediatos</p>
                        <div className="mt-3 grid gap-3">
                            {data.revenueIntelligence.immediateFocus.map((item) => (
                                <div key={item.id} className={`rounded-2xl border border-white/10 bg-black/20 p-3`}> 
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">{item.label}</p>
                                    <p className="mt-1 text-sm font-semibold text-white">{item.count} {item.value || ""}</p>
                                    <p className="mt-1 text-xs text-slate-400">{item.detail}</p>
                                    <p className="mt-2 text-xs text-emerald-200">{item.suggestedAction}</p>
                                </div>
                            ))}
                            {data.revenueIntelligence.immediateFocus.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-4 text-sm text-slate-400">
                                    Nenhum foco imediato detectado. A liderança pode manter a disciplina de follow-up e escala.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                        {data.revenueIntelligence.signals.map((signal) => (
                            <article key={signal.id} className={`rounded-[24px] border p-4 ${toneClasses(signal.tone)}`}>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">{signal.label}</p>
                                <p className="mt-3 text-2xl font-semibold tracking-tight">{signal.value}</p>
                                <p className="mt-2 text-sm leading-6 opacity-85">{signal.detail}</p>
                            </article>
                        ))}
                    </div>

                    <div className="mt-6 rounded-[28px] border border-white/8 bg-black/10 p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Foco executivo</p>
                        <p className="mt-3 text-sm leading-6 text-slate-200">{data.revenueIntelligence.focus}</p>
                    </div>

                    <div className="mt-6 rounded-[28px] border border-emerald-400/20 bg-emerald-400/10 p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Growth & Expansion</p>
                        <p className="mt-3 text-lg font-semibold tracking-tight">{data.growthExpansion.primaryGrowthFront}</p>
                        <p className="mt-3 text-sm leading-6 text-slate-200">{data.growthExpansion.mainBottleneck}</p>
                        <p className="mt-3 text-sm leading-6 text-cyan-100">{data.growthExpansion.executiveAction}</p>

                        <div className="mt-4 grid gap-3">
                            {data.growthExpansion.topUpsideOpportunities.map((op) => (
                                <div key={`${op.company}-${op.estimatedValue}`} className="rounded-2xl border border-white/10 bg-black/10 p-3">
                                    <p className="text-sm font-semibold text-white">{op.company}</p>
                                    <p className="text-xs text-slate-400">{op.estimatedValue} ({Math.round(op.probability * 100)}%)</p>
                                    <p className="mt-1 text-xs text-slate-200">{op.recommendedAction}</p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 grid gap-2 md:grid-cols-3">
                            {data.growthExpansion.expansionSignals.map((signal) => (
                                <article key={signal.id} className={`rounded-[22px] border p-3 ${toneClasses(signal.tone)}`}>
                                    <p className="text-[10px] uppercase text-slate-300">{signal.label}</p>
                                    <p className="mt-1 text-sm font-medium text-white">{signal.detail}</p>
                                </article>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <article className={`rounded-[24px] border p-4 ${toneClasses(data.revenueSignals.summary.tone)}`}>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">Revenue engine</p>
                            <p className="mt-3 text-lg font-semibold tracking-tight">{data.revenueSignals.summary.headline}</p>
                            <p className="mt-2 text-sm leading-6 opacity-85">{data.revenueSignals.summary.focus}</p>
                        </article>
                        <article className={`rounded-[24px] border p-4 ${toneClasses(data.revenueSignals.momentum.tone)}`}>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">Momentum do pipeline</p>
                            <p className="mt-3 text-lg font-semibold tracking-tight">{data.revenueSignals.momentum.label}</p>
                            <p className="mt-2 text-sm leading-6 opacity-85">{data.revenueSignals.momentum.detail}</p>
                        </article>
                    </div>

                    <div className="mt-6 rounded-[28px] border border-white/8 bg-black/10 p-5">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Oportunidades em risco</p>
                                <p className="mt-2 text-sm leading-6 text-slate-300">
                                    {data.revenueSignals.mostStagnantStage
                                        ? `Maior concentracao de estagnacao em ${data.revenueSignals.mostStagnantStage.stageLabel}.`
                                        : "Nenhum stage concentrou estagnacao material agora."}
                                </p>
                            </div>
                            {data.revenueSignals.mostStagnantStage ? (
                                <div className="rounded-2xl border border-amber-400/15 bg-amber-400/10 px-3 py-2 text-right text-sm text-amber-100">
                                    <p className="font-semibold">{data.revenueSignals.mostStagnantStage.stalledCount} travadas</p>
                                    <p className="mt-1 text-xs opacity-80">
                                        {formatCurrencyFromCents(data.revenueSignals.mostStagnantStage.estimatedValueCents)}
                                    </p>
                                </div>
                            ) : null}
                        </div>

                        <div className="mt-4 space-y-3">
                            {data.revenueSignals.topAtRiskOpportunities.length > 0 ? data.revenueSignals.topAtRiskOpportunities.slice(0, 4).map((item) => (
                                <article key={item.assessmentId} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="font-medium text-white">{item.company}</p>
                                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{item.stageLabel}</p>
                                            <p className="mt-3 text-sm leading-6 text-slate-300">{item.reason}</p>
                                            <p className="mt-2 text-sm text-cyan-100">{item.recommendedAction}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-amber-200">{formatCurrencyFromCents(item.estimatedValueCents)}</p>
                                            {item.lastTouchAt ? (
                                                <p className="mt-2 text-xs text-slate-400">{formatDateTime(item.lastTouchAt)}</p>
                                            ) : null}
                                        </div>
                                    </div>
                                </article>
                            )) : (
                                <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-8 text-sm text-slate-400">
                                    Nenhuma oportunidade concentrou risco material de receita no momento.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <section id="loss-recovery" className="rounded-[34px] border border-white/8 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Loss & recovery intelligence</p>
                        <h3 className="mt-2 text-2xl font-semibold tracking-tight">Onde a receita escapou e o que e recuperavel</h3>
                    </div>
                    <ShieldAlert className="h-6 w-6 text-rose-300" />
                </div>
 
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <article className={`rounded-[28px] border p-5 ${toneClasses(data.lossRecovery.tone)}`}>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">Motivo dominante</p>
                        <p className="mt-3 text-2xl font-semibold tracking-tight">{data.lossRecovery.dominantReason}</p>
                        <p className="mt-2 text-sm opacity-80">Maior volume de perdas categorizadas</p>
                    </article>
                    <article className="rounded-[28px] border border-white/8 bg-black/10 p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Concentracao por stage</p>
                        <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{data.lossRecovery.topLossStage}</p>
                        <p className="mt-2 text-sm text-slate-400">Maior vazamento detectado no funil</p>
                    </article>
                    <article className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/10 p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Recuperacao potencial</p>
                        <p className="mt-3 text-2xl font-semibold tracking-tight text-emerald-100">{data.lossRecovery.recoverableLossesValue}</p>
                        <p className="mt-2 text-sm text-emerald-200/80">{data.lossRecovery.items.filter(i => i.isRecoverable).length} perdas com sinal de reativacao</p>
                    </article>
                </div>
 
                <div className="mt-6 rounded-[28px] border border-white/8 bg-black/10 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Shortlist executiva de reativacao</p>
                    <div className="mt-4 space-y-3">
                        {data.lossRecovery.items.length > 0 ? data.lossRecovery.items.map((item) => (
                            <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="max-w-xl">
                                        <div className="flex items-center gap-3">
                                            <p className="font-medium text-white">{item.company}</p>
                                            {item.isRecoverable && (
                                                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                                                    Recuperavel
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">Perdido em {item.stage} por {item.reason}</p>
                                        <div className="mt-3 grid gap-2">
                                            <p className="text-sm leading-6 text-slate-300">
                                                <span className="font-semibold text-slate-200">Sinal:</span> {item.recoverySignal}
                                            </p>
                                            <p className="text-sm leading-6 text-cyan-100">
                                                <span className="font-semibold text-cyan-200">Acao sugerida:</span> {item.suggestedAction}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Valor estimado</p>
                                        <p className="mt-1 font-semibold text-slate-300">{item.impactValue}</p>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-8 text-sm text-slate-400 text-center">
                                Nenhuma perda recente categorizada para analise executiva.
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section className="rounded-[34px] border border-white/8 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Growth & Expansion</p>
                        <h3 className="mt-2 text-2xl font-semibold tracking-tight">Onde esta o maior upside comercial</h3>
                    </div>
                    <TrendingUp className="h-6 w-6 text-emerald-300" />
                </div>

                <div className="mt-6 rounded-[28px] border border-emerald-400/20 bg-emerald-400/10 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Frente principal de crescimento</p>
                    <p className="mt-3 text-lg font-semibold tracking-tight text-emerald-100">{data.growthExpansion.primaryGrowthFront}</p>
                    <p className="mt-2 text-sm text-emerald-200/80">{data.growthExpansion.mainBottleneck}</p>
                    <p className="mt-3 text-sm text-emerald-100">{data.growthExpansion.executiveAction}</p>
                </div>

                <div className="mt-6 grid gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Upside concentrado</p>
                        <div className="mt-3 space-y-3">
                            {data.growthExpansion.topUpsideOpportunities.length > 0 ? data.growthExpansion.topUpsideOpportunities.map((op) => (
                                <div key={`${op.company}-${op.estimatedValue}`} className="rounded-2xl border border-white/8 bg-black/10 p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="font-medium text-white">{op.company}</p>
                                            <p className="mt-2 text-sm text-slate-300">{op.recommendedAction}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold text-emerald-200">{op.estimatedValue}</p>
                                            <p className="mt-1 text-xs text-slate-400">{Math.round(op.probability * 100)}% probabilidade</p>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-6 text-sm text-slate-400">
                                    Sem oportunidades de upside mapeadas no curto prazo.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                    {data.growthExpansion.expansionSignals.map((signal) => (
                        <article key={signal.id} className={`rounded-[24px] border p-4 ${toneClasses(signal.tone)}`}>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">{signal.label}</p>
                            <p className="mt-3 text-sm leading-6 opacity-90">{signal.detail}</p>
                        </article>
                    ))}
                </div>
            </section>
 
            <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-[34px] border border-white/8 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Narrativa de decisao</p>
                            <h3 className="mt-2 text-2xl font-semibold tracking-tight">Onde esta o risco e onde esta a oportunidade</h3>
                        </div>
                        <Gauge className="h-6 w-6 text-amber-300" />
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <article className="rounded-[28px] border border-rose-400/15 bg-rose-400/10 p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-100">Principal risco</p>
                            <p className="mt-3 text-sm leading-6 text-rose-50">{data.decisionNarrative.biggestRisk}</p>
                        </article>
                        <article className="rounded-[28px] border border-emerald-400/15 bg-emerald-400/10 p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">Principal oportunidade</p>
                            <p className="mt-3 text-sm leading-6 text-emerald-50">{data.decisionNarrative.biggestOpportunity}</p>
                        </article>
                    </div>

                    <div className="mt-6 rounded-[28px] border border-white/8 bg-black/10 p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Foco recomendado agora</p>
                        <div className="mt-4 grid gap-3">
                            {data.decisionNarrative.focusNow.map((item, index) => (
                                <div key={`${item}-${index}`} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid gap-4">
                    {[
                        {
                            title: "Revenue intelligence",
                            detail: "Leitura de oportunidade imediata de receita com base no pipeline real.",
                            icon: TrendingUp,
                            value: data.headlineMetrics.find((item) => item.id === "revenue-opportunity")?.value ?? "R$ 0",
                        },
                        {
                            title: "CEO Pulse",
                            detail: "Risco, perda, retomada e crescimento com foco de intervencao.",
                            icon: Siren,
                            value: String(data.prioritizedAlerts.length),
                        },
                        {
                            title: "Operating rhythm",
                            detail: "Sinais de operacao que sustentam a decisao executiva.",
                            icon: Gauge,
                            value: data.summaryCards.find((item) => item.id === "reply-time")?.value ?? "n/a",
                        },
                    ].map((item) => {
                        const Icon = item.icon;
                        return (
                            <article key={item.title} className="rounded-[30px] border border-white/8 bg-white/[0.04] p-6">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                                        <Icon className="h-5 w-5 text-amber-200" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.title}</p>
                                        <p className="mt-1 text-2xl font-semibold tracking-tight text-white">{item.value}</p>
                                    </div>
                                </div>
                                <p className="mt-4 text-sm leading-6 text-slate-300">{item.detail}</p>
                            </article>
                        );
                    })}
                </div>
            </section>

            <section className="rounded-[34px] border border-white/8 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Tendencia curta</p>
                        <h3 className="mt-2 text-2xl font-semibold tracking-tight">O que mudou no curtissimo prazo</h3>
                    </div>
                    <TrendingUp className="h-6 w-6 text-emerald-300" />
                </div>

                {data.trendComparison.items.length > 0 ? (
                    <div className="mt-6 grid gap-4 xl:grid-cols-4">
                        {data.trendComparison.items.map((item) => (
                            <article key={item.id} className={`rounded-[28px] border p-5 ${toneClasses(item.tone)}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">{item.label}</p>
                                        <p className="mt-3 text-3xl font-semibold tracking-tight">{item.current}</p>
                                    </div>
                                    {comparisonIcon(item)}
                                </div>
                                <p className="mt-3 text-xs opacity-80">{data.trendComparison.currentLabel}</p>
                                <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 px-3 py-3">
                                    <p className="text-[11px] uppercase tracking-[0.18em] opacity-70">{data.trendComparison.previousLabel}</p>
                                    <p className="mt-2 text-sm font-medium">{item.previous}</p>
                                    <p className="mt-2 text-sm">{item.delta}</p>
                                </div>
                                <p className="mt-4 text-sm leading-6 opacity-90">{item.insight}</p>
                            </article>
                        ))}
                    </div>
                ) : (
                    <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-8 text-sm text-slate-400">
                        Ainda nao ha dados suficientes para uma leitura de tendencia curta.
                    </div>
                )}
            </section>

            <section className="rounded-[34px] border border-white/8 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Comparativo temporal</p>
                        <h3 className="mt-2 text-2xl font-semibold tracking-tight">O que melhorou e o que piorou</h3>
                    </div>
                    <TrendingUp className="h-6 w-6 text-cyan-200" />
                </div>

                <div className="mt-6 grid gap-4 xl:grid-cols-5">
                    {data.periodComparison.items.map((item) => (
                        <article key={item.id} className={`rounded-[28px] border p-5 ${toneClasses(item.tone)}`}>
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">{item.label}</p>
                                    <p className="mt-3 text-3xl font-semibold tracking-tight">{item.current}</p>
                                </div>
                                {comparisonIcon(item)}
                            </div>
                            <p className="mt-3 text-xs opacity-80">{data.periodComparison.currentLabel}</p>
                            <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 px-3 py-3">
                                <p className="text-[11px] uppercase tracking-[0.18em] opacity-70">{data.periodComparison.previousLabel}</p>
                                <p className="mt-2 text-sm font-medium">{item.previous}</p>
                                <p className="mt-2 text-sm">{item.delta}</p>
                            </div>
                            <p className="mt-4 text-sm leading-6 opacity-90">{item.insight}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section id="pipeline" className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-[34px] border border-white/8 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Pipeline e conversao</p>
                            <h3 className="mt-2 text-2xl font-semibold tracking-tight">O que esta mais perto de virar receita</h3>
                        </div>
                        <BriefcaseBusiness className="h-6 w-6 text-emerald-300" />
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                        <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Deals abertos</p>
                            <p className="mt-3 text-3xl font-semibold">{data.pipeline.openDeals}</p>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Propostas ativas</p>
                            <p className="mt-3 text-3xl font-semibold">{data.pipeline.activeProposals}</p>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Atividades recentes</p>
                            <p className="mt-3 text-3xl font-semibold">{data.pipeline.recentActivities}</p>
                        </div>
                    </div>

                    <div className="mt-6 space-y-3">
                        {data.revenueBrain.highProbabilityDeals.length > 0 ? (
                            data.revenueBrain.highProbabilityDeals.slice(0, 4).map((deal) => (
                                <div key={deal.id} className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/10 px-4 py-4">
                                    <div>
                                        <p className="font-medium text-white">{deal.email}</p>
                                        <p className="mt-1 text-sm text-slate-400">
                                            Probabilidade {Math.round(deal.probability * 100)}%
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold text-emerald-200">
                                            {new Intl.NumberFormat("pt-BR", {
                                                style: "currency",
                                                currency: "BRL",
                                                maximumFractionDigits: 0,
                                            }).format(deal.value / 100)}
                                        </p>
                                        <div className="mt-1 inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                                            Hot
                                            <ArrowUpRight className="h-3.5 w-3.5" />
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-8 text-sm text-slate-400">
                                Ainda nao ha deals quentes suficientes para uma shortlist executiva confiavel.
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-[34px] border border-white/8 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Saude operacional</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight">Ritmo da maquina</h3>

                    <div className="mt-6 space-y-4">
                        <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-300">Show rate</span>
                                <span className="font-semibold text-white">{data.summaryCards.find((item) => item.id === "show-rate")?.value}</span>
                            </div>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-300">Tempo de resposta</span>
                                <span className="font-semibold text-white">{data.summaryCards.find((item) => item.id === "reply-time")?.value}</span>
                            </div>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-300">Fila operacional</span>
                                <span className="font-semibold text-white">{data.operations.pendingActions}</span>
                            </div>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-300">Warnings</span>
                                <span className="font-semibold text-white">{data.warnings.length}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="alerts" className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <ExecutivePulsePanel orgSlug={data.org.slug} alerts={data.prioritizedAlerts} />

                <div className="rounded-[34px] border border-white/8 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Gargalos e vazamentos</p>
                            <h3 className="mt-2 text-2xl font-semibold tracking-tight">Onde a empresa esta perdendo dinheiro</h3>
                        </div>
                        <TrendingDown className="h-6 w-6 text-rose-300" />
                    </div>

                    <div className="mt-6 space-y-3">
                        {data.leakDetector.leakItems.length > 0 ? data.leakDetector.leakItems.slice(0, 4).map((leak, index) => (
                            <article key={`${leak.label}-${index}`} className="rounded-2xl border border-white/8 bg-black/10 p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="font-medium text-white">{leak.label}</p>
                                        <p className="mt-2 text-sm leading-6 text-slate-300">{leak.description}</p>
                                    </div>
                                    <div className="rounded-xl border border-rose-400/15 bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-100">
                                        {leak.value}
                                    </div>
                                </div>
                            </article>
                        )) : (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-8 text-sm text-slate-400">
                                Nenhum gargalo de perda estimada relevante foi identificado agora.
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section id="actions" className="rounded-[34px] border border-white/8 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Proximos focos</p>
                        <h3 className="mt-2 text-2xl font-semibold tracking-tight">O que a lideranca deve destravar agora</h3>
                    </div>
                    <AlertTriangle className="h-6 w-6 text-cyan-200" />
                </div>

                <div className="mt-6 grid gap-4 xl:grid-cols-3">
                    {data.actionEngine.actions.length > 0 ? data.actionEngine.actions.slice(0, 6).map((action, index) => (
                        <article key={`${action.label}-${index}`} className="rounded-[28px] border border-white/8 bg-black/10 p-5">
                            <div className="inline-flex items-center rounded-full border border-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                                {action.priority}
                            </div>
                            <h4 className="mt-4 text-lg font-semibold tracking-tight text-white">{action.label}</h4>
                            <p className="mt-3 text-sm font-medium text-cyan-100">{action.impact}</p>
                            <p className="mt-3 text-sm leading-6 text-slate-300">{action.description}</p>
                        </article>
                    )) : (
                        <div className="xl:col-span-3 rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-8 text-sm text-slate-400">
                            Sem prioridades executivas suficientes no momento. O painel continuara atualizando conforme o backend operacional gerar sinais reais.
                        </div>
                    )}
                </div>

                {data.warnings.length > 0 ? (
                    <div className="mt-6 grid gap-3">
                        {data.warnings.map((warning, index) => (
                            <div key={`${warning}-${index}`} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                                {warning}
                            </div>
                        ))}
                    </div>
                ) : null}
            </section>
        </div>
    );
}
