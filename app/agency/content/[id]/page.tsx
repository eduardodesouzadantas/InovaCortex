/* eslint-disable @typescript-eslint/no-explicit-any */
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ContentStatusBadge } from "@/app/org/[slug]/admin/content/status-badge";
import { ContentReviewActions } from "@/app/org/[slug]/admin/content/[id]/review-actions";
import { ChevronLeft } from "lucide-react";

export const runtime = "nodejs";

const TYPE_LABELS: Record<string, string> = {
    linkedin: "LinkedIn",
    instagram: "Instagram",
    case_breakdown: "Case Breakdown",
    authority_thread: "Thread",
    video_script: "Roteiro de Video",
};

export default async function AgencyContentDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const auth = await getAuthContext();
    if (!auth.isAuthenticated || auth.authScope !== "agency" || !auth.organizationId || !auth.role) {
        redirect("/agency/login");
    }

    const { id } = await params;
    const artifact = await (prisma as any).contentArtifact.findFirst({
        where: { id, organizationId: auth.organizationId },
    });
    if (!artifact) notFound();

    const assessment = artifact.assessmentId
        ? await (prisma as any).assessment.findUnique({
            where: { id: artifact.assessmentId },
            select: { company: true, scoreTotal: true },
        })
        : null;

    const hashtags: string[] = (() => {
        try {
            return artifact.hashtags ? JSON.parse(artifact.hashtags) : [];
        } catch {
            return [];
        }
    })();

    const roiSnapshot = (() => {
        try {
            return artifact.roiSnapshot ? JSON.parse(artifact.roiSnapshot) : null;
        } catch {
            return null;
        }
    })();

    const isAdmin = ["owner", "admin"].includes(auth.role);

    return (
        <div className="min-h-screen bg-background">
            <nav className="sticky top-0 z-40 border-b border-border/50 bg-background/80 px-6 py-3 backdrop-blur-md">
                <div className="mx-auto flex max-w-4xl items-center gap-4">
                    <Link href="/agency/content" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                        <ChevronLeft className="h-4 w-4" /> Content Engine
                    </Link>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-sm font-medium">{TYPE_LABELS[artifact.type] ?? artifact.type}</span>
                    <ContentStatusBadge status={artifact.status} />
                </div>
            </nav>

            <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black">{artifact.title}</h1>
                        {assessment && (
                            <p className="mt-1 text-sm text-muted-foreground">
                                Origem: {assessment.company} · {assessment.scoreTotal}pts
                            </p>
                        )}
                        <p className="mt-0.5 text-xs text-muted-foreground/60">
                            v{artifact.version} · Gerado em {new Date(artifact.createdAt).toLocaleDateString("pt-BR", { dateStyle: "medium" })}
                        </p>
                    </div>
                    {isAdmin && (
                        <ContentReviewActions
                            artifactId={artifact.id}
                            status={artifact.status}
                            apiBasePath="/api/agency/content"
                        />
                    )}
                </div>

                {artifact.sourceInsight && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-primary/70">Insight Central</p>
                        <p className="text-sm">{artifact.sourceInsight}</p>
                    </div>
                )}

                {artifact.hook && (
                    <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Hook</p>
                        <p className="text-lg font-bold leading-snug">{artifact.hook}</p>
                    </div>
                )}

                <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Conteudo</p>
                    <div className="glass-panel rounded-xl border border-border/40 bg-muted/10 p-5">
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{artifact.body}</pre>
                    </div>
                </div>

                {artifact.cta && (
                    <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">CTA</p>
                        <p className="border-l-2 border-primary/40 pl-3 text-sm italic text-muted-foreground">{artifact.cta}</p>
                    </div>
                )}

                {hashtags.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Hashtags</p>
                        <div className="flex flex-wrap gap-2">
                            {hashtags.map((hashtag: string) => (
                                <span key={hashtag} className="rounded-full border border-border/30 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground">
                                    #{hashtag.replace(/^#/, "")}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {roiSnapshot && (
                    <div className="glass-panel space-y-2 rounded-xl border border-border/40 p-4">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">ROI usado na geracao</p>
                        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Economia/ano</p>
                                <p className="font-bold">R$ {Math.round(roiSnapshot.operationalSavingsEstimate).toLocaleString("pt-BR")}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Receita/ano</p>
                                <p className="font-bold">R$ {Math.round(roiSnapshot.revenueIncreaseEstimate).toLocaleString("pt-BR")}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Horas/mes</p>
                                <p className="font-bold">{Math.round(roiSnapshot.monthlyHoursRecovered)}h</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Payback</p>
                                <p className="font-bold">{roiSnapshot.estimatedPaybackMonths} meses</p>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
