import { redirect, notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { WorkspaceTaskBoard } from "./task-board";
import { WorkspaceChecklist } from "./checklist";
import { ChevronLeft, Briefcase, Zap, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

export const runtime = "nodejs";

const PHASE_ORDER = ["setup", "development", "launch", "handoff"];
const PHASE_LABELS: Record<string, string> = {
    setup: "Setup",
    development: "Desenvolvimento",
    launch: "Go-Live",
    handoff: "Handoff",
};

export default async function WorkspaceDetailPage({
    params
}: { params: Promise<{ slug: string; id: string }> }) {
    const { slug, id } = await params;

    let ctx: Awaited<ReturnType<typeof requireOrgContext>>;
    try {
        ctx = await requireOrgContext(slug);
        assertRole(ctx.role, "closer");
    } catch {
        redirect(`/org/${slug}/admin/login`);
    }

    const workspace = await (prisma as any).clientWorkspace.findFirst({
        where: { id, organizationId: ctx!.orgId },
        include: {
            tasks: { orderBy: [{ phase: "asc" }, { orderIndex: "asc" }] },
            checklist: { orderBy: [{ system: "asc" }] },
        }
    });

    if (!workspace) notFound();

    const assessment = await (prisma as any).assessment.findUnique({
        where: { id: workspace.assessmentId },
        select: { company: true, scoreTotal: true, classification: true },
    });

    const roiRow = await (prisma as any).roiProjection.findUnique({
        where: { assessmentId: workspace.assessmentId }
    });

    const tasksDone = workspace.tasks.filter((t: any) => t.status === "done").length;
    const tasksBlocked = workspace.tasks.filter((t: any) => t.status === "blocked").length;
    const progress = workspace.tasks.length > 0
        ? Math.round((tasksDone / workspace.tasks.length) * 100)
        : 0;

    const modules: string[] = JSON.parse(workspace.modulesEnabled ?? "[]");

    // Group tasks by phase
    const tasksByPhase: Record<string, any[]> = {};
    for (const phase of PHASE_ORDER) {
        tasksByPhase[phase] = workspace.tasks.filter((t: any) => t.phase === phase);
    }

    const isAdmin = ["owner", "admin"].includes(ctx!.role);

    return (
        <div className="min-h-screen bg-background">
            <nav className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-40 px-6 py-3">
                <div className="max-w-6xl mx-auto flex items-center gap-4">
                    <Link href={`/org/${slug}/admin/workspaces`}
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm">
                        <ChevronLeft className="w-4 h-4" /> Workspaces
                    </Link>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="font-semibold">{assessment?.company ?? "Workspace"}</span>
                    <span className={`ml-auto text-xs px-2.5 py-1 rounded-full font-medium ${workspace.status === "active" ? "bg-green-500/15 text-green-400 border border-green-500/20" : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"}`}>
                        {workspace.status}
                    </span>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
                {/* Header metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: "Progresso", value: `${progress}%`, icon: <CheckCircle2 className="w-4 h-4 text-green-500" /> },
                        { label: "Bloqueadas", value: tasksBlocked, icon: <AlertTriangle className={`w-4 h-4 ${tasksBlocked > 0 ? "text-red-400" : "text-muted-foreground"}`} /> },
                        { label: "ROI estimado", value: roiRow ? `R$ ${((roiRow.operationalSavingsEstimate + roiRow.revenueIncreaseEstimate) / 12).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} /mês` : "—", icon: <Zap className="w-4 h-4 text-yellow-500" /> },
                        { label: "Módulos", value: modules.length, icon: <Briefcase className="w-4 h-4 text-primary" /> },
                    ].map(c => (
                        <div key={c.label} className="glass-panel rounded-xl border border-border/50 p-4 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center">{c.icon}</div>
                            <div>
                                <p className="text-xs text-muted-foreground">{c.label}</p>
                                <p className="font-bold">{c.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Go-Live button */}
                {workspace.status === "provisioning" && isAdmin && (
                    <form action={`/api/admin/workspaces/${workspace.id}/golive`} method="post">
                        <button type="submit"
                            className="w-full md:w-auto btn-primary flex items-center gap-2 justify-center">
                            <Zap className="w-4 h-4" /> Marcar Go-Live
                        </button>
                    </form>
                )}
                {workspace.goLiveAt && (
                    <p className="text-sm text-green-500 flex items-center gap-1.5">
                        <Zap className="w-4 h-4" /> Go-Live em {new Date(workspace.goLiveAt).toLocaleDateString("pt-BR")}
                    </p>
                )}

                {/* Task Board — by phase */}
                <div>
                    <h2 className="text-xl font-bold mb-4">Tarefas de Implementação</h2>
                    {PHASE_ORDER.map(phase => {
                        const phaseTasks = tasksByPhase[phase];
                        if (phaseTasks.length === 0) return null;
                        const done = phaseTasks.filter((t: any) => t.status === "done").length;
                        return (
                            <div key={phase} className="mb-6">
                                <div className="flex items-center gap-3 mb-3">
                                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                                        {PHASE_LABELS[phase]}
                                    </h3>
                                    <span className="text-xs text-muted-foreground">{done}/{phaseTasks.length}</span>
                                    <div className="flex-1 h-px bg-border/40" />
                                </div>
                                <WorkspaceTaskBoard
                                    tasks={phaseTasks}
                                    workspaceId={workspace.id}
                                    canEdit={ctx!.role !== "viewer"}
                                />
                            </div>
                        );
                    })}
                </div>

                {/* Integration Checklist */}
                <div>
                    <h2 className="text-xl font-bold mb-4">Checklist de Integrações</h2>
                    <WorkspaceChecklist
                        items={workspace.checklist}
                        workspaceId={workspace.id}
                        canEdit={isAdmin}
                    />
                </div>
            </main>
        </div>
    );
}
