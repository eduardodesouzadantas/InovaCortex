import Link from "next/link";
import {
    ArrowRight,
    CalendarClock,
    CheckSquare,
    MessageSquareText,
    Sparkles,
    Zap,
    TrendingDown,
    Target,
    Video,
    Handshake,
    ShieldAlert,
} from "lucide-react";

import type { OperatorSurfaceModel } from "@/lib/operator/surface-overview";

function toneClasses(tone: "neutral" | "positive" | "warning" | "critical"): string {
    switch (tone) {
        case "positive":
            return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
        case "warning":
            return "border-amber-400/20 bg-amber-400/10 text-amber-100";
        case "critical":
            return "border-rose-400/20 bg-rose-400/10 text-rose-100";
        default:
            return "border-white/10 bg-white/[0.03] text-slate-100";
    }
}

export function OperatorDashboardView({
    data,
    slug,
    showExecutiveBridge,
}: {
    data: OperatorSurfaceModel;
    slug: string;
    showExecutiveBridge: boolean;
}) {
    return (
        <div className="space-y-8">
            <section className="rounded-[32px] border border-white/8 bg-[linear-gradient(135deg,rgba(16,185,129,0.10),rgba(7,16,28,0.94))] p-8 shadow-[0_30px_120px_rgba(0,0,0,0.28)]">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-4xl">
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100">
                            <CheckSquare className="h-3.5 w-3.5" />
                            Tenant Operator Surface v3
                        </div>
                        <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-5xl">{data.overview.headline}</h1>
                        <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-300 md:text-base">
                            {data.overview.subheadline}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Link
                            href={`/org/${slug}/admin/whatsapp`}
                            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]"
                        >
                            Abrir WhatsApp CRM
                        </Link>
                        <Link
                            href={`/org/${slug}/admin/webhooks`}
                            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]"
                        >
                            Webhooks
                        </Link>
                        <Link
                            href={`/org/${slug}/admin/workspaces`}
                            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]"
                        >
                            Abrir fila de execucao
                        </Link>
                        {showExecutiveBridge ? (
                            <Link
                                href={`/org/${slug}/executive`}
                                className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-100 transition hover:bg-amber-400/15"
                            >
                                Ir para CEO Surface
                            </Link>
                        ) : null}
                    </div>
                </div>

                <div className={`mt-6 rounded-[28px] border p-5 ${toneClasses(data.overview.tone)}`}>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">Operacao agora</p>
                    <p className="mt-3 text-lg font-semibold tracking-tight">{data.overview.summary}</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {data.overview.focusNow.map((item, index) => (
                            <div key={`${item}-${index}`} className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm opacity-90">
                                {item}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
                <div className="rounded-[30px] border border-white/8 bg-[#07101c] p-6">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-emerald-200">
                            <CalendarClock className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Resumo operacional</p>
                            <h2 className="text-2xl font-semibold tracking-tight text-white">{data.operationalDay.title}</h2>
                        </div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-300">{data.operationalDay.description}</p>

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                        {data.operationalDay.metrics.map((metric) => (
                            <article key={metric.id} className={`rounded-[26px] border p-5 ${toneClasses(metric.tone)}`}>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">{metric.label}</p>
                                <p className="mt-3 text-3xl font-semibold tracking-tight">{metric.value}</p>
                                <p className="mt-2 text-sm leading-6 opacity-85">{metric.detail}</p>
                            </article>
                        ))}
                    </div>

                    <div className="mt-6 rounded-[28px] border border-white/8 bg-black/10 p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Foco recomendado</p>
                        <p className="mt-3 text-sm leading-6 text-slate-200">{data.operationalDay.focus}</p>
                    </div>

                    <div id="agenda" className="mt-6 grid gap-3">
                        {data.operationalDay.items.length > 0 ? data.operationalDay.items.map((item) => (
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
                                Ainda nao ha agenda ou atraso operacional suficiente para ocupar o radar imediato.
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <section id="meetings" className="rounded-[30px] border border-white/8 bg-[#07101c] p-6">
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl border border-indigo-400/20 bg-indigo-400/10 p-3 text-indigo-400">
                                <Video className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Agenda queue</p>
                                <h2 className="text-2xl font-semibold tracking-tight text-white">{data.agenda.title}</h2>
                            </div>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-slate-300">{data.agenda.description}</p>

                        <div className="mt-6 grid gap-4 md:grid-cols-3">
                            {data.agenda.metrics.map((metric) => (
                                <article key={metric.id} className={`rounded-[24px] border p-4 ${toneClasses(metric.tone)}`}>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">{metric.label}</p>
                                    <p className="mt-3 text-2xl font-semibold tracking-tight">{metric.value}</p>
                                    <p className="mt-2 text-sm leading-6 opacity-85">{metric.detail}</p>
                                </article>
                            ))}
                        </div>

                        <div className="mt-6 rounded-[28px] border border-white/8 bg-black/10 p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Foco em reunioes</p>
                            <p className="mt-3 text-sm leading-6 text-slate-200">{data.agenda.focus}</p>
                        </div>

                        <div className="mt-6 grid gap-3">
                            {data.agenda.items.length > 0 ? data.agenda.items.map((item) => (
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
                                    Nenhuma agenda imediata para preparar ou realizar follow-up.
                                </div>
                            )}
                        </div>
                    </section>

                    <section id="close" className="rounded-[30px] border border-white/8 bg-[#07101c] p-6">
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-3 text-fuchsia-400">
                                <Handshake className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Sales & Close queue</p>
                                <h2 className="text-2xl font-semibold tracking-tight text-white">{data.close.title}</h2>
                            </div>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-slate-300">{data.close.description}</p>

                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            {data.close.metrics.map((metric) => (
                                <article key={metric.id} className={`rounded-[24px] border p-4 ${toneClasses(metric.tone)}`}>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">{metric.label}</p>
                                    <p className="mt-3 text-2xl font-semibold tracking-tight">{metric.value}</p>
                                    <p className="mt-2 text-sm leading-6 opacity-85">{metric.detail}</p>
                                </article>
                            ))}
                        </div>

                        <div className="mt-6 rounded-[28px] border border-white/8 bg-black/10 p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Foco em fechamento</p>
                            <p className="mt-3 text-sm leading-6 text-slate-200">{data.close.focus}</p>
                        </div>

                        <div className="mt-6 grid gap-3">
                            {data.close.items.length > 0 ? data.close.items.map((item) => (
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
                                    Nenhuma oportunidade em fase final pronta para acao no momento.
                                </div>
                            )}
                        </div>
                    </section>
 
                    <section id="loss" className="rounded-[30px] border border-white/8 bg-[#07101c] p-6">
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-3 text-rose-400">
                                <ShieldAlert className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Loss intelligence</p>
                                <h2 className="text-2xl font-semibold tracking-tight text-white">{data.loss.title}</h2>
                            </div>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-slate-300">{data.loss.description}</p>
 
                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            {data.loss.metrics.map((metric) => (
                                <article key={metric.id} className={`rounded-[24px] border p-4 ${toneClasses(metric.tone)}`}>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">{metric.label}</p>
                                    <p className="mt-3 text-2xl font-semibold tracking-tight">{metric.value}</p>
                                    <p className="mt-2 text-sm leading-6 opacity-85">{metric.detail}</p>
                                </article>
                            ))}
                        </div>
 
                        <div className="mt-6 rounded-[28px] border border-white/8 bg-black/10 p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Foco em recuperacao</p>
                            <p className="mt-3 text-sm leading-6 text-slate-200">{data.loss.focus}</p>
                        </div>
 
                        <div className="mt-6 grid gap-3">
                            {data.loss.items.length > 0 ? data.loss.items.map((item) => (
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
                                    Nenhuma perda recente registrada para analise ou recuperacao.
                                </div>
                            )}
                        </div>
                    </section>

                    <section id="revenue" className="rounded-[30px] border border-white/8 bg-[#07101c] p-6">
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-3 text-rose-200">
                                <TrendingDown className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Revenue queue</p>
                                <h2 className="text-2xl font-semibold tracking-tight text-white">{data.revenue.title}</h2>
                            </div>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-slate-300">{data.revenue.description}</p>

                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            {data.revenue.metrics.map((metric) => (
                                <article key={metric.id} className={`rounded-[24px] border p-4 ${toneClasses(metric.tone)}`}>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">{metric.label}</p>
                                    <p className="mt-3 text-2xl font-semibold tracking-tight">{metric.value}</p>
                                    <p className="mt-2 text-sm leading-6 opacity-85">{metric.detail}</p>
                                </article>
                            ))}
                        </div>

                        <div className="mt-6 rounded-[28px] border border-white/8 bg-black/10 p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Como proteger receita agora</p>
                            <p className="mt-3 text-sm leading-6 text-slate-200">{data.revenue.focus}</p>
                        </div>

                        <div className="mt-6 grid gap-3">
                            {data.revenue.items.length > 0 ? data.revenue.items.map((item) => (
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
                                    Sem risco material de receita mapeado para o dia.
                                </div>
                            )}
                        </div>
                    </section>

                    <section id="proposals" className="rounded-[30px] border border-white/8 bg-[#07101c] p-6">
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-3 text-blue-200">
                                <Target className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Proposal queue</p>
                                <h2 className="text-2xl font-semibold tracking-tight text-white">{data.proposals.title}</h2>
                            </div>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-slate-300">{data.proposals.description}</p>

                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            {data.proposals.metrics.map((metric) => (
                                <article key={metric.id} className={`rounded-[24px] border p-4 ${toneClasses(metric.tone)}`}>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">{metric.label}</p>
                                    <p className="mt-3 text-2xl font-semibold tracking-tight">{metric.value}</p>
                                    <p className="mt-2 text-sm leading-6 opacity-85">{metric.detail}</p>
                                </article>
                            ))}
                        </div>

                        <div className="mt-6 rounded-[28px] border border-white/8 bg-black/10 p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Tracao de propostas</p>
                            <p className="mt-3 text-sm leading-6 text-slate-200">{data.proposals.focus}</p>
                        </div>

                        <div className="mt-6 grid gap-3">
                            {data.proposals.items.length > 0 ? data.proposals.items.map((item) => (
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
                                    Nenhuma proposta paralisada no funil operacional no momento.
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="rounded-[30px] border border-white/8 bg-[#07101c] p-6">
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-amber-200">
                                <Zap className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Follow-ups prioritarios</p>
                                <h2 className="text-2xl font-semibold tracking-tight text-white">{data.followUps.title}</h2>
                            </div>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-slate-300">{data.followUps.description}</p>

                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            {data.followUps.metrics.map((metric) => (
                                <article key={metric.id} className={`rounded-[24px] border p-4 ${toneClasses(metric.tone)}`}>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">{metric.label}</p>
                                    <p className="mt-3 text-2xl font-semibold tracking-tight">{metric.value}</p>
                                    <p className="mt-2 text-sm leading-6 opacity-85">{metric.detail}</p>
                                </article>
                            ))}
                        </div>

                        <div className="mt-6 rounded-[28px] border border-white/8 bg-black/10 p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Onde atacar primeiro</p>
                            <p className="mt-3 text-sm leading-6 text-slate-200">{data.followUps.focus}</p>
                        </div>

                        <div className="mt-6 grid gap-3">
                            {data.followUps.items.length > 0 ? data.followUps.items.map((item) => (
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
                                    Sem follow-ups com calor suficiente para priorizacao extra agora.
                                </div>
                            )}
                        </div>
                    </section>

                    <section id="queue" className="rounded-[30px] border border-white/8 bg-[#07101c] p-6">
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-200">
                                <MessageSquareText className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Fila e pendencias</p>
                                <h2 className="text-2xl font-semibold tracking-tight text-white">{data.queue.title}</h2>
                            </div>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-slate-300">{data.queue.description}</p>

                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            {data.queue.metrics.map((metric) => (
                                <article key={metric.id} className={`rounded-[24px] border p-4 ${toneClasses(metric.tone)}`}>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">{metric.label}</p>
                                    <p className="mt-3 text-2xl font-semibold tracking-tight">{metric.value}</p>
                                    <p className="mt-2 text-sm leading-6 opacity-85">{metric.detail}</p>
                                </article>
                            ))}
                        </div>

                        <div className="mt-6 rounded-[28px] border border-white/8 bg-black/10 p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Proximo passo operacional</p>
                            <p className="mt-3 text-sm leading-6 text-slate-200">{data.queue.focus}</p>
                        </div>

                        <div className="mt-6 grid gap-3">
                            {data.queue.items.length > 0 ? data.queue.items.map((item) => (
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
                                    Sem fila operacional relevante alem da rotina normal do tenant.
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </section>

            {data.warnings.length > 0 ? (
                <section className="rounded-[30px] border border-white/8 bg-[#07101c] p-6">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-slate-200">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Leitura honesta</p>
                            <h2 className="text-2xl font-semibold tracking-tight text-white">Limites da operacao atual</h2>
                        </div>
                    </div>
                    <div className="mt-6 grid gap-3">
                        {data.warnings.map((warning, index) => (
                            <div key={`${warning}-${index}`} className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 text-sm leading-6 text-slate-300">
                                {warning}
                            </div>
                        ))}
                    </div>
                </section>
            ) : null}
        </div>
    );
}
