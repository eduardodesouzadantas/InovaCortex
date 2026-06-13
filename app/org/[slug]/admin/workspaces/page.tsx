/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth/session";
import { refreshOnboardingStatusFromTenant } from "@/lib/onboarding-status";
import Link from "next/link";
import { ChevronLeft, Briefcase, CheckCircle2, AlertTriangle, Zap, ArrowRight } from "lucide-react";
import { OnboardingStatusCard } from "./onboarding-status-card";

export const runtime = "nodejs";

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
    provisioning: { label: "Provisionando", color: "text-yellow-400", dot: "bg-yellow-400" },
    active: { label: "Ativo", color: "text-green-500", dot: "bg-green-500" },
    paused: { label: "Pausado", color: "text-gray-400", dot: "bg-gray-400" },
    completed: { label: "Completo", color: "text-blue-400", dot: "bg-blue-400" },
};

function isAgencyCommercialUiEnabled(): boolean {
    const raw = process.env.FF_AGENCY_COMMERCIAL_UI;
    if (typeof raw === "undefined") return true;
    const normalized = raw.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export default async function WorkspacesListPage({
    params
}: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    const auth = await getAuthContext();
    if (isAgencyCommercialUiEnabled() && auth.isAuthenticated && auth.authScope === "agency") {
        redirect("/agency/commercial/workspaces");
    }

    let ctx: Awaited<ReturnType<typeof requireOrgContext>>;
    try {
        ctx = await requireOrgContext(slug);
        assertRole(ctx.role, "closer");
    } catch {
        redirect(`/org/${slug}/admin/login`);
    }

    const workspaces = await (prisma as any).clientWorkspace.findMany({
        where: { organizationId: ctx!.orgId },
        include: {
            tasks: { select: { status: true } },
            checklist: { select: { status: true } },
        },
        orderBy: { createdAt: "desc" },
    });
    const onboarding = await refreshOnboardingStatusFromTenant(ctx!.orgId).catch(() => null);

    // Enrich with assessment data
    const assessmentIds = workspaces.map((ws: any) => ws.assessmentId);
    const assessments: any[] = assessmentIds.length > 0
        ? await (prisma as any).assessment.findMany({
            where: { id: { in: assessmentIds } },
            select: { id: true, company: true, scoreTotal: true, classification: true },
        })
        : [];
    const aMap: Record<string, any> = {};
    for (const a of assessments) aMap[a.id] = a;

    return (
        <div className="min-h-screen bg-background">
            <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-40 px-6 py-3">
                <div className="max-w-5xl mx-auto flex items-center gap-4">
                    <Link href={`/org/${slug}/admin`}
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm">
                        <ChevronLeft className="w-4 h-4" /> Mission Control
                    </Link>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="font-semibold text-sm flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4 text-primary" /> Workspaces de Clientes
                    </span>
                </div>
            </nav>

            <main className="max-w-5xl mx-auto px-6 py-8 space-y-4">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-black">Execução de Projetos</h1>
                    <p className="text-sm text-muted-foreground">{workspaces.length} workspaces</p>
                </div>

                {onboarding && (
                    <OnboardingStatusCard orgSlug={slug} onboarding={onboarding} />
                )}

                {workspaces.length === 0 && (
                    <div className="text-center py-20">
                        <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="text-muted-foreground">Nenhum workspace ainda.</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                            Workspaces são criados automaticamente quando uma proposta é aceita.
                        </p>
                    </div>
                )}

                {workspaces.map((ws: any) => {
                    const a = aMap[ws.assessmentId];
                    const st = STATUS_CONFIG[ws.status] ?? STATUS_CONFIG.provisioning;
                    const modules = JSON.parse(ws.modulesEnabled ?? "[]");
                    const tasksDone = ws.tasks.filter((t: any) => t.status === "done").length;
                    const tasksBlocked = ws.tasks.filter((t: any) => t.status === "blocked").length;
                    const checklistOK = ws.checklist.filter((c: any) => c.status === "verified").length;
                    const progress = ws.tasks.length > 0
                        ? Math.round((tasksDone / ws.tasks.length) * 100)
                        : 0;

                    return (
                        <Link key={ws.id} href={`/org/${slug}/admin/workspaces/${ws.id}`}
                            className="glass-panel rounded-2xl border border-border/50 p-5 flex gap-5 items-start hover:border-primary/30 transition-all group block"
                        >
                            {/* Status dot */}
                            <div className="w-3 h-3 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: st.dot.replace("bg-", "") }}>
                                <div className={`w-3 h-3 rounded-full ${st.dot} animate-pulse`} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                    <h3 className="font-bold text-lg">{a?.company ?? ws.assessmentId.slice(0, 8)}</h3>
                                    <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
                                    {a?.scoreTotal && (
                                        <span className="text-xs text-muted-foreground">{a.scoreTotal}pts</span>
                                    )}
                                </div>

                                {/* Modules */}
                                {modules.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {modules.map((m: string) => (
                                            <span key={m} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">
                                                {m.replace(/-/g, " ")}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Progress */}
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-24 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
                                        </div>
                                        <span>{progress}% tarefas</span>
                                    </div>
                                    {tasksBlocked > 0 && (
                                        <span className="flex items-center gap-1 text-red-400">
                                            <AlertTriangle className="w-3 h-3" /> {tasksBlocked} bloqueadas
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> {checklistOK}/{ws.checklist.length} checklist
                                    </span>
                                    {ws.goLiveAt && (
                                        <span className="flex items-center gap-1 text-green-500">
                                            <Zap className="w-3 h-3" /> Go-Live {new Date(ws.goLiveAt).toLocaleDateString("pt-BR")}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                        </Link>
                    );
                })}
            </main>
        </div>
    );
}
