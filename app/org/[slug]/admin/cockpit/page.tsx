import { loadCockpit } from "@/lib/cockpit";
import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import Link from "next/link";
import { AISystemGrid } from "./ai-system-grid";
import { ActionQueue } from "./action-queue";
import {
    Activity, Zap, TrendingUp, AlertTriangle, CheckCircle2,
    Clock, Users, DollarSign, Target, BarChart2, Layers,
    Award, FileText, Wifi, WifiOff, ArrowRight, Star, ExternalLink, RefreshCw,
    Rocket
} from "lucide-react";
import { CommandQueue } from "./command-queue";
import { AgentRuns } from "./agent-runs";
import { MeetingPerformanceBlock } from "./meeting-performance-block";
import { PipelineHealthBlock } from "./pipeline-health-block";
import { calculatePipelineHealth } from "@/lib/services/revenue/pipeline-health";
import { prisma } from "@/lib/prisma";
import { CockpitActionsHandler } from "./cockpit-actions-handler";
import { CockpitGuideBar } from "./cockpit-guide-bar";

export const runtime = "nodejs";

function formatMoney(n: number): string {
    if (n >= 1_000_000) return `R$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `R$${(n / 1_000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}k`;
    return `R$${n}`;
}

function HealthDot({ status }: { status: string }) {
    const color = status === "ok" ? "bg-green-400" : status === "degraded" ? "bg-yellow-400" : status === "off" ? "bg-gray-500" : "bg-red-500";
    const pulse = status === "critical" || status === "degraded";
    return (
        <span className="relative flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${color} ${pulse ? "animate-pulse" : ""}`} />
            <span className="text-xs text-muted-foreground capitalize">{status === "ok" ? "Online" : status === "off" ? "Desligado" : status}</span>
        </span>
    );
}

const STAGE_LABELS: Record<string, string> = {
    post_click: "Clicou", whatsapp_initial: "WhatsApp", post_dossier: "Dossiê",
    schedule_pending: "Agenda", proposal_sent: "Proposta", follow_up_1: "F.up 1",
    follow_up_2: "F.up 2", converted: "Convertido",
};

