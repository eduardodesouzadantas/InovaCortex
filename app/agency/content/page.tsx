/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ContentGenerateButton } from "@/app/org/[slug]/admin/content/generate-button";
import { ContentStatusBadge } from "@/app/org/[slug]/admin/content/status-badge";
import { ChevronLeft, Linkedin, Instagram, FileText, MessageSquare, Video, BarChart2, ExternalLink } from "lucide-react";

export const runtime = "nodejs";

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
    linkedin: { label: "LinkedIn", icon: Linkedin, color: "text-blue-400" },
    instagram: { label: "Instagram", icon: Instagram, color: "text-pink-400" },
    case_breakdown: { label: "Case Breakdown", icon: FileText, color: "text-green-400" },
    authority_thread: { label: "Thread", icon: MessageSquare, color: "text-yellow-400" },
    video_script: { label: "Roteiro de Video", icon: Video, color: "text-purple-400" },
};

const STATUS_ORDER = ["draft", "reviewed", "approved", "scheduled", "posted"];

export default async function AgencyContentPage({
    searchParams,
}: {
    searchParams: Promise<{ type?: string; status?: string; page?: string }>;
}) {
    const auth = await getAuthContext();
    if (!auth.isAuthenticated || auth.authScope !== "agency" || !auth.organizationId || !auth.role) {
        redirect("/agency/login");
    }

    const sp = await searchParams;
    const page = Math.max(1, Number(sp.page ?? 1));
    const take = 20;
    const where: any = { organizationId: auth.organizationId };
    if (sp.type) where.type = sp.type;
    if (sp.status) where.status = sp.status;

    const [artifacts, total, stats, recentAssessments] = await Promise.all([
        (prisma as any).contentArtifact.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * take,
            take,
        }),
        (prisma as any).contentArtifact.count({ where }),
        (prisma as any).contentArtifact.groupBy({
            by: ["status"],
            where: { organizationId: auth.organizationId },
            _count: { _all: true },
        }),
        (prisma as any).assessment.findMany({
            where: { organizationId: auth.organizationId },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { id: true, company: true, scoreTotal: true },
        }),
    ]);

    const totalPages = Math.ceil(total / take);
    const isAdmin = ["owner", "admin"].includes(auth.role);
    const statMap: Record<string, number> = {};
    for (const stat of stats) statMap[stat.status] = stat._count._all;

    function buildUrl(extra: Record<string, string>) {
        return `?${new URLSearchParams({
            ...(sp.type ? { type: sp.type } : {}),
            ...(sp.status ? { status: sp.status } : {}),
            ...extra,
        })}`;
    }

    return (
        <div className="min-h-screen bg-background">
            <nav className="sticky top-0 z-40 border-b border-border/50 bg-background/80 px-6 py-3 backdrop-blur-md">
                <div className="mx-auto flex max-w-6xl items-center gap-4">
                    <Link href="/agency/dashboard" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                        <ChevronLeft className="h-4 w-4" /> Agency
                    </Link>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                        <BarChart2 className="h-4 w-4 text-primary" /> Content Engine
                    </span>
                </div>
            </nav>

            <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black">Content Engine</h1>
                        <p className="mt-1 text-sm text-muted-foreground">{total} artefatos gerados</p>
                    </div>
                    {isAdmin && (
                        <ContentGenerateButton
                            assessments={recentAssessments}
                            apiBasePath="/api/agency/content"
                            detailBasePath="/agency/content"
                        />
                    )}
                </div>

                <div className="flex flex-wrap gap-2">
                    {STATUS_ORDER.map((status) => (
                        <Link
                            key={status}
                            href={buildUrl({ status, page: "1" })}
                            className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                                sp.status === status
                                    ? "border-primary/40 bg-primary/20 text-primary"
                                    : "border-border/40 text-muted-foreground hover:border-border"
                            }`}
                        >
                            {status} <span className="ml-1 opacity-60">{statMap[status] ?? 0}</span>
                        </Link>
                    ))}
                    {sp.status && (
                        <Link href={buildUrl({ page: "1" })} className="rounded-full border border-border/30 px-3 py-1.5 text-xs text-muted-foreground hover:border-border">
                            x limpar
                        </Link>
                    )}
                </div>

                <div className="flex flex-wrap gap-2">
                    {Object.entries(TYPE_CONFIG).map(([type, config]) => {
                        const Icon = config.icon;
                        return (
                            <Link
                                key={type}
                                href={buildUrl({ type, page: "1" })}
                                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all ${
                                    sp.type === type
                                        ? "border-primary/30 bg-primary/15"
                                        : "border-border/30 text-muted-foreground hover:border-border"
                                }`}
                            >
                                <Icon className={`h-3 w-3 ${config.color}`} /> {config.label}
                            </Link>
                        );
                    })}
                </div>

                <div className="space-y-3">
                    {artifacts.length === 0 && (
                        <div className="py-16 text-center text-muted-foreground">
                            <BarChart2 className="mx-auto mb-3 h-12 w-12 opacity-20" />
                            <p>Nenhum conteudo gerado ainda.</p>
                        </div>
                    )}
                    {artifacts.map((artifact: any) => {
                        const config = TYPE_CONFIG[artifact.type] ?? { label: artifact.type, icon: FileText, color: "text-muted-foreground" };
                        const Icon = config.icon;
                        return (
                            <Link
                                key={artifact.id}
                                href={`/agency/content/${artifact.id}`}
                                className="glass-panel group block items-start gap-4 rounded-xl border border-border/40 p-4 transition-all hover:border-primary/30"
                            >
                                <div className="flex gap-4">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/30">
                                        <Icon className={`h-4 w-4 ${config.color}`} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-0.5 flex flex-wrap items-center gap-2">
                                            <span className="truncate text-sm font-semibold">{artifact.title}</span>
                                            <ContentStatusBadge status={artifact.status} />
                                        </div>
                                        <p className="truncate text-xs text-muted-foreground">{artifact.sourceInsight}</p>
                                        <p className="mt-0.5 text-xs text-muted-foreground/50">
                                            {new Date(artifact.createdAt).toLocaleDateString("pt-BR")} · v{artifact.version}
                                        </p>
                                    </div>
                                    <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                                </div>
                            </Link>
                        );
                    })}
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2">
                        {page > 1 && (
                            <Link href={buildUrl({ page: String(page - 1) })} className="btn-secondary px-4 py-2 text-sm">
                                {"\u2190"} Anterior
                            </Link>
                        )}
                        <span className="text-sm text-muted-foreground">
                            Pagina {page} de {totalPages}
                        </span>
                        {page < totalPages && (
                            <Link href={buildUrl({ page: String(page + 1) })} className="btn-secondary px-4 py-2 text-sm">
                                Proxima {"\u2192"}
                            </Link>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
