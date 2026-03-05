import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getFunnelMetrics } from "@/lib/funnel-sequence";
import { SequenceActions } from "./sequence-actions";
import {
    ChevronLeft, Zap, MessageCircle, CheckCircle2,
    PauseCircle, XCircle, TrendingUp, Users, ArrowRight, BarChart2
} from "lucide-react";

export const runtime = "nodejs";

const STAGE_LABELS: Record<string, string> = {
    post_click: "Clicou no post",
    whatsapp_initial: "WhatsApp enviado",
    post_dossier: "Viu dossiê",
    schedule_pending: "Aguardando agenda",
    proposal_sent: "Proposta enviada",
    follow_up_1: "Follow-up 1",
    follow_up_2: "Follow-up 2",
    converted: "Convertido",
    lost: "Perdido",
};

const STATUS_CONFIG = {
    active: { label: "Ativo", color: "text-green-400", dot: "bg-green-400" },
    paused: { label: "Pausado", color: "text-yellow-400", dot: "bg-yellow-400" },
    completed: { label: "Convertido", color: "text-blue-400", dot: "bg-blue-400" },
    opted_out: { label: "Saiu", color: "text-gray-500", dot: "bg-gray-500" },
};

const TIER_COLORS = { hot: "text-red-400", warm: "text-yellow-400", cold: "text-blue-400" };
const TIER_LABELS = { hot: "🔥 Quente", warm: "🌡 Morno", cold: "❄️ Frio" };

