/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth/session";
import { ChevronLeft, Briefcase, CheckCircle2, AlertTriangle, Zap, ArrowRight } from "lucide-react";

export const runtime = "nodejs";

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
    provisioning: { label: "Provisionando", color: "text-yellow-400", dot: "bg-yellow-400" },
    active: { label: "Ativo", color: "text-green-500", dot: "bg-green-500" },
    paused: { label: "Pausado", color: "text-gray-400", dot: "bg-gray-400" },
    completed: { label: "Completo", color: "text-blue-400", dot: "bg-blue-400" },
};

export default async function AgencyWorkspacesListPage() {
    const auth = await getAuthContext();
    if (!auth.isAuthenticated || auth.authScope !== "agency" || !auth.organizationId) {
        redirect("/agency/login");
    }

    const workspaces = await (prisma as any).clientWorkspace.findMany({
        where: { organizationId: auth.organizationId },
        include: {
            tasks: { select: { status: true } },
            checklist: { select: { status: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    const assessmentIds = workspaces.map((workspace: any) => workspace.assessmentId);
    const assessments: any[] = assessmentIds.length > 0
        ? await (prisma as any).assessment.findMany({
            where: { id: { in: assessmentIds } },
            select: { id: true, company: true, scoreTotal: true, classification: true },
        })
        : [];
    const assessmentMap: Record<string, any> = {};
    for (const assessment of assessments) assessmentMap[assessment.id] = assessment;

    return (
        <div className="min-h-screen bg-background">
            <nav className="sticky top-0 z-40 border-b border-border/50 bg-background/80 px-6 py-3 backdrop-blur-md">
                <div className="mx-auto flex max-w-5xl items-center gap-4">
                    <Link href="/agency/commercial/leads" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                        <ChevronLeft className="h-4 w-4" /> Pipeline comercial
                    </Link>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                        <Briefcase className="h-4 w-4 text-primary" /> Workspaces
                    </span>
                </div>
            </nav>

            <main className="mx-auto max-w-5xl space-y-4 px-6 py-8">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-black">Execucao de Projetos</h1>
                    <p className="text-sm text-muted-foreground">{workspaces.length} workspaces</p>
                </div>

                {workspaces.length === 0 && (
                    <div className="py-20 text-center">
                        <Briefcase className="mx-auto mb-3 h-12 w-12 opacity-20" />
                        <p className="text-muted-foreground">Nenhum workspace ainda.</p>
                        <p className="mt-1 text-xs text-muted-foreground/60">
                            Workspaces sao criados automaticamente quando uma proposta e aceita.
                        </p>
                    </div>
                )}

                {workspaces.map((workspace: any) => {
                    const assessment = assessmentMap[workspace.assessmentId];
                    const status = STATUS_CONFIG[workspace.status] ?? STATUS_CONFIG.provisioning;
                    const modules = JSON.parse(workspace.modulesEnabled ?? "[]");
                    const tasksDone = workspace.tasks.filter((task: any) => task.status === "done").length;
                    const tasksBlocked = workspace.tasks.filter((task: any) => task.status === "blocked").length;
                    const checklistOk = workspace.checklist.filter((item: any) => item.status === "verified").length;
                    const progress = workspace.tasks.length > 0 ? Math.round((tasksDone / workspace.tasks.length) * 100) : 0;

                    return (
                        <Link
                            key={workspace.id}
                            href={`/agency/commercial/workspaces/${workspace.id}`}
                            className="glass-panel group block items-start gap-5 rounded-2xl border border-border/50 p-5 transition-all hover:border-primary/30"
                        >
                            <div className="flex gap-5">
                                <div className="mt-1.5 h-3 w-3 shrink-0 rounded-full">
                                    <div className={`h-3 w-3 animate-pulse rounded-full ${status.dot}`} />
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="mb-2 flex items-center gap-3">
                                        <h3 className="text-lg font-bold">{assessment?.company ?? workspace.assessmentId.slice(0, 8)}</h3>
                                        <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                                        {assessment?.scoreTotal && (
                                            <span className="text-xs text-muted-foreground">{assessment.scoreTotal}pts</span>
                                        )}
                                    </div>

                                    {modules.length > 0 && (
                                        <div className="mb-3 flex flex-wrap gap-1.5">
                                            {modules.map((module: string) => (
                                                <span
                                                    key={module}
                                                    className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs text-primary"
                                                >
                                                    {module.replace(/-/g, " ")}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1.5">
                                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted/40">
                                                <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                                            </div>
                                            <span>{progress}% tarefas</span>
                                        </div>
                                        {tasksBlocked > 0 && (
                                            <span className="flex items-center gap-1 text-red-400">
                                                <AlertTriangle className="h-3 w-3" /> {tasksBlocked} bloqueadas
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1">
                                            <CheckCircle2 className="h-3 w-3" /> {checklistOk}/{workspace.checklist.length} checklist
                                        </span>
                                        {workspace.goLiveAt && (
                                            <span className="flex items-center gap-1 text-green-500">
                                                <Zap className="h-3 w-3" /> Go-Live {new Date(workspace.goLiveAt).toLocaleDateString("pt-BR")}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                            </div>
                        </Link>
                    );
                })}
            </main>
        </div>
    );
}