export default async function CockpitPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    let ctx: Awaited<ReturnType<typeof requireOrgContext>>;
    try {
        ctx = await requireOrgContext(slug);
        assertRole(ctx.role, "closer");
    } catch {
        redirect(`/org/${slug}/admin/login`);
    }

    const data = await loadCockpit(ctx!.orgId, slug);
    const { missionStatus: ms, revenueSnapshot: rs, actionQueue, aiSnapshot,
        funnelSnapshot: fs, executionSnapshot: es, contentSnapshot: cs, billingSnapshot: bs } = data;

    const isAdmin = ["owner", "admin"].includes(ctx!.role);

    // V15: Orchestrator Data
    const dbActionQueue = await (prisma as any).actionQueue.findMany({
        where: { organizationId: ctx.orgId, status: { in: ["pending", "review_required", "approved"] } },
        orderBy: { createdAt: "desc" }
    });

    const recentRuns = await (prisma as any).agentRun.findMany({
        where: { organizationId: ctx.orgId },
        orderBy: { startedAt: "desc" },
        take: 20
    });

    // V16.3-P3: Meeting metrics (30d)
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const meetingSessions = await (prisma as any).meetingSession.findMany({
        where: { organizationId: ctx.orgId, startAt: { gte: since30d }, status: { in: ["completed", "canceled"] } }
    });
    const meetingSessionIds = meetingSessions.map((s: any) => s.id);
    const meetingPerformances = meetingSessionIds.length > 0
        ? await (prisma as any).meetingPerformance.findMany({ where: { sessionId: { in: meetingSessionIds } } })
        : [];
    const wonPerfs = meetingPerformances.filter((p: any) => p.outcome === "won");
    const showed = meetingSessions.filter((s: any) => s.status === "completed").length;
    const totalRevenue = wonPerfs.reduce((sum: number, p: any) => sum + (p.closedValue ?? 0), 0);
    const meetingMetrics = {
        total: meetingSessions.length,
        showed,
        showRate: meetingSessions.length > 0 ? Math.round(showed / meetingSessions.length * 100) : 0,
        closeRate: showed > 0 ? Math.round(wonPerfs.length / showed * 100) : 0,
        avgDealSize: wonPerfs.length > 0 ? Math.round(totalRevenue / wonPerfs.length) : 0,
        totalRevenue: Math.round(totalRevenue),
        wonCount: wonPerfs.length,
        lostCount: meetingPerformances.filter((p: any) => p.outcome === "lost").length,
        noShowCount: meetingPerformances.filter((p: any) => p.outcome === "no_show").length,
        pendingCount: meetingPerformances.filter((p: any) => p.outcome === "pending").length,
    };

    // V17: Pipeline Health
    const pipelineHealth = await calculatePipelineHealth(ctx.orgId).catch(() => null);

    return (
        <div className="min-h-screen bg-[#030712] text-white">

            {/* ── Topbar ───────────────────────────────────────────────────── */}
            <nav className="border-b border-white/5 bg-[#030712]/80 backdrop-blur-xl sticky top-0 z-50 px-6 py-3.5">
                <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                            <Activity className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <span className="font-black text-sm tracking-tight">{ms.orgName}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary/80 uppercase tracking-widest">
                            {ms.plan}
                        </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Atualizado {new Date(ms.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                        <Link href={`/org/${slug}/admin`} className="text-muted-foreground hover:text-white transition-colors">Admin clássico →</Link>
                        <CockpitGuideBar />
                    </div>
                </div>
            </nav>

            <main className="max-w-[1440px] mx-auto px-6 py-6 space-y-5">

                {/* ══ SECTION 1: Mission Status ════════════════════════════════ */}
                <section>
                    <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-[#0a0f1e] via-[#0d121f] to-[#050810] p-6">
                        {/* Glow */}
                        <div className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-blue-500/5 blur-3xl" />

                        <div className="relative grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                            {/* System Health */}
                            <div className="col-span-2 sm:col-span-3 lg:col-span-1 space-y-2">
                                <p className="text-xs text-muted-foreground uppercase tracking-widest">Sistemas</p>
                                <HealthDot status={ms.healthAI} />
                                <HealthDot status={ms.healthFunnel} />
                                <HealthDot status={ms.healthAlerts} />
                                <div className="pt-2">
                                    <Link
                                        href={`/org/${slug}/admin/offers`}
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/20 text-[#d4af37] text-[10px] font-black uppercase tracking-widest hover:bg-[#d4af37]/20 transition-all group"
                                    >
                                        <Rocket className="w-3.5 h-3.5" />
                                        <span>Criar Oferta</span>
                                        <ArrowRight className="w-3 h-3 ml-auto group-hover:translate-x-1 transition-transform" />
                                    </Link>
                                </div>
                            </div>

                            {[
                                { label: "Pipeline Value", value: formatMoney(ms.pipelineValue), icon: <Target className="w-4 h-4 text-primary" />, sub: `${ms.openProposals} propostas abertas` },
                                { label: "Conversão 30d", value: `${ms.conversion30d}`, icon: <CheckCircle2 className="w-4 h-4 text-green-400" />, sub: "leads convertidos" },
                                { label: "Sequências ativas", value: `${ms.activeSequences}`, icon: <Zap className="w-4 h-4 text-yellow-400" />, sub: "no funil agora" },
                                { label: "Alertas críticos", value: `${ms.criticalAlerts}`, icon: <AlertTriangle className="w-4 h-4 text-red-400" />, sub: ms.criticalAlerts > 0 ? "requer atenção" : "tudo normal" },
                                { label: "ROI Médio / ano", value: formatMoney(rs.avgAnnualROI), icon: <TrendingUp className="w-4 h-4 text-green-400" />, sub: `${rs.totalCases} cases` },
                            ].map(c => (
                                <div key={c.label} className="space-y-2">
                                    <p className="text-xs text-muted-foreground uppercase tracking-widest">{c.label}</p>
                                    <div className="flex items-center gap-2">
                                        {c.icon}
                                        <span className="text-2xl font-black tracking-tight">{c.value}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground/60">{c.sub}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ══ SECTION 2+3: Revenue + Action Queue ════════════════════ */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

                    {/* Revenue Radar */}
                    <section data-guide-id="cc_kpi_revenue" className="lg:col-span-2 rounded-2xl border border-white/8 bg-[#0a0f1e] p-5 space-y-4">
                        <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-green-400" />
                            <h2 className="font-bold text-sm">Revenue Radar</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: "Economia / ano", value: formatMoney(rs.avgSavings), color: "text-green-400" },
                                { label: "Receita / ano", value: formatMoney(rs.avgRevenue), color: "text-blue-400" },
                                { label: "ROI Médio", value: formatMoney(rs.avgAnnualROI), color: "text-primary" },
                                { label: "Payback médio", value: `${rs.avgPaybackMonths}m`, color: "text-yellow-400" },
                            ].map(c => (
                                <div key={c.label} className="bg-white/3 rounded-xl p-3 border border-white/5">
                                    <p className="text-xs text-muted-foreground">{c.label}</p>
                                    <p className={`text-xl font-black mt-1 ${c.color}`}>{c.value}</p>
                                </div>
                            ))}
                        </div>
                        {rs.monthlySnapshots.length > 0 && (
                            <div>
                                <p className="text-xs text-muted-foreground mb-2">Avaliações / mês</p>
                                <div className="flex items-end gap-1.5 h-14">
                                    {[...Array(6)].map((_, i) => {
                                        const snap = rs.monthlySnapshots[i];
                                        const val = snap?.assessmentsCount ?? 0;
                                        const max = Math.max(...rs.monthlySnapshots.map((s: any) => s.assessmentsCount), 1);
                                        const h = Math.max(8, Math.round((val / max) * 56));
                                        return (
                                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                                <div className="w-full bg-primary/30 rounded-sm" style={{ height: h }} title={snap?.month ?? ""} />
                                                {snap && <span className="text-xs text-muted-foreground/40">{snap.month.slice(5)}</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Action Queue */}
                    <section data-guide-id="cc_kpi_pipeline" className="lg:col-span-3 rounded-2xl border border-white/8 bg-[#0a0f1e] p-5 space-y-4">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-yellow-400" />
                            <h2 className="font-bold text-sm">System Signals</h2>
                            {actionQueue.length > 0 && (
                                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-yellow-400/15 text-yellow-400 border border-yellow-400/20">
                                    {actionQueue.length} pendentes
                                </span>
                            )}
                        </div>
                        <ActionQueue items={actionQueue} orgSlug={slug} />
                    </section>

                    {/* V15: Command Queue */}
                    <section className="lg:col-span-3 rounded-2xl border border-white/8 bg-[#0a0f1e] p-5 space-y-4">
                        <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-primary" />
                            <h2 className="font-bold text-sm">Command Queue</h2>
                            {dbActionQueue.length > 0 && (
                                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                                    {dbActionQueue.length} aguardando
                                </span>
                            )}
                        </div>
                        <CommandQueue items={dbActionQueue} orgSlug={slug} />
                    </section>
                </div>

                {/* ══ SECTION 4: AI Systems Grid ══════════════════════════════ */}
                <section className="rounded-2xl border border-white/8 bg-[#0a0f1e] p-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary" />
                        <h2 className="font-bold text-sm">AI Systems</h2>
                        <span className="text-xs text-muted-foreground ml-auto">
                            {aiSnapshot.filter(s => s.enabled).length}/{aiSnapshot.length} online
                        </span>
                    </div>
                    <AISystemGrid
                        systems={aiSnapshot}
                        orgSlug={slug}
                        isAdmin={isAdmin}
                        stubKeys={{
                            "ai.content_engine": !process.env.OPENAI_API_KEY,
                            "ai.authority": !process.env.OPENAI_API_KEY,
                            "ai.presales": !process.env.OPENAI_API_KEY,
                            "ai.funnel_engine": !process.env.META_ACCESS_TOKEN
                        }}
                    />
                </section>

                {/* ══ SECTION 5+6: Funnel + Execution ════════════════════════ */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                    {/* Funnel Heatmap */}
                    <section className="rounded-2xl border border-white/8 bg-[#0a0f1e] p-5 space-y-4">
                        <div className="flex items-center gap-2">
                            <BarChart2 className="w-4 h-4 text-blue-400" />
                            <h2 className="font-bold text-sm">Funil</h2>
                            <span className="ml-auto text-xs text-muted-foreground">{fs.overallRate}% conversão geral</span>
                        </div>
                        <div className="space-y-2">
                            {fs.stages.map(stage => (
                                <div key={stage.stage} className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground w-24 shrink-0">{STAGE_LABELS[stage.stage] ?? stage.stage}</span>
                                    <div className="flex-1 h-5 bg-white/3 rounded-md overflow-hidden relative">
                                        <div
                                            className={`h-full rounded-md transition-all ${stage.stage === "converted" ? "bg-green-500/70" : "bg-primary/40"}`}
                                            style={{ width: `${Math.max(stage.pct, stage.count > 0 ? 3 : 0)}%` }}
                                        />
                                        <span className="absolute inset-0 flex items-center px-2 text-xs font-medium">
                                            {stage.count > 0 ? stage.count : "—"}
                                        </span>
                                    </div>
                                    <span className="text-xs text-muted-foreground/60 w-10 text-right">{stage.pct}%</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3 pt-1 border-t border-white/5">
                            {Object.entries(fs.tierCounts).map(([tier, count]) => (
                                <div key={tier} className="text-center">
                                    <p className="text-sm font-bold">{count as number}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">{tier === "hot" ? "🔥" : tier === "warm" ? "🌡" : "❄️"} {tier}</p>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t border-white/5 mt-2">
                            <Link href={`/org/${slug}/admin/sequences`} className="flex-1 btn-secondary text-xs h-8 flex items-center justify-center gap-2">
                                Ver Sequências
                            </Link>
                            <Link href={`/org/${slug}/admin`} className="flex-1 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-semibold h-8 flex items-center justify-center gap-2 transition-colors">
                                Ver Pipeline
                            </Link>
                        </div>
                    </section>

                    {/* Execution Matrix */}
                    <section className="rounded-2xl border border-white/8 bg-[#0a0f1e] p-5 space-y-4">
                        <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-purple-400" />
                            <h2 className="font-bold text-sm">Execution Matrix</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: "Workspaces ativos", value: es.active, color: "text-green-400", icon: <CheckCircle2 className="w-4 h-4" /> },
                                { label: "Em provisioning", value: es.provisioning, color: "text-blue-400", icon: <Clock className="w-4 h-4" /> },
                                { label: "Bloqueados > 3d", value: es.blocked, color: es.blocked > 0 ? "text-red-400" : "text-muted-foreground", icon: <AlertTriangle className="w-4 h-4" /> },
                                { label: "Go-live em 7 dias", value: es.upcoming, color: "text-yellow-400", icon: <Star className="w-4 h-4" /> },
                            ].map(c => (
                                <div key={c.label} className="bg-white/3 rounded-xl p-3 border border-white/5 flex items-center gap-3">
                                    <div className={`${c.color}`}>{c.icon}</div>
                                    <div>
                                        <p className={`text-xl font-black ${c.color}`}>{c.value}</p>
                                        <p className="text-xs text-muted-foreground">{c.label}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {es.topAtRisk && es.topAtRisk.length > 0 && (
                            <div className="pt-2 border-t border-white/5">
                                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 text-red-500" /> Top em Risco</p>
                                <div className="space-y-1">
                                    {es.topAtRisk.map((w: any) => (
                                        <div key={w.id} className="flex items-center justify-between bg-white/3 rounded-lg p-2 text-xs">
                                            <span className="truncate w-32">{w.assessment?.company || "Workspace"}</span>
                                            <Link href={`/org/${slug}/admin/workspaces`} className="text-primary hover:text-primary/80 flex items-center gap-1 font-medium">Abrir <ExternalLink className="w-3 h-3" /></Link>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {isAdmin && (
                            <CockpitActionsHandler />
                        )}
                        <Link href={`/org/${slug}/admin/workspaces`}
                            className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-white border border-white/5 rounded-xl py-2 transition-colors">
                            Ver todos os workspaces <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </section>
                </div>

                {/* ══ SECTION 7+8: Content + Billing ══════════════════════════ */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* Content + Authority */}
                    <section className="lg:col-span-2 rounded-2xl border border-white/8 bg-[#0a0f1e] p-5 space-y-4 flex flex-col">
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-green-400" />
                            <h2 className="font-bold text-sm">Authority & Content</h2>
                            {isAdmin && (
                                <div className="ml-auto flex items-center gap-2">
                                    <Link href={`/org/${slug}/admin/content`} className="text-[10px] font-semibold text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded transition-colors">Gerar Conteúdo</Link>
                                    <Link href={`/org/${slug}/admin/authority`} className="text-[10px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded transition-colors">Gerar Prova</Link>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4 flex-1">
                            {/* Content pipeline mini-kanban */}
                            <div>
                                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5"><FileText className="w-3 h-3" /> Content Engine</p>
                                <div className="space-y-1.5">
                                    {["draft", "reviewed", "approved", "scheduled", "posted"].map(s => (
                                        <div key={s} className="flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground capitalize">{s}</span>
                                            <span className="text-xs font-bold">{cs.contentMap[s] ?? 0}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Authority pipeline */}
                            <div>
                                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5"><Award className="w-3 h-3" /> Authority Assets</p>
                                <div className="space-y-1.5">
                                    {["internal", "anonymized", "approved", "published"].map(s => (
                                        <div key={s} className="flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground capitalize">{s}</span>
                                            <span className="text-xs font-bold">{cs.authorityMap[s] ?? 0}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {cs.proofStats.length > 0 && (
                            <div className="border-t border-white/5 pt-3">
                                <p className="text-xs text-muted-foreground mb-2">Prova social agregada</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {cs.proofStats.map((s: any) => (
                                        <div key={s.label} className="bg-white/3 rounded-lg p-2">
                                            <p className="text-sm font-bold text-primary">{s.value}</p>
                                            <p className="text-xs text-muted-foreground">{s.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Billing */}
                    <section className="rounded-2xl border border-white/8 bg-[#0a0f1e] p-5 space-y-4">
                        <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-yellow-400" />
                            <h2 className="font-bold text-sm">Billing</h2>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Plano</span>
                                <span className="text-xs font-bold uppercase text-primary">{bs.plan}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Stripe</span>
                                <span className={`text-xs font-bold ${bs.hasStripe ? "text-green-400" : "text-gray-500"}`}>
                                    {bs.hasStripe ? bs.subscriptionStatus : "Não configurado"}
                                </span>
                            </div>
                            <div>
                                <div className="flex items-center justify-between text-xs mb-1">
                                    <span className="text-muted-foreground">Assessments / mês</span>
                                    <span className="font-bold">{bs.assessmentsUsed}/{bs.maxAssessments}</span>
                                </div>
                                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${bs.assessmentsPct >= 90 ? "bg-red-500" : bs.assessmentsPct >= 70 ? "bg-yellow-400" : "bg-primary"}`}
                                        style={{ width: `${bs.assessmentsPct}%` }}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground/60 mt-0.5">{bs.assessmentsPct}% do limite</p>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Custo IA / mês</span>
                                <span className="text-xs font-bold text-yellow-400">${bs.estimatedAICost.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Gerações IA</span>
                                <span className="text-xs font-bold">{bs.aiGenerationsMonth} este mês</span>
                            </div>
                        </div>
                        {isAdmin && bs.currentPeriodEnd && (
                            <p className="text-xs text-muted-foreground/50 border-t border-white/5 pt-3 mb-2">
                                Período encerra: {new Date(bs.currentPeriodEnd).toLocaleDateString("pt-BR")}
                            </p>
                        )}
                        {isAdmin && bs.plan !== "enterprise" && (
                            <Link href={`/org/${slug}/admin/billing`} className="w-full btn-primary h-9 flex items-center justify-center gap-2 text-xs mt-auto relative overflow-hidden group">
                                <span className="relative z-10 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Fazer Upgrade</span>
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:animate-[shimmer_1.5s_infinite]" />
                            </Link>
                        )}
                    </section>
                </div>

                {/* ══ SECTION 9: Orchestrator Autopilot & Telemetry ══════════ */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
                    {/* Autopilot Toggles */}
                    <section className="rounded-2xl border border-white/8 bg-[#0a0f1e] p-5 space-y-4">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                            <h2 className="font-bold text-sm">Autopilot</h2>
                            <span className="ml-auto text-xs text-muted-foreground bg-green-400/10 px-2 py-0.5 rounded text-green-400 font-bold border border-green-500/20">Safe Mode ON</span>
                        </div>
                        <div className="space-y-4">
                            <p className="text-xs text-muted-foreground">O Autopilot gerará rascunhos e aprovações até o estado 'review_required'. Em Safe Mode ele não dispara auto-execuções.</p>
                            <div className="space-y-2">
                                {[
                                    { name: "Content Planner", desc: "Sugerir novos conteúdos baseado em autoridade", active: true },
                                    { name: "Funnel Follow-up", desc: "Criar rascunho p/ leads estagnados >3d", active: true },
                                    { name: "Proposal Draft", desc: "Criar rascunhos de propostas com ROI alto", active: false }
                                ].map(t => (
                                    <div key={t.name} className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/3">
                                        <div>
                                            <p className="font-bold text-sm text-foreground">{t.name}</p>
                                            <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                                        </div>
                                        <div className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${t.active ? "bg-primary" : "bg-white/10"}`}>
                                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${t.active ? "translate-x-4" : ""}`} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Agent Runs Telemetry */}
                    <section className="rounded-2xl border border-white/8 bg-[#0a0f1e] p-5 space-y-4">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-blue-400" />
                            <h2 className="font-bold text-sm">Agent Telemetry</h2>
                        </div>
                        <AgentRuns runs={recentRuns} />
                    </section>
                </div>

                {/* ══ SECTION 10: Meeting Performance ═══════════════════════ */}
                <div className="mt-5">
                    <MeetingPerformanceBlock metrics={meetingMetrics} orgSlug={slug} />
                </div>

                {/* ══ SECTION 11: Pipeline Health (V17) ══════════════════════ */}
                <div className="mt-5">
                    <PipelineHealthBlock initialHealth={pipelineHealth} orgSlug={slug} />
                </div>

            </main>
        </div>
    );
}
