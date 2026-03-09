"use client";

/**
 * app/org/[slug]/admin/executive-pack/executive-pack-client.tsx
 * V24: Executive Pack Generator — premium CEO-ready UI
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ExecPackPayload } from "@/lib/executive-pack/pack-builder";
import { HelpPopover } from "@/components/ui/help-popover";
import { getHelp } from "@/lib/help/use-help";
import { HelpTopic } from "@/lib/help/help-content";

// ─── Palette ──────────────────────────────────────────────────────────────────
const GOLD = "#d4af37";
const GOLD2 = "#f5cc5a";
const IND = "#6366f1";

function fmtBRL(cents: number) {
    const v = cents / 100;
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
    return `R$ ${v.toFixed(0)}`;
}
function pctFmt(v: number) { return `${(v * 100).toFixed(1)}%`; }

// ─── Sub-components ───────────────────────────────────────────────────────────

function GlassCard({ children, className = "", accentColor }: {
    children: React.ReactNode; className?: string; accentColor?: string;
}) {
    return (
        <div className={`rounded-3xl p-6 relative overflow-hidden ${className}`}
            style={{
                background: "rgba(255,255,255,0.025)",
                border: `1px solid ${accentColor ? accentColor + "22" : "rgba(255,255,255,0.07)"}`,
                backdropFilter: "blur(20px)",
            }}>
            {accentColor && (
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(90deg,transparent,${accentColor}55,transparent)` }} />
            )}
            {children}
        </div>
    );
}

function SectionLabel({ label, icon, helpTopic }: { label: string; icon: string; helpTopic?: HelpTopic }) {
    return (
        <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.22em] flex items-center gap-2"
                style={{ color: GOLD }}>
                <span>{icon}</span>{label}
            </p>
            {helpTopic && <HelpPopover {...getHelp(helpTopic)} />}
        </div>
    );
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────
function KpiGrid({ kpi }: { kpi: ExecPackPayload["kpi"] }) {
    const cards = [
        { label: "Receita 30d", value: fmtBRL(kpi.revenueClosed30dCents), color: GOLD2, sub: `${kpi.dealsClosedCount} negócios` },
        { label: "Ticket médio", value: fmtBRL(kpi.avgTicketCents), color: "#4ade80", sub: "por fechamento" },
        { label: "Conversão", value: pctFmt(kpi.conversionRate), color: IND, sub: `${kpi.totalLeads} leads totais` },
        { label: "Hot leads", value: String(kpi.hotLeads), color: "#fb923c", sub: "em pipeline" },
        { label: "Reuniões", value: String(kpi.meetingsScheduled), color: "#a78bfa", sub: "agendadas" },
        { label: "Perdidos", value: String(kpi.lostDealsCount), color: "#f87171", sub: "deals perdidos" },
    ];
    return (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {cards.map((c, i) => (
                <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.35 }}
                    className="rounded-2xl p-4 text-center"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>{c.label}</p>
                    <p className="text-2xl font-black" style={{ color: c.color }}>{c.value}</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>{c.sub}</p>
                </motion.div>
            ))}
        </div>
    );
}

// ── Funnel ────────────────────────────────────────────────────────────────────
function FunnelView({ funnel }: { funnel: ExecPackPayload["funnel"] }) {
    const max = funnel[0]?.count || 1;
    return (
        <div className="space-y-2">
            {funnel.map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.07 }}>
                    <div className="flex items-center justify-between mb-1 text-xs">
                        <span style={{ color: "rgba(255,255,255,0.5)" }}>{s.label}</span>
                        <span className="font-bold" style={{ color: GOLD2 }}>{s.count}
                            {s.pct !== undefined && s.pct < 1 && (
                                <span className="ml-1 font-normal" style={{ color: "rgba(255,255,255,0.3)" }}>
                                    ({pctFmt(s.pct)})
                                </span>
                            )}
                        </span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <motion.div className="h-full rounded-full"
                            style={{ background: `linear-gradient(90deg,${IND},${GOLD})` }}
                            initial={{ width: 0 }}
                            animate={{ width: `${(s.count / max) * 100}%` }}
                            transition={{ duration: 1, delay: 0.2 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                        />
                    </div>
                </motion.div>
            ))}
        </div>
    );
}

// ── Profit Leaks ──────────────────────────────────────────────────────────────
const SEV_COLOR: Record<string, string> = {
    critical: "#f87171", high: "#fb923c", medium: GOLD2, low: "#4ade80",
};

function LeaksView({ leaks, resolvedRate }: { leaks: ExecPackPayload["leaks"]; resolvedRate: number }) {
    if (leaks.length === 0) return (
        <p className="text-sm text-center py-4" style={{ color: "rgba(255,255,255,0.25)" }}>Sem leaks ativos.</p>
    );
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>Taxa de resolução</p>
                <p className="text-sm font-bold" style={{ color: "#4ade80" }}>{pctFmt(resolvedRate)}</p>
            </div>
            {leaks.map((l, i) => (
                <motion.div key={l.rank} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center gap-3 py-2 px-3 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${SEV_COLOR[l.severity] ?? GOLD2}22` }}>
                    <span className="text-xs font-black w-4" style={{ color: SEV_COLOR[l.severity] }}>#{l.rank}</span>
                    <p className="text-xs flex-1 leading-snug" style={{ color: "rgba(255,255,255,0.6)" }}>{l.title}</p>
                    <span className="text-xs font-bold flex-shrink-0" style={{ color: SEV_COLOR[l.severity] }}>
                        {fmtBRL(l.estimatedLossCents)}
                    </span>
                </motion.div>
            ))}
        </div>
    );
}

// ── Team ──────────────────────────────────────────────────────────────────────
function TeamView({ team }: { team: ExecPackPayload["team"] }) {
    const maxRev = team[0]?.revenueCents || 1;
    return (
        <div className="space-y-2">
            {team.map((m, i) => (
                <motion.div key={m.rank} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center gap-3">
                    <span className="text-base w-5 text-center">{["🥇", "🥈", "🥉", "4️⃣", "5️⃣"][i] ?? `${i + 1}`}</span>
                    <p className="text-xs flex-1" style={{ color: i === 0 ? GOLD2 : "rgba(255,255,255,0.5)" }}>{m.name}</p>
                    <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                            <div className="h-full rounded-full" style={{
                                width: `${(m.revenueCents / maxRev) * 100}%`,
                                background: i === 0 ? `linear-gradient(90deg,${IND},${GOLD})` : `${GOLD}55`,
                            }} />
                        </div>
                        <span className="text-xs font-bold" style={{ color: i === 0 ? GOLD2 : "rgba(255,255,255,0.4)" }}>
                            {fmtBRL(m.revenueCents)}
                        </span>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}

// ── Forecast ──────────────────────────────────────────────────────────────────
const CONF_COLOR: Record<string, string> = { high: "#4ade80", medium: GOLD2, low: "rgba(255,255,255,0.4)" };

function ForecastView({ forecast }: { forecast: ExecPackPayload["forecast"] }) {
    return (
        <div className="space-y-3">
            {forecast.map((f, i) => (
                <motion.div key={f.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-center justify-between py-3 px-4 rounded-2xl"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div>
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{f.label}</p>
                        <p className="text-lg font-black" style={{ color: GOLD2 }}>{fmtBRL(f.projectedCents)}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full font-bold"
                        style={{ background: `${CONF_COLOR[f.confidence]}22`, color: CONF_COLOR[f.confidence] }}>
                        {f.confidence === "high" ? "Alta" : f.confidence === "medium" ? "Média" : "Baixa"} confiança
                    </span>
                </motion.div>
            ))}
        </div>
    );
}

// ── Proof stats ───────────────────────────────────────────────────────────────
function ProofView({ proof }: { proof: ExecPackPayload["proof"] }) {
    const stats = [
        { label: "Diagnósticos emitidos", value: String(proof.totalAssessmentsAllTime) },
        { label: "Propostas geradas", value: String(proof.totalProposalsGenerated) },
        { label: "PDFs baixados", value: String(proof.totalPdfDownloads) },
        { label: "Engajamento pós-diag.", value: pctFmt(proof.npsProxy) },
        { label: "Uptime do sistema", value: `${proof.uptimePct}%` },
    ];
    return (
        <div className="grid grid-cols-2 gap-2">
            {stats.map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-xl p-3 text-center"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-lg font-black" style={{ color: GOLD2 }}>{s.value}</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{s.label}</p>
                </motion.div>
            ))}
        </div>
    );
}

// ── Work items ────────────────────────────────────────────────────────────────
function WorkItemsView({ items }: { items: ExecPackPayload["workItems"] }) {
    return (
        <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            {items.map((w, i) => (
                <motion.div key={w.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center justify-between py-2.5">
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{w.title}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(34,197,94,0.1)", color: "#4ade80" }}>{w.status}</span>
                </motion.div>
            ))}
        </div>
    );
}

// ─── Empty / Generate prompt ──────────────────────────────────────────────────
function EmptyState({ onGenerate, generating }: { onGenerate: () => void; generating: boolean }) {
    return (
        <div className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="text-6xl">📊</div>
            <div className="text-center">
                <p className="text-2xl font-black text-white mb-2">Executive Pack</p>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Relatório executivo com KPIs, funil, leaks, equipe, forecast e proof stats.
                </p>
            </div>
            <button onClick={onGenerate} disabled={generating}
                className="px-8 py-3 rounded-2xl text-sm font-bold transition-all"
                style={{
                    background: generating ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg,${IND},${GOLD})`,
                    color: generating ? "rgba(255,255,255,0.3)" : "white",
                    boxShadow: generating ? "none" : `0 8px 32px ${GOLD}33`,
                }}>
                {generating ? "⚙️ Gerando pack…" : "⚡ Gerar Executive Pack"}
            </button>
        </div>
    );
}

// ─── Main client ──────────────────────────────────────────────────────────────
export function ExecutivePackClient({ orgSlug, orgId }: { orgSlug: string; orgId: string }) {
    const [pack, setPack] = useState<ExecPackPayload | null>(null);
    const [packId, setPackId] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [anonymized, setAnonymized] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generate = useCallback(async () => {
        setGenerating(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/executive-pack/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orgId, anonymized }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error ?? "Falha na geração"); return; }

            // Fetch full payload
            const detailRes = await fetch(`/api/admin/executive-pack/${data.id}`);
            const detail = await detailRes.json();
            if (detailRes.ok) {
                setPack(detail.pack);
                setPackId(data.id);
            }
        } catch (e: any) {
            setError(e?.message ?? "Erro");
        } finally {
            setGenerating(false);
        }
    }, [orgId, anonymized]);

    const copyNarrative = useCallback(() => {
        if (!pack) return;
        navigator.clipboard.writeText(pack.narrative).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [pack]);

    return (
        <div className="min-h-screen font-sans antialiased" style={{ background: "#0b0b0f", color: "#e2e2ea" }}>

            {/* Ambient */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-40 left-0 w-[600px] h-[600px] rounded-full blur-[130px] opacity-[0.04]"
                    style={{ background: IND }} />
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px] opacity-[0.035]"
                    style={{ background: GOLD }} />
            </div>

            {/* Top bar */}
            <div className="sticky top-0 z-20 px-8 py-4 flex items-center justify-between"
                style={{ background: "rgba(11,11,15,0.92)", borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }}>
                <div className="flex items-center gap-3">
                    <div className="w-1 h-6 rounded-full" style={{ background: `linear-gradient(to bottom,${GOLD2},${GOLD})` }} />
                    <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Executive Pack</p>
                    {pack && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80" }}>✓ Pronto</span>}
                </div>

                <div className="flex items-center gap-3">
                    {/* Anonymize toggle */}
                    <label className="flex items-center gap-2 cursor-pointer">
                        <div onClick={() => setAnonymized(!anonymized)}
                            className="w-8 h-4 rounded-full relative transition-all"
                            style={{ background: anonymized ? IND : "rgba(255,255,255,0.12)" }}>
                            <div className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
                                style={{ background: "white", left: anonymized ? "calc(100% - 14px)" : "2px" }} />
                        </div>
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Anonimizar</span>
                    </label>

                    {pack && (
                        <>
                            <button onClick={copyNarrative}
                                className="text-xs px-3 py-1.5 rounded-xl font-semibold transition-all"
                                style={{ background: "rgba(99,102,241,0.15)", color: IND, border: `1px solid ${IND}44` }}>
                                {copied ? "✓ Copiado!" : "📋 Copiar resumo"}
                            </button>
                            {packId && (
                                <a href={`/api/pdf/executive-pack/${packId}`} target="_blank"
                                    className="text-xs px-3 py-1.5 rounded-xl font-semibold"
                                    style={{ background: `linear-gradient(135deg,${IND},${GOLD})`, color: "white" }}>
                                    📄 Export PDF
                                </a>
                            )}
                        </>
                    )}

                    <button onClick={generate} disabled={generating}
                        className="text-xs px-4 py-1.5 rounded-xl font-bold transition-all"
                        style={{
                            background: generating ? "rgba(255,255,255,0.05)" : "rgba(212,175,55,0.15)",
                            color: generating ? "rgba(255,255,255,0.3)" : GOLD2,
                            border: `1px solid ${generating ? "transparent" : "rgba(212,175,55,0.25)"}`,
                        }}>
                        {generating ? "Gerando…" : pack ? "↻ Regenerar" : "⚡ Gerar"}
                    </button>
                </div>
            </div>

            <div className="relative max-w-[1400px] mx-auto px-8 py-8">
                {error && (
                    <div className="mb-6 px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                        ⚠ {error}
                    </div>
                )}

                <AnimatePresence mode="wait">
                    {!pack ? (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <EmptyState onGenerate={generate} generating={generating} />
                        </motion.div>
                    ) : (
                        <motion.div key="pack" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }} className="space-y-6">

                            {/* Meta strip */}
                            <div className="flex items-center justify-between">
                                <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                                    Gerado em {new Date(pack.generatedAt).toLocaleString("pt-BR")}
                                    &nbsp;·&nbsp;Janela: 30 dias
                                    {pack.anonymized && <span className="ml-2 text-indigo-400">· Dados anonimizados</span>}
                                </p>
                            </div>

                            {/* Row 1: KPIs */}
                            <GlassCard accentColor={GOLD}>
                                <SectionLabel label="KPIs — Visão Geral" icon="📊" />
                                <KpiGrid kpi={pack.kpi} />
                            </GlassCard>

                            {/* Row 2: Funnel + Leaks */}
                            <div className="grid xl:grid-cols-2 gap-6">
                                <GlassCard accentColor={IND}>
                                    <SectionLabel label="Funil de Performance 30d" icon="⚡" />
                                    <FunnelView funnel={pack.funnel} />
                                </GlassCard>
                                <GlassCard accentColor="#f87171">
                                    <SectionLabel label="Profit Leaks (Top 5)" icon="🛡" helpTopic="profitLeaks" />
                                    <LeaksView leaks={pack.leaks} resolvedRate={pack.leakResolvedRate} />
                                </GlassCard>
                            </div>

                            {/* Row 3: Team + Forecast */}
                            <div className="grid xl:grid-cols-2 gap-6">
                                <GlassCard accentColor={GOLD}>
                                    <SectionLabel label="Ranking da Equipe" icon="🏆" />
                                    <TeamView team={pack.team} />
                                </GlassCard>
                                <GlassCard accentColor="#4ade80">
                                    <SectionLabel label="Forecast Próximos 30–60d" icon="📈" />
                                    <ForecastView forecast={pack.forecast} />
                                </GlassCard>
                            </div>

                            {/* Row 4: Proof + Work Items */}
                            <div className="grid xl:grid-cols-2 gap-6">
                                <GlassCard accentColor="#a78bfa">
                                    <SectionLabel label="Proof of Authority" icon="🎯" />
                                    <ProofView proof={pack.proof} />
                                </GlassCard>
                                <GlassCard accentColor="#34d399">
                                    <SectionLabel label="O Que Fizemos Este Mês" icon="🚀" />
                                    <WorkItemsView items={pack.workItems} />
                                </GlassCard>
                            </div>

                            {/* Board Summary */}
                            <GlassCard accentColor={GOLD}>
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <SectionLabel label="Board Summary — Copiar para WhatsApp / Email" icon="📝" />
                                    <button onClick={copyNarrative}
                                        className="text-xs px-3 py-1.5 rounded-xl flex-shrink-0"
                                        style={{ background: "rgba(99,102,241,0.12)", color: IND }}>
                                        {copied ? "✓ Copiado" : "Copiar"}
                                    </button>
                                </div>
                                <pre className="text-sm whitespace-pre-wrap leading-relaxed"
                                    style={{ color: "rgba(255,255,255,0.65)", fontFamily: "inherit" }}>
                                    {pack.narrative}
                                </pre>
                            </GlassCard>

                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