export default async function SequencesListPage({
    params, searchParams
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ status?: string; page?: string }>;
}) {
    const { slug } = await params;
    const sp = await searchParams;

    let ctx: Awaited<ReturnType<typeof requireOrgContext>>;
    try {
        ctx = await requireOrgContext(slug);
        assertRole(ctx.role, "closer");
    } catch {
        redirect(`/org/${slug}/admin/login`);
    }

    const page = Math.max(1, Number(sp.page ?? 1));
    const take = 25;
    const where: any = { organizationId: ctx!.orgId };
    if (sp.status) where.status = sp.status;

    const [sequences, total, metrics] = await Promise.all([
        (prisma as any).leadSequence.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * take,
            take,
            include: { steps: { select: { status: true } } }
        }),
        (prisma as any).leadSequence.count({ where }),
        getFunnelMetrics(ctx!.orgId),
    ]);

    const assessmentIds = sequences.map((s: any) => s.assessmentId);
    const assessments = assessmentIds.length > 0
        ? await (prisma as any).assessment.findMany({
            where: { id: { in: assessmentIds } },
            select: { id: true, company: true, contactName: true, scoreTotal: true },
        })
        : [];
    const aMap: Record<string, any> = {};
    for (const a of assessments) aMap[a.id] = a;

    const totalPages = Math.ceil(total / take);
    const isAdmin = ["owner", "admin"].includes(ctx!.role);

    function buildUrl(extra: Record<string, string>) {
        return `?${new URLSearchParams({ ...(sp.status ? { status: sp.status } : {}), ...extra })}`;
    }

    return (
        <div className="min-h-screen bg-background">
            <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-40 px-6 py-3">
                <div className="max-w-6xl mx-auto flex items-center gap-4">
                    <Link href={`/org/${slug}/admin`} className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm">
                        <ChevronLeft className="w-4 h-4" /> Mission Control
                    </Link>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="font-semibold text-sm flex items-center gap-1.5">
                        <MessageCircle className="w-4 h-4 text-primary" /> Funil Automático
                    </span>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
                <h1 className="text-2xl font-black">Sequências de WhatsApp</h1>

                {/* Conversion metrics bar */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                        { label: "Total", value: metrics.total, icon: <Users className="w-4 h-4 text-muted-foreground" /> },
                        { label: "Ativos", value: metrics.active, icon: <Zap className="w-4 h-4 text-green-400" /> },
                        { label: "Convertidos", value: metrics.converted, icon: <CheckCircle2 className="w-4 h-4 text-blue-400" /> },
                        { label: "Conversão", value: `${metrics.conversionRate}%`, icon: <TrendingUp className="w-4 h-4 text-primary" /> },
                        { label: "Respondidos", value: metrics.replied, icon: <MessageCircle className="w-4 h-4 text-yellow-400" /> },
                    ].map(c => (
                        <div key={c.label} className="glass-panel rounded-xl border border-border/50 p-3 flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">{c.icon}</div>
                            <div>
                                <p className="text-xs text-muted-foreground">{c.label}</p>
                                <p className="font-bold">{c.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Funnel stage breakdown */}
                {Object.keys(metrics.byStage).length > 0 && (
                    <div className="glass-panel rounded-xl border border-border/50 p-4">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <BarChart2 className="w-3.5 h-3.5" /> Leads por etapa do funil
                        </p>
                        <div className="space-y-1.5">
                            {Object.entries(metrics.byStage).map(([stage, count]) => {
                                const pct = metrics.total > 0 ? Math.round(((count as number) / metrics.total) * 100) : 0;
                                return (
                                    <div key={stage} className="flex items-center gap-3 text-sm">
                                        <span className="w-44 text-muted-foreground text-xs shrink-0">{STAGE_LABELS[stage] ?? stage}</span>
                                        <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary/70 rounded-full" style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="text-xs text-muted-foreground w-8 text-right">{count as number}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Status filter */}
                <div className="flex gap-2 flex-wrap">
                    {["active", "paused", "completed", "opted_out"].map(s => (
                        <Link key={s} href={buildUrl({ status: s, page: "1" })}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${sp.status === s ? "bg-primary/20 border-primary/40 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                            {(STATUS_CONFIG as any)[s]?.label ?? s}
                        </Link>
                    ))}
                    {sp.status && <Link href={buildUrl({ page: "1" })} className="text-xs px-3 py-1.5 rounded-full border border-border/30 text-muted-foreground">✕ limpar</Link>}
                </div>

                {/* Sequences list */}
                <div className="space-y-3">
                    {sequences.length === 0 && (
                        <div className="text-center py-16 text-muted-foreground">
                            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>Nenhuma sequência ainda.</p>
                            <p className="text-xs mt-1 opacity-60">Sequências são iniciadas a partir de um lead qualificado no admin.</p>
                        </div>
                    )}
                    {sequences.map((s: any) => {
                        const a = aMap[s.assessmentId];
                        const cfg = (STATUS_CONFIG as any)[s.status] ?? STATUS_CONFIG.active;
                        const sent = s.steps.filter((st: any) => st.status !== "pending").length;

                        return (
                            <div key={s.id} className="glass-panel rounded-xl border border-border/40 p-4 flex items-start gap-4">
                                <div className={`w-2.5 h-2.5 rounded-full mt-2 shrink-0 ${cfg.dot}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <span className="font-bold">{a?.company ?? s.assessmentId.slice(0, 8)}</span>
                                        <span className={`text-xs ${(TIER_COLORS as any)[s.scoreTier]}`}>{(TIER_LABELS as any)[s.scoreTier]}</span>
                                        <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Etapa: {STAGE_LABELS[s.currentStage] ?? s.currentStage} · {sent} mensagens enviadas · Tel: {s.phone}
                                    </p>
                                    {s.nextAllowedAt && new Date(s.nextAllowedAt) > new Date() && (
                                        <p className="text-xs text-yellow-400/80 mt-0.5">
                                            Próxima mensagem: {new Date(s.nextAllowedAt).toLocaleDateString("pt-BR", { dateStyle: "short" })}
                                        </p>
                                    )}
                                </div>
                                {isAdmin && (
                                    <SequenceActions
                                        sequenceId={s.id}
                                        assessmentId={s.assessmentId}
                                        status={s.status}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2">
                        {page > 1 && <Link href={buildUrl({ page: String(page - 1) })} className="btn-secondary text-sm px-4 py-2">← Anterior</Link>}
                        <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
                        {page < totalPages && <Link href={buildUrl({ page: String(page + 1) })} className="btn-secondary text-sm px-4 py-2">Próxima →</Link>}
                    </div>
                )}
            </main>
        </div>
    );
}
