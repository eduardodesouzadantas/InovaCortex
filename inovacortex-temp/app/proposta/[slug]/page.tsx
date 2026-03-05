import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { BrainCircuit, CheckCircle2, Package, DollarSign, TrendingUp, Calendar, Clock } from "lucide-react";
import { PropostaActionButtons } from "./action-buttons";

export const runtime = "nodejs";

function formatBRL(n: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
}

const STATUS_CONFIG = {
    draft: { label: "Em elaboração", color: "text-gray-400" },
    sent: { label: "Enviada para análise", color: "text-blue-400" },
    viewed: { label: "Em análise", color: "text-yellow-400" },
    accepted: { label: "Aceita ✓", color: "text-green-500" },
    rejected: { label: "Aguardando ajuste", color: "text-orange-400" },
};

export default async function PropostaPublicaPage({
    params
}: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    const proposal = await (prisma as any).proposal.findUnique({
        where: { publicSlug: slug },
        include: { assessment: { select: { company: true, segment: true, scoreTotal: true, classification: true } } }
    });

    if (!proposal) notFound();

    const modules = JSON.parse(proposal.modules).filter((m: any) => m.included);
    const pricing = JSON.parse(proposal.pricingEstimate);
    const roi = JSON.parse(proposal.roiSnapshot);
    const presales = JSON.parse(proposal.presalesSnapshot);
    const statusCfg = STATUS_CONFIG[proposal.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft;
    const totalWeeks = modules.reduce((acc: number, m: any) => acc + m.estimatedWeeks, 0) + 1;

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Hero Header */}
            <header className="relative overflow-hidden bg-gradient-to-br from-indigo-900/30 via-background to-purple-900/20 border-b border-border/40 pt-24 pb-16">
                <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:48px_48px]" />
                <div className="max-w-4xl mx-auto px-6 relative z-10">
                    <div className="flex items-center gap-3 mb-8">
                        <BrainCircuit className="w-8 h-8 text-primary" />
                        <span className="font-bold text-xl tracking-tight">InovaCortex</span>
                        <span className="ml-auto text-sm font-medium px-3 py-1 rounded-full border border-border/50 text-muted-foreground">
                            Proposta Comercial
                        </span>
                    </div>

                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black mb-3 bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
                                Proposta para {proposal.assessment.company}
                            </h1>
                            <p className="text-muted-foreground text-lg">
                                Versão {proposal.version} · {proposal.assessment.segment} · Score {proposal.assessment.scoreTotal}/100
                            </p>
                        </div>
                        <div className="shrink-0">
                            <span className={`text-sm font-bold ${statusCfg.color}`}>● {statusCfg.label}</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-12 space-y-12">

                {/* Executive Summary */}
                {presales?.executiveSummary && (
                    <section className="glass-panel rounded-2xl border border-border/50 p-8">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-black text-sm">1</span>
                            Contexto Estratégico
                        </h2>
                        <p className="text-foreground/85 leading-relaxed">{presales.executiveSummary}</p>
                    </section>
                )}

                {/* ROI & Investment */}
                <section>
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-500 font-black text-sm">2</span>
                        Impacto & Investimento
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="glass-panel rounded-xl border border-green-500/20 bg-green-500/5 p-6">
                            <DollarSign className="w-6 h-6 text-green-500 mb-3" />
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Investimento</p>
                            <p className="text-xl font-black">{formatBRL(pricing.minBRL)} – {formatBRL(pricing.maxBRL)}</p>
                            <p className="text-xs text-muted-foreground mt-1">{pricing.basis}</p>
                        </div>
                        <div className="glass-panel rounded-xl border border-blue-400/20 bg-blue-400/5 p-6">
                            <TrendingUp className="w-6 h-6 text-blue-400 mb-3" />
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Benefício Mensal</p>
                            <p className="text-xl font-black">{formatBRL(roi.operationalSavings + roi.revenueIncrease)}</p>
                            <p className="text-xs text-muted-foreground mt-1">Economia + Receita incremental</p>
                        </div>
                        <div className="glass-panel rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6">
                            <Clock className="w-6 h-6 text-yellow-500 mb-3" />
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Payback</p>
                            <p className="text-xl font-black">{roi.paybackMonths} meses</p>
                            <p className="text-xs text-muted-foreground mt-1">Confiança: {roi.confidenceLevel}</p>
                        </div>
                    </div>
                </section>

                {/* Modules */}
                <section>
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 font-black text-sm">3</span>
                        Escopo Modular ({modules.length} módulos)
                    </h2>
                    <div className="space-y-4">
                        {modules.map((mod: any, i: number) => (
                            <div key={mod.id} className="glass-panel rounded-xl border border-border/50 p-6">
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-black bg-primary/15 text-primary w-7 h-7 rounded-lg flex items-center justify-center">{i + 1}</span>
                                        <div>
                                            <h3 className="font-bold">{mod.title}</h3>
                                            <p className="text-sm text-muted-foreground">{mod.description}</p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-bold text-primary">{formatBRL(mod.basePrice)}</p>
                                        <p className="text-xs text-muted-foreground">{mod.estimatedWeeks} semana(s)</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {mod.deliverables.map((d: string, di: number) => (
                                        <div key={di} className="flex items-start gap-2 text-xs text-muted-foreground">
                                            <CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                                            {d}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Timeline */}
                <section>
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400 font-black text-sm">4</span>
                        Cronograma (~{totalWeeks} semanas)
                    </h2>
                    <div className="space-y-1">
                        {[
                            { phase: "Fase 0 — Discovery", weeks: "Semana 1", items: ["Kick-off", "Levantamento", "Alinhamento KPIs"] },
                            ...modules.map((m: any, i: number) => ({
                                phase: m.title, weeks: `Semana ${2 + i * 2}–${3 + i * 2}`, items: m.deliverables.slice(0, 2)
                            })),
                            { phase: "Go-Live & Handover", weeks: `Semana ${totalWeeks}`, items: ["Testes de aceitação", "Treinamento", "Documentação"] },
                        ].map((t, i) => (
                            <div key={i} className="flex gap-4 py-3 border-b border-border/30 last:border-0">
                                <div className="w-32 shrink-0 text-xs text-muted-foreground pt-0.5">{t.weeks}</div>
                                <div>
                                    <p className="text-sm font-semibold">{t.phase}</p>
                                    <p className="text-xs text-muted-foreground">{t.items.join(" · ")}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Disclaimer */}
                <p className="text-xs text-muted-foreground/60 italic border-t border-border/30 pt-6">
                    * Proposta gerada com base nas informações fornecidas no diagnóstico. Valores sujeitos a ajuste após reunião de discovery completo.
                    Todos os módulos, prazos e investimentos são estimativas baseadas nos dados atuais.
                </p>

                {/* Action Buttons */}
                {!["accepted", "rejected"].includes(proposal.status) && (
                    <PropostaActionButtons slug={slug} />
                )}
                {proposal.status === "accepted" && (
                    <div className="flex items-center justify-center gap-3 py-8 rounded-2xl bg-green-500/10 border border-green-500/20">
                        <CheckCircle2 className="w-8 h-8 text-green-500" />
                        <div>
                            <p className="font-bold text-green-500 text-lg">Proposta Aceita!</p>
                            <p className="text-sm text-muted-foreground">Nossa equipe entrará em contato em breve para iniciar o onboarding.</p>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}
