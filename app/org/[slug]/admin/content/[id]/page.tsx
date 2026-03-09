/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect, notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { getAuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ContentStatusBadge } from "../status-badge";
import { ContentReviewActions } from "./review-actions";
import { ChevronLeft, Copy } from "lucide-react";

export const runtime = "nodejs";

function isAgencyUiContentEnabled(): boolean {
    const raw = process.env.FF_AGENCY_UI_CONTENT;
    if (typeof raw === "undefined") return true;
    const normalized = raw.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

const TYPE_LABELS: Record<string, string> = {
    linkedin: "LinkedIn", instagram: "Instagram",
    case_breakdown: "Case Breakdown", authority_thread: "Thread", video_script: "Roteiro de Vídeo",
};

export default async function ContentDetailPage({
    params
}: { params: Promise<{ slug: string; id: string }> }) {
    const { slug, id } = await params;

    const auth = await getAuthContext();
    if (isAgencyUiContentEnabled() && auth.isAuthenticated && auth.authScope === "agency") {
        redirect(`/agency/content/${id}`);
    }

    let ctx: Awaited<ReturnType<typeof requireOrgContext>>;
    try {
        ctx = await requireOrgContext(slug);
        assertRole(ctx.role, "closer");
    } catch {
        redirect(`/org/${slug}/admin/login`);
    }

    const artifact = await (prisma as any).contentArtifact.findFirst({
        where: { id, organizationId: ctx!.orgId },
    });
    if (!artifact) notFound();

    const assessment = artifact.assessmentId
        ? await (prisma as any).assessment.findUnique({
            where: { id: artifact.assessmentId },
            select: { company: true, scoreTotal: true }
        })
        : null;

    const hashtags: string[] = (() => {
        try { return artifact.hashtags ? JSON.parse(artifact.hashtags) : []; }
        catch { return []; }
    })();

    const roiSnapshot = (() => {
        try { return artifact.roiSnapshot ? JSON.parse(artifact.roiSnapshot) : null; }
        catch { return null; }
    })();

    const isAdmin = ["owner", "admin"].includes(ctx!.role);

    return (
        <div className="min-h-screen bg-background">
            <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-40 px-6 py-3">
                <div className="max-w-4xl mx-auto flex items-center gap-4">
                    <Link href={`/org/${slug}/admin/content`}
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm">
                        <ChevronLeft className="w-4 h-4" /> Content Engine
                    </Link>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-sm font-medium">{TYPE_LABELS[artifact.type] ?? artifact.type}</span>
                    <ContentStatusBadge status={artifact.status} />
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
                {/* Header */}
                <div className="flex items-start gap-4 justify-between">
                    <div>
                        <h1 className="text-2xl font-black">{artifact.title}</h1>
                        {assessment && (
                            <p className="text-sm text-muted-foreground mt-1">
                                Origem: {assessment.company} · {assessment.scoreTotal}pts
                            </p>
                        )}
                        <p className="text-xs text-muted-foreground/60 mt-0.5">
                            v{artifact.version} · Gerado em {new Date(artifact.createdAt).toLocaleDateString("pt-BR", { dateStyle: "medium" })}
                        </p>
                    </div>
                    {isAdmin && (
                        <ContentReviewActions
                            artifactId={artifact.id}
                            status={artifact.status}
                        />
                    )}
                </div>

                {/* Source insight */}
                {artifact.sourceInsight && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                        <p className="text-xs text-primary/70 font-medium uppercase tracking-wider mb-1">Insight Central</p>
                        <p className="text-sm">{artifact.sourceInsight}</p>
                    </div>
                )}

                {/* Hook */}
                {artifact.hook && (
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Hook</p>
                        <p className="text-lg font-bold leading-snug">{artifact.hook}</p>
                    </div>
                )}

                {/* Body */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Conteúdo</p>
                        <CopyButton text={artifact.body} />
                    </div>
                    <div className="glass-panel rounded-xl border border-border/40 p-5 bg-muted/10">
                        <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">{artifact.body}</pre>
                    </div>
                </div>

                {/* CTA */}
                {artifact.cta && (
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">CTA</p>
                        <p className="text-sm italic text-muted-foreground border-l-2 border-primary/40 pl-3">{artifact.cta}</p>
                    </div>
                )}

                {/* Hashtags */}
                {hashtags.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Hashtags</p>
                        <div className="flex flex-wrap gap-2">
                            {hashtags.map((h: string) => (
                                <span key={h} className="text-xs px-2.5 py-1 rounded-full bg-muted/30 border border-border/30 text-muted-foreground">
                                    #{h.replace(/^#/, "")}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* ROI Snapshot */}
                {roiSnapshot && (
                    <div className="glass-panel rounded-xl border border-border/40 p-4 space-y-2">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">ROI usado na geração</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                                <p className="text-xs text-muted-foreground">Economia/ano</p>
                                <p className="font-bold">R$ {Math.round(roiSnapshot.operationalSavingsEstimate).toLocaleString("pt-BR")}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Receita/ano</p>
                                <p className="font-bold">R$ {Math.round(roiSnapshot.revenueIncreaseEstimate).toLocaleString("pt-BR")}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Horas/mês</p>
                                <p className="font-bold">{Math.round(roiSnapshot.monthlyHoursRecovered)}h</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Payback</p>
                                <p className="font-bold">{roiSnapshot.estimatedPaybackMonths} meses</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Audit trail */}
                <div className="text-xs text-muted-foreground/50 space-y-0.5 border-t border-border/30 pt-4">
                    {artifact.reviewedAt && <p>Revisado em {new Date(artifact.reviewedAt).toLocaleString("pt-BR")} por {artifact.reviewedBy ?? "admin"}</p>}
                    {artifact.approvedAt && <p>Aprovado em {new Date(artifact.approvedAt).toLocaleString("pt-BR")} por {artifact.approvedBy ?? "admin"}</p>}
                    {artifact.scheduledFor && <p>Agendado para {new Date(artifact.scheduledFor).toLocaleString("pt-BR")}</p>}
                    {artifact.postedAt && <p>Postado em {new Date(artifact.postedAt).toLocaleString("pt-BR")}</p>}
                </div>
            </main>
        </div>
    );
}

function CopyButton({ text }: { text: string }) {
    // Server component wrapper — we need client copying
    return (
        <button
            onClick={() => navigator?.clipboard?.writeText(text)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
            <Copy className="w-3 h-3" /> Copiar
        </button>
    );
}
