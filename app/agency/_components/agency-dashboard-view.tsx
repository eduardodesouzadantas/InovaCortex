"use client";

import { useState } from "react";
import Link from "next/link";
import {
    Activity,
    ArrowRight,
    Bot,
    BriefcaseBusiness,
    Building2,
    CalendarClock,
    ShieldCheck,
    Sparkles,
    TrendingUp,
    Target,
    Zap,
    LifeBuoy,
    BookOpen,
} from "lucide-react";

import { AgencyPlaybookStatusActions } from "@/app/agency/_components/agency-playbook-status-actions";
import type { AgencySurfaceModel, AgencySuccessPlaybook, AgencySuccessPlaybookStatus } from "@/lib/agency/surface-overview";

function toneClasses(tone: "neutral" | "positive" | "warning" | "critical"): string {
    switch (tone) {
        case "positive":
            return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
        case "warning":
            return "border-amber-400/20 bg-amber-400/10 text-amber-100";
        case "critical":
            return "border-rose-400/20 bg-rose-400/10 text-rose-100";
        default:
            return "border-cyan-400/20 bg-cyan-400/10 text-cyan-100";
    }
}

function formatDateTime(value: string | undefined): string {
    if (!value) return "-";
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function translateStatus(status: AgencySuccessPlaybookStatus): string {
    switch (status) {
        case "suggested":
            return "Sugerido";
        case "in-progress":
            return "Em andamento";
        case "blocked":
            return "Bloqueado";
        case "completed":
            return "Concluído";
        default:
            return "Sugerido";
    }
}

export function applyPlaybookUpdate(
    existing: AgencySuccessPlaybook[],
    updated: AgencySuccessPlaybook,
): AgencySuccessPlaybook[] {
    return existing.map((playbook) => (playbook.id === updated.id ? { ...playbook, ...updated } : playbook));
}

export function AgencyDashboardView({
    data,
}: {
    data: AgencySurfaceModel;
}) {
    const [successPlaybooks, setSuccessPlaybooks] = useState<AgencySuccessPlaybook[]>(data.successPlaybooks);
    const [playbookTimeline, setPlaybookTimeline] = useState(data.playbookTimeline || []);

    function handlePlaybookUpdate(updated: AgencySuccessPlaybook) {
        setSuccessPlaybooks((prev) => applyPlaybookUpdate(prev, updated));
        setPlaybookTimeline((prev) => {
            const existingIndex = prev.findIndex((item) => item.playbookId === updated.id);
            const updatedEntry = {
                playbookId: updated.id,
                tenantName: updated.tenantName,
                playbookName: updated.playbookName,
                status: updated.status,
                owner: updated.owner,
                createdAt: updated.createdAt,
                startedAt: updated.startedAt,
                completedAt: updated.completedAt,
                observedImpact: updated.observedImpact ?? null,
                updatedAt: updated.completedAt ?? updated.startedAt ?? updated.createdAt,
            };

            if (existingIndex >= 0) {
                const next = [...prev];
                next[existingIndex] = updatedEntry;
                return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
            }

            return [updatedEntry, ...prev].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
        });
    }

    return (
        <section className="space-y-8">
            <div className="rounded-[32px] border border-white/8 bg-[linear-gradient(135deg,rgba(34,211,238,0.10),rgba(10,22,36,0.95))] p-8 shadow-[0_30px_120px_rgba(0,0,0,0.28)]">
                <div className="max-w-5xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
                        <Building2 className="h-3.5 w-3.5" />
                        Agency Surface v2
                    </div>
                    <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-5xl">
                        {data.overview.headline}
                    </h1>
                    <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-300 md:text-base">
                        {data.overview.subheadline}
                    </p>

                    <div className={`mt-6 rounded-[28px] border p-5 ${toneClasses(data.overview.commandTone)}`}>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">Command center</p>
                        <p className="mt-3 text-lg font-semibold tracking-tight">{data.overview.commandSummary}</p>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {data.overview.focusNow.map((item, index) => (
                                <div key={`${item}-${index}`} className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm opacity-90">
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
                <section className="rounded-[30px] border border-white/8 bg-[#0a1624] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Platform Control</p>
                            <h2 className="text-2xl font-semibold tracking-tight">{data.controlPlane.title}</h2>
                        </div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-300">{data.controlPlane.description}</p>

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                        {data.controlPlane.metrics.map((metric) => (
                            <article key={metric.id} className={`rounded-[26px] border p-5 ${toneClasses(metric.tone)}`}>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">{metric.label}</p>
                                <p className="mt-3 text-3xl font-semibold tracking-tight">{metric.value}</p>
                                <p className="mt-2 text-sm leading-6 opacity-85">{metric.detail}</p>
                            </article>
                        ))}
                    </div>

                    <div className="mt-6 rounded-[28px] border border-white/8 bg-black/10 p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Onde olhar agora</p>
                        <p className="mt-3 text-sm leading-6 text-slate-200">{data.controlPlane.focus}</p>
                    </div>

                    <div className="mt-6 grid gap-3">
                        {data.controlPlane.items.map((item) => (
                            <Link
                                key={item.id}
                                href={item.href}
                                className={`rounded-2xl border p-4 transition hover:border-white/16 hover:bg-white/[0.04] ${toneClasses(item.tone)}`}
                            >
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">{item.eyebrow}</p>
                                <div className="mt-2 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold">{item.title}</p>
                                        <p className="mt-1 text-sm leading-6 opacity-85">{item.detail}</p>
                                    </div>
                                    <ArrowRight className="h-4 w-4 shrink-0 opacity-70" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>

                <section className="rounded-[30px] border border-white/8 bg-[#0a1624] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-emerald-200">
                            <BriefcaseBusiness className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Agency Operating System</p>
                            <h2 className="text-2xl font-semibold tracking-tight">{data.agencyOps.title}</h2>
                        </div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-300">{data.agencyOps.description}</p>

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                        {data.agencyOps.metrics.map((metric) => (
                            <article key={metric.id} className={`rounded-[26px] border p-5 ${toneClasses(metric.tone)}`}>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">{metric.label}</p>
                                <p className="mt-3 text-3xl font-semibold tracking-tight">{metric.value}</p>
                                <p className="mt-2 text-sm leading-6 opacity-85">{metric.detail}</p>
                            </article>
                        ))}
                    </div>

                    <div className="mt-6 rounded-[28px] border border-white/8 bg-black/10 p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Foco operacional</p>
                        <p className="mt-3 text-sm leading-6 text-slate-200">{data.agencyOps.focus}</p>
                    </div>

                    <div className="mt-6 grid gap-3">
                        {data.agencyOps.items.length > 0 ? data.agencyOps.items.map((item) => (
                            <Link
                                key={item.id}
                                href={item.href}
                                className={`rounded-2xl border p-4 transition hover:border-white/16 hover:bg-white/[0.04] ${toneClasses(item.tone)}`}
                            >
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">{item.eyebrow}</p>
                                <div className="mt-2 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold">{item.title}</p>
                                        <p className="mt-1 text-sm leading-6 opacity-85">{item.detail}</p>
                                    </div>
                                    <ArrowRight className="h-4 w-4 shrink-0 opacity-70" />
                                </div>
                            </Link>
                        )) : (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-8 text-sm text-slate-400">
                                A operacao propria da agencia ainda nao gerou agenda, follow-ups ou fila de growth suficientes para leitura mais densa.
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
                <section className="rounded-[30px] border border-white/8 bg-[#0a1624] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-cyan-200">
                                <Activity className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Proof of Value</p>
                                <h2 className="text-2xl font-semibold tracking-tight">Impacto consolidado gerado</h2>
                            </div>
                        </div>
                        <TrendingUp className="h-6 w-6 text-emerald-400" />
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-300">{data.proofOfValue.headline}</p>

                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                        {data.proofOfValue.impactMetrics.map((metric) => (
                            <article key={metric.id} className={`rounded-[26px] border p-5 ${toneClasses(metric.tone)}`}>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-75">{metric.label}</p>
                                <p className="mt-2 text-2xl font-semibold tracking-tight">{metric.value}</p>
                                <p className="mt-1 text-xs leading-5 opacity-85">{metric.detail}</p>
                            </article>
                        ))}
                    </div>

                    <div className="mt-6 space-y-3">
                        {data.proofOfValue.insights.map((insight, idx) => (
                            <div key={idx} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-300">
                                {insight}
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-[30px] border border-white/8 bg-[#0a1624] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-amber-200">
                            <Target className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Agency Priority Queue</p>
                            <h2 className="text-2xl font-semibold tracking-tight">Onde atuar primeiro</h2>
                        </div>
                    </div>

                    <div className="mt-6 space-y-4">
                        {data.priorityQueue.length > 0 ? data.priorityQueue.map((item) => (
                            <div key={item.id} className={`rounded-[26px] border p-5 ${toneClasses(item.tone)}`}>
                                <div className="flex items-center justify-between">
                                    <p className="text-lg font-semibold">{item.name}</p>
                                    <Link href={`/agency/commercial/workspaces`} className="text-xs uppercase tracking-[0.18em] underline hover:opacity-80">
                                        Explorar
                                    </Link>
                                </div>
                                <p className="mt-1 text-sm font-medium text-white/90">{item.reason}</p>
                                <div className="mt-4 grid gap-2">
                                    <p className="text-xs opacity-75">
                                        <span className="font-semibold uppercase">Impacto:</span> {item.impact}
                                    </p>
                                    <p className="text-xs text-cyan-100 italic">
                                        <span className="font-semibold uppercase not-italic">Acao:</span> {item.suggestedAction}
                                    </p>
                                </div>
                            </div>
                        )) : (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-8 text-sm text-slate-400 text-center">
                                Nenhum tenant exigindo priorizacao imediata.
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
                <section className="rounded-[30px] border border-white/8 bg-[#0a1624] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-3 text-rose-200">
                            <LifeBuoy className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Retention Signals</p>
                            <h2 className="text-2xl font-semibold tracking-tight">Risco de Churn / Estagnacao</h2>
                        </div>
                    </div>

                    <div className="mt-6 space-y-4">
                        {data.retentionSignals.length > 0 ? data.retentionSignals.map((signal) => (
                            <div key={signal.id} className={`rounded-[26px] border p-5 ${toneClasses(signal.tone)}`}>
                                <div className="flex items-center justify-between">
                                    <p className="text-lg font-semibold">{signal.tenantName}</p>
                                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Retention</span>
                                </div>
                                <p className="mt-2 text-sm font-medium text-white/90">{signal.label}</p>
                                <p className="mt-1 text-xs opacity-80 leading-relaxed">{signal.detail}</p>
                                <div className="mt-4 flex items-center justify-between gap-3">
                                    <p className="text-xs font-semibold text-rose-100 uppercase tracking-tighter italic">
                                        <span className="not-italic opacity-70">Acao:</span> {signal.suggestedAction}
                                    </p>
                                    <Link href={`/agency/workspaces/${signal.slug}`} className="text-[10px] uppercase font-bold tracking-widest text-white/40 hover:text-white transition">
                                        Monitorar
                                    </Link>
                                </div>
                            </div>
                        )) : (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-12 text-center text-sm text-slate-400">
                                Nenhum sinal critico de retencao no momento.
                            </div>
                        )}
                    </div>
                </section>

                <section className="rounded-[30px] border border-white/8 bg-[#0a1624] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-emerald-200">
                            <Zap className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Expansion signals</p>
                            <h2 className="text-2xl font-semibold tracking-tight">Oportunidades de Upsell</h2>
                        </div>
                    </div>

                    <div className="mt-6 space-y-4">
                        {data.expansionSignals.length > 0 ? data.expansionSignals.map((signal) => (
                            <div key={signal.id} className={`rounded-[26px] border p-5 ${toneClasses(signal.tone)}`}>
                                <div className="flex items-center justify-between">
                                    <p className="text-lg font-semibold">{signal.tenantName}</p>
                                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Expansion</span>
                                </div>
                                <p className="mt-2 text-sm font-medium text-white/90">{signal.label}</p>
                                <p className="mt-1 text-xs opacity-80 leading-relaxed">{signal.detail}</p>
                                <div className="mt-4 flex items-center justify-between gap-3">
                                    <p className="text-xs font-semibold text-emerald-100 uppercase tracking-tighter italic">
                                        <span className="not-italic opacity-70">Acao:</span> {signal.suggestedAction}
                                    </p>
                                    <Link href={`/agency/workspaces/${signal.slug}`} className="text-[10px] uppercase font-bold tracking-widest text-white/40 hover:text-white transition">
                                        Propor
                                    </Link>
                                </div>
                            </div>
                        )) : (
                            <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-12 text-center text-sm text-slate-400">
                                Sem oportunidades de expansao imediatas detectadas.
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <section className="rounded-[30px] border border-white/8 bg-[#0a1624] p-6 shadow-xl">
                <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
                        <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Success Playbooks</p>
                        <h2 className="text-2xl font-semibold tracking-tight">Execucao Operacional da Agencia</h2>
                    </div>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    {successPlaybooks.length > 0 ? successPlaybooks.map((playbook) => (
                        <div key={playbook.id} className="rounded-[28px] border border-white/8 bg-white/[0.03] p-6 transition hover:bg-white/[0.05]">
                            <div className="flex items-center justify-between gap-4">
                                <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${toneClasses(playbook.tone)}`}>
                                    {playbook.playbookName}
                                </span>
                                <p className="text-sm font-semibold text-slate-400">{playbook.tenantName}</p>
                            </div>
                            <div className="mt-4">
                                <h3 className="text-lg font-semibold text-white">{playbook.reason}</h3>
                                <div className="mt-3 flex items-center justify-between gap-3">
                                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${toneClasses(playbook.status === "suggested" ? "neutral" : playbook.status === "in-progress" ? "warning" : playbook.status === "blocked" ? "critical" : "positive")}`}>
                                        {translateStatus(playbook.status)}
                                    </span>
                                    <p className="text-[11px] text-slate-400">{playbook.owner ? `Responsável: ${playbook.owner}` : "Responsável: não definido"}</p>
                                </div>
                                <div className="mt-2 text-[11px] text-slate-500 space-y-1">
                                    <p>Criado: {formatDateTime(playbook.createdAt)}</p>
                                    {playbook.startedAt && <p>Iniciado: {formatDateTime(playbook.startedAt)}</p>}
                                    {playbook.completedAt && <p>Concluído: {formatDateTime(playbook.completedAt)}</p>}
                                    {playbook.observedImpact && <p>Resultado observado: {playbook.observedImpact}</p>}
                                </div>
                                <div className="mt-4 space-y-2">
                                    <p className="text-sm text-slate-300 leading-relaxed">
                                        <span className="font-bold text-cyan-200 uppercase text-[10px] tracking-widest block mb-1">Acao Sugerida</span>
                                        {playbook.suggestedAction}
                                    </p>
                                    <div className="flex items-center gap-2 border-t border-white/5 pt-4">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                        <p className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Impacto: {playbook.expectedImpact}</p>
                                    </div>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <AgencyPlaybookStatusActions playbook={playbook} onSuccess={handlePlaybookUpdate} />
                                    <Link href={`/agency/workspaces/${playbook.slug}`} className="rounded-full border border-emerald-500/30 px-2 py-1 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/20">
                                        Abrir tenant
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="lg:col-span-2 rounded-[28px] border border-dashed border-white/10 bg-black/10 px-4 py-12 text-center text-sm text-slate-400">
                            Fila de playbooks vazia. Sinais insuficientes para orquestracao automatica.
                        </div>
                    )}
                </div>
            </section>

            <section className="rounded-[30px] border border-white/8 bg-[#0a1624] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
                        <CalendarClock className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Agency Timeline & Impact Log</p>
                        <h2 className="text-2xl font-semibold tracking-tight">Execuções recentes de playbooks</h2>
                    </div>
                </div>

                {playbookTimeline.length > 0 ? (
                    <div className="mt-4 space-y-3">
                        {playbookTimeline.map((entry) => (
                            <article key={`${entry.playbookId}-${entry.updatedAt}`} className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{entry.tenantName} • {entry.playbookName}</p>
                                        <p className="text-sm font-semibold text-white">{translateStatus(entry.status)}</p>
                                    </div>
                                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${toneClasses(entry.status === "suggested" ? "neutral" : entry.status === "in-progress" ? "warning" : entry.status === "blocked" ? "critical" : "positive")}`}>
                                        {translateStatus(entry.status)}
                                    </span>
                                </div>
                                <div className="mt-2 text-[11px] text-slate-400 space-y-1">
                                    <p>Responsável: {entry.owner ?? "não definido"}</p>
                                    <p>Ultima atualizacao: {formatDateTime(entry.updatedAt)}</p>
                                    <p>Status atual: {entry.status}</p>
                                    {entry.observedImpact ? <p>Impacto observado: {entry.observedImpact}</p> : <p className="opacity-70">Impacto observado: não registrado</p>}
                                </div>
                            </article>
                        ))}
                    </div>
                ) : (
                    <div className="mt-4 rounded-[20px] border border-dashed border-white/10 bg-black/10 px-4 py-5 text-sm text-slate-400">
                        Nenhuma execução recente encontrada.
                    </div>
                )}
            </section>

            <div className="rounded-[30px] border border-white/8 bg-black/20 p-6">
                <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-cyan-300" />
                    <h3 className="text-xl font-semibold">Aggregated Benchmarks</h3>
                </div>
                <div className="mt-6 grid gap-6 md:grid-cols-2">
                    {data.benchmarks.map((bench, idx) => (
                        <div key={idx} className="rounded-[28px] border border-white/8 bg-white/[0.04] p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{bench.label}</p>
                            <div className="mt-4 flex items-baseline gap-4">
                                <div>
                                    <p className="text-xs text-slate-500 uppercase">Media</p>
                                    <p className="text-3xl font-semibold text-white">{bench.avgValue}</p>
                                </div>
                                <div className="h-8 w-px bg-white/10" />
                                <div>
                                    <p className="text-xs text-slate-500 uppercase">Topo</p>
                                    <p className="text-3xl font-semibold text-cyan-300">{bench.topValue}</p>
                                </div>
                            </div>
                            <p className="mt-4 text-xs italic text-slate-400 leading-relaxed">{bench.insight}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <section className="rounded-[30px] border border-white/8 bg-[#0a1624] p-6">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-cyan-200">
                            <Activity className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Dualidade materializada</p>
                            <h3 className="text-2xl font-semibold tracking-tight">Agency nao e admin premium</h3>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                        <article className="rounded-[26px] border border-white/8 bg-black/10 p-5">
                            <div className="flex items-center gap-3">
                                <Bot className="h-4 w-4 text-cyan-200" />
                                <p className="text-sm font-semibold text-white">Control plane</p>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-300">
                                Monitoring, command center, executive intelligence e rollout continuam no mesmo namespace e sustentam governanca da plataforma.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <Link href="/agency/command-center" className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/[0.04]">
                                    Command Center
                                </Link>
                                <Link href="/agency/monitoring" className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/[0.04]">
                                    Monitoring
                                </Link>
                                <Link href="/agency/executive" className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/[0.04]">
                                    Executive
                                </Link>
                            </div>
                        </article>

                        <article className="rounded-[26px] border border-white/8 bg-black/10 p-5">
                            <div className="flex items-center gap-3">
                                <CalendarClock className="h-4 w-4 text-emerald-200" />
                                <p className="text-sm font-semibold text-white">Operating system</p>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-300">
                                Leads, inbox, conteudo, builder e delivery seguem dentro da mesma surface para operar a propria agencia sem abrir uma arquitetura paralela.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <Link href="/agency/commercial/leads" className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/[0.04]">
                                    Commercial CRM
                                </Link>
                                <Link href="/agency/whatsapp" className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/[0.04]">
                                    Agency Inbox
                                </Link>
                                <Link href="/agency/content" className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/[0.04]">
                                    Content Engine
                                </Link>
                            </div>
                        </article>
                    </div>
                </section>

                <section className="rounded-[30px] border border-white/8 bg-[#0a1624] p-6">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-amber-200">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Leitura honesta</p>
                            <h3 className="text-2xl font-semibold tracking-tight">Sinais e limites</h3>
                        </div>
                    </div>

                    {data.warnings.length > 0 ? (
                        <div className="mt-6 grid gap-3">
                            {data.warnings.map((warning, index) => (
                                <div key={`${warning}-${index}`} className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 text-sm leading-6 text-slate-300">
                                    {warning}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-6 rounded-2xl border border-white/8 bg-black/10 px-4 py-8 text-sm leading-6 text-slate-300">
                            A Agency Surface ja tem sinais reais suficientes para sustentar a leitura dual entre plataforma e operacao propria.
                        </div>
                    )}
                </section>
            </div>
        </section>
    );
}
