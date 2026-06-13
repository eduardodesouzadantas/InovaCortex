/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth/session";
import { WorkspaceTaskBoard } from "@/app/org/[slug]/admin/workspaces/[id]/task-board";
import { WorkspaceChecklist } from "@/app/org/[slug]/admin/workspaces/[id]/checklist";
import { refreshOnboardingStatusFromTenant, getTenantReadinessFromOnboarding } from "@/lib/onboarding-status";
import { TenantReadinessBanner } from "@/components/go-live/tenant-readiness-banner";
import { getOrganizationAccountStatus } from "@/lib/billing/account-status";
import { ChevronLeft, Briefcase, Zap, CheckCircle2, AlertTriangle } from "lucide-react";

export const runtime = "nodejs";

const PHASE_ORDER = ["setup", "development", "launch", "handoff"];
const PHASE_LABELS: Record<string, string> = {
    setup: "Setup",
    development: "Desenvolvimento",
    launch: "Go-Live",
    handoff: "Handoff",
};

export default async function AgencyWorkspaceDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const auth = await getAuthContext();
    if (!auth.isAuthenticated || auth.authScope !== "agency" || !auth.organizationId || !auth.role) {
        redirect("/agency/login");
    }

    const { id } = await params;
    const workspace = await (prisma as any).clientWorkspace.findFirst({
        where: { id, organizationId: auth.organizationId },
        include: {
            tasks: { orderBy: [{ phase: "asc" }, { orderIndex: "asc" }] },
            checklist: { orderBy: [{ system: "asc" }] },
        },
    });

    if (!workspace) notFound();

    const assessment = await (prisma as any).assessment.findUnique({
        where: { id: workspace.assessmentId },
        select: { company: true, scoreTotal: true, classification: true },
    });

    const roiRow = await (prisma as any).roiProjection.findUnique({
        where: { assessmentId: workspace.assessmentId },
    });
    const onboarding = await refreshOnboardingStatusFromTenant(auth.organizationId).catch(() => null);
    const readiness = onboarding ? getTenantReadinessFromOnboarding(onboarding) : null;
    const billingStatus = await getOrganizationAccountStatus(auth.organizationId);

    const tasksDone = workspace.tasks.filter((task: any) => task.status === "done").length;
    const tasksBlocked = workspace.tasks.filter((task: any) => task.status === "blocked").length;
    const progress = workspace.tasks.length > 0 ? Math.round((tasksDone / workspace.tasks.length) * 100) : 0;

    const modules: string[] = JSON.parse(workspace.modulesEnabled ?? "[]");

    const tasksByPhase: Record<string, any[]> = {};
    for (const phase of PHASE_ORDER) {
        tasksByPhase[phase] = workspace.tasks.filter((task: any) => task.phase === phase);
    }

    const isAdmin = ["owner", "admin"].includes(auth.role);

    return (
        <div className="min-h-screen bg-background">
            <nav className="sticky top-0 z-40 border-b border-border/50 bg-background/80 px-6 py-3 backdrop-blur-md">
                <div className="mx-auto flex max-w-6xl items-center gap-4">
                    <Link href="/agency/commercial/workspaces" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                        <ChevronLeft className="h-4 w-4" /> Workspaces
                    </Link>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="font-semibold">{assessment?.company ?? "Workspace"}</span>
                    <span
                        className={`ml-auto rounded-full px-2.5 py-1 text-xs font-medium ${
                            workspace.status === "active"
                                ? "border border-green-500/20 bg-green-500/15 text-green-400"
                                : "border border-yellow-500/20 bg-yellow-500/10 text-yellow-400"
                        }`}
                    >
                        {workspace.status}
                    </span>
                </div>
            </nav>

            <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {[
                        { label: "Progresso", value: `${progress}%`, icon: <CheckCircle2 className="h-4 w-4 text-green-500" /> },
                        {
                            label: "Bloqueadas",
                            value: tasksBlocked,
                            icon: <AlertTriangle className={`h-4 w-4 ${tasksBlocked > 0 ? "text-red-400" : "text-muted-foreground"}`} />,
                        },
                        {
                            label: "ROI estimado",
                            value: roiRow
                                ? `R$ ${((roiRow.operationalSavingsEstimate + roiRow.revenueIncreaseEstimate) / 12).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} /mes`
                                : "—",
                            icon: <Zap className="h-4 w-4 text-yellow-500" />,
                        },
                        { label: "Modulos", value: modules.length, icon: <Briefcase className="h-4 w-4 text-primary" /> },
                    ].map((card) => (
                        <div key={card.label} className="glass-panel flex items-center gap-3 rounded-xl border border-border/50 p-4">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/30">{card.icon}</div>
                            <div>
                                <p className="text-xs text-muted-foreground">{card.label}</p>
                                <p className="font-bold">{card.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {readiness && (
                    <TenantReadinessBanner slug={auth.organizationSlug ?? "inovacortex"} readiness={readiness} />
                )}

                {workspace.status === "provisioning" && isAdmin && (
                    readiness?.ready && billingStatus !== "suspended" ? (
                        <form action={`/api/agency/commercial/workspaces/${workspace.id}/golive`} method="post">
                            <button type="submit" className="btn-primary flex w-full items-center justify-center gap-2 md:w-auto">
                                <Zap className="h-4 w-4" /> Marcar Go-Live
                            </button>
                        </form>
                    ) : (
                        <button
                            type="button"
                            disabled
                            className="btn-primary flex w-full cursor-not-allowed items-center justify-center gap-2 opacity-60 md:w-auto"
                            title="Complete o email, a pipeline e o primeiro contato/deal antes do go-live."
                        >
                            <Zap className="h-4 w-4" /> Marcar Go-Live
                        </button>
                    )
                )}
                {workspace.goLiveAt && (
                    <p className="flex items-center gap-1.5 text-sm text-green-500">
                        <Zap className="h-4 w-4" /> Go-Live em {new Date(workspace.goLiveAt).toLocaleDateString("pt-BR")}
                    </p>
                )}

                <div>
                    <h2 className="mb-4 text-xl font-bold">Tarefas de implementacao</h2>
                    {PHASE_ORDER.map((phase) => {
                        const phaseTasks = tasksByPhase[phase];
                        if (phaseTasks.length === 0) return null;
                        const done = phaseTasks.filter((task: any) => task.status === "done").length;
                        return (
                            <div key={phase} className="mb-6">
                                <div className="mb-3 flex items-center gap-3">
                                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{PHASE_LABELS[phase]}</h3>
                                    <span className="text-xs text-muted-foreground">
                                        {done}/{phaseTasks.length}
                                    </span>
                                    <div className="h-px flex-1 bg-border/40" />
                                </div>
                                <WorkspaceTaskBoard
                                    tasks={phaseTasks}
                                    workspaceId={workspace.id}
                                    canEdit={auth.role !== "viewer"}
                                    apiBasePath="/api/agency/commercial/workspaces"
                                />
                            </div>
                        );
                    })}
                </div>

                <div>
                    <h2 className="mb-4 text-xl font-bold">Checklist de integracoes</h2>
                    <WorkspaceChecklist
                        items={workspace.checklist}
                        workspaceId={workspace.id}
                        canEdit={isAdmin}
                        apiBasePath="/api/agency/commercial/workspaces"
                    />
                </div>
            </main>
        </div>
    );
}
