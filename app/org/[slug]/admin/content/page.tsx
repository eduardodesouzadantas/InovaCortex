/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { getAuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ContentGenerateButton } from "./generate-button";
import { ContentStatusBadge } from "./status-badge";
import {
    ChevronLeft, Linkedin, Instagram, FileText,
    MessageSquare, Video, BarChart2, ExternalLink
} from "lucide-react";

export const runtime = "nodejs";

function isAgencyUiContentEnabled(): boolean {
    const raw = process.env.FF_AGENCY_UI_CONTENT;
    if (typeof raw === "undefined") return true;
    const normalized = raw.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
    linkedin: { label: "LinkedIn", icon: Linkedin, color: "text-blue-400" },
    instagram: { label: "Instagram", icon: Instagram, color: "text-pink-400" },
    case_breakdown: { label: "Case Breakdown", icon: FileText, color: "text-green-400" },
    authority_thread: { label: "Thread", icon: MessageSquare, color: "text-yellow-400" },
    video_script: { label: "Roteiro de Vídeo", icon: Video, color: "text-purple-400" },
};

const STATUS_ORDER = ["draft", "reviewed", "approved", "scheduled", "posted"];

export default async function ContentDashboardPage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ type?: string; status?: string; page?: string }>;
}) {
    const { slug } = await params;
    const sp = await searchParams;

    const auth = await getAuthContext();
    if (isAgencyUiContentEnabled() && auth.isAuthenticated && auth.authScope === "agency") {
        redirect("/agency/content");
    }

    let ctx: Awaited<ReturnType<typeof requireOrgContext>>;
    try {
        ctx = await requireOrgContext(slug);
        assertRole(ctx.role, "closer");
    } catch {
        redirect(`/org/${slug}/admin/login`);
    }

    const page = Math.max(1, Number(sp.page ?? 1));
    const take = 20;
    const where: any = { organizationId: ctx!.orgId };
    if (sp.type) where.type = sp.type;
    if (sp.status) where.status = sp.status;

    const [artifacts, total, stats] = await Promise.all([
        (prisma as any).contentArtifact.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * take,
            take,
        }),
        (prisma as any).contentArtifact.count({ where }),
        (prisma as any).contentArtifact.groupBy({
            by: ["status"],
            where: { organizationId: ctx!.orgId },
            _count: { _all: true },
        }),
    ]);

    const totalPages = Math.ceil(total / take);
    const isAdmin = ["owner", "admin"].includes(ctx!.role);

    // Recent assessments for context picker in generate button
    const recentAssessments = await (prisma as any).assessment.findMany({
        where: { organizationId: ctx!.orgId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, company: true, scoreTotal: true },
    });

    function buildUrl(extra: Record<string, string>) {
        return `?${new URLSearchParams({ ...(sp.type ? { type: sp.type } : {}), ...(sp.status ? { status: sp.status } : {}), ...extra })}`;
    }

    const statMap: Record<string, number> = {};
    for (const s of stats) statMap[s.status] = s._count._all;

    return (
        <div className="min-h-screen bg-background">
            <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-40 px-6 py-3">
                <div className="max-w-6xl mx-auto flex items-center gap-4">
                    <Link href={`/org/${slug}/admin`}
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm">
                        <ChevronLeft className="w-4 h-4" /> Mission Control
                    </Link>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="font-semibold text-sm flex items-center gap-1.5">
                        <BarChart2 className="w-4 h-4 text-primary" /> Content Engine
                    </span>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
                {/* Header + Generate button */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-black">Content Engine</h1>
                        <p className="text-muted-foreground text-sm mt-1">{total} artefatos gerados</p>
                    </div>
                    {isAdmin && (
                        <ContentGenerateButton
                            assessments={recentAssessments}
                            orgSlug={slug}
                        />
                    )}
                </div>

                {/* Status pipeline */}
                <div className="flex gap-2 flex-wrap">
                    {STATUS_ORDER.map(s => (
                        <Link key={s} href={buildUrl({ status: s, page: "1" })}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${sp.status === s ? "bg-primary/20 border-primary/40 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}
                        >
                            {s} <span className="ml-1 opacity-60">{statMap[s] ?? 0}</span>
                        </Link>
                    ))}
                    {sp.status && (
                        <Link href={buildUrl({ page: "1" })} className="text-xs px-3 py-1.5 rounded-full border border-border/30 text-muted-foreground hover:border-border">
                            ✕ limpar
                        </Link>
                    )}
                </div>

                {/* Type filter */}
                <div className="flex gap-2 flex-wrap">
                    {Object.entries(TYPE_CONFIG).map(([t, cfg]) => {
                        const Icon = cfg.icon;
                        return (
                            <Link key={t} href={buildUrl({ type: t, page: "1" })}
                                className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-1.5 transition-all ${sp.type === t ? "bg-primary/15 border-primary/30" : "border-border/30 text-muted-foreground hover:border-border"}`}>
                                <Icon className={`w-3 h-3 ${cfg.color}`} /> {cfg.label}
                            </Link>
                        );
                    })}
                </div>

                {/* Content list */}
                <div className="space-y-3">
                    {artifacts.length === 0 && (
                        <div className="text-center py-16 text-muted-foreground">
                            <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>Nenhum conteúdo gerado ainda.</p>
                            <p className="text-xs mt-1 opacity-60">Use o botão &quot;Gerar Conteúdo&quot; para criar o primeiro artefato.</p>
                        </div>
                    )}
                    {artifacts.map((a: any) => {
                        const cfg = TYPE_CONFIG[a.type] ?? { label: a.type, icon: FileText, color: "text-muted-foreground" };
                        const Icon = cfg.icon;

                        return (
                            <Link key={a.id} href={`/org/${slug}/admin/content/${a.id}`}
                                className="glass-panel rounded-xl border border-border/40 p-4 flex items-start gap-4 hover:border-primary/30 transition-all group block">
                                <div className={`w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center shrink-0`}>
                                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                        <span className="font-semibold text-sm truncate">{a.title}</span>
                                        <ContentStatusBadge status={a.status} />
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">{a.sourceInsight}</p>
                                    <p className="text-xs text-muted-foreground/50 mt-0.5">
                                        {new Date(a.createdAt).toLocaleDateString("pt-BR")} · v{a.version}
                                        {a.scheduledFor && ` · Agendado: ${new Date(a.scheduledFor).toLocaleDateString("pt-BR")}`}
                                        {a.postedAt && ` · Postado: ${new Date(a.postedAt).toLocaleDateString("pt-BR")}`}
                                    </p>
                                </div>
                                <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
                            </Link>
                        );
                    })}
                </div>

                {/* Pagination */}
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

