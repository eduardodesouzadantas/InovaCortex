import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
    CheckCircle2, Clock, AlertTriangle, Folder, MessageSquare,
    UploadCloud, BookOpen, Zap
} from "lucide-react";
import { ChecklistItem } from "./checklist-item";
import { UploadCenter } from "./upload-center";
import { TaskComment } from "./task-comment";

export const runtime = "nodejs";

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskStatus = "todo" | "doing" | "blocked" | "done";

const STATUS_META: Record<TaskStatus, { label: string; color: string; Icon: any }> = {
    done: { label: "Concluída", color: "text-green-500", Icon: CheckCircle2 },
    doing: { label: "Em andamento", color: "text-blue-400", Icon: Zap },
    blocked: { label: "Bloqueada", color: "text-red-400", Icon: AlertTriangle },
    todo: { label: "Aguardando", color: "text-muted-foreground", Icon: Clock },
};

function phaseLabel(p: string) {
    return { setup: "Setup", development: "Desenvolvimento", launch: "Lançamento", handoff: "Entrega" }[p] ?? p;
}

// ─── Progress Calculator ──────────────────────────────────────────────────────

function calcProgress(tasks: any[], checklist: any[]) {
    const taskDone = tasks.filter(t => t.status === "done").length;
    const checkDone = checklist.filter(c => c.status !== "pending").length;
    const total = tasks.length + checklist.length;
    if (total === 0) return 0;
    return Math.round(((taskDone + checkDone) / total) * 100);
}

function currentPhase(tasks: any[]): string {
    const active = tasks.find(t => t.status === "doing");
    if (active) return phaseLabel(active.phase);
    const next = tasks.find(t => t.status !== "done");
    if (next) return phaseLabel(next.phase);
    return "Concluído";
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function ClientPortalPage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string; workspaceId: string }>;
    searchParams: Promise<{ t?: string }>;
}) {
    const { workspaceId } = await params;
    const { t: token } = await searchParams;

    if (!token) return notFound();

    // Load workspace (token-gated)
    const ws = await (prisma as any).clientWorkspace.findFirst({
        where: { id: workspaceId, workspacePublicToken: token },
        include: {
            tasks: { orderBy: { orderIndex: "asc" } },
            checklist: { orderBy: { createdAt: "asc" } },
            uploads: { orderBy: { createdAt: "desc" } },
            comments: { orderBy: { createdAt: "desc" }, take: 50 },
        },
    });

    if (!ws) return notFound();

    // Audit portalViewed non-blocking
    (prisma as any).auditEvent.create({
        data: {
            organizationId: ws.organizationId,
            action: "clientPortalViewed",
            userId: "client:portal",
            resourceType: "client_workspace",
            resourceId: workspaceId,
            details: JSON.stringify({ workspaceId }),
            ipAddress: "client",
        },
    }).catch(() => null);

    const progress = calcProgress(ws.tasks, ws.checklist);
    const phase = currentPhase(ws.tasks);
    const pendingChecklist = ws.checklist.filter((c: any) => c.status === "pending").length;

    // Group checklist by system
    const checklistBySystem: Record<string, any[]> = {};
    for (const item of ws.checklist) {
        if (!checklistBySystem[item.system]) checklistBySystem[item.system] = [];
        checklistBySystem[item.system].push(item);
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Header */}
            <header className="border-b border-border/40 bg-background/90 backdrop-blur-sm sticky top-0 z-50">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                            <Zap className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <p className="font-black text-sm leading-none">InovaCortex</p>
                            <p className="text-xs text-muted-foreground">Portal do Cliente</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ws.status === "active" ? "bg-green-500/20 text-green-500" :
                                ws.status === "provisioning_hold" ? "bg-yellow-400/20 text-yellow-400" :
                                    "bg-blue-400/20 text-blue-400"}`}>
                            {ws.status === "active" ? "Ativo" : ws.status === "provisioning_hold" ? "Aguard. Pagamento" : "Em Implantação"}
                        </span>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">

                {/* ── Section 1: Project Status ────────────────────────────── */}
                <section>
                    <div className="glass-panel rounded-2xl border border-primary/20 bg-primary/5 p-8">
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <h1 className="text-2xl font-black mb-1">Seu Projeto</h1>
                                <p className="text-muted-foreground text-sm">
                                    Fase atual: <span className="font-semibold text-foreground">{phase}</span>
                                    {pendingChecklist > 0 && (
                                        <span className="ml-3 text-yellow-400">
                                            · {pendingChecklist} item(ns) aguardando sua ação
                                        </span>
                                    )}
                                </p>
                            </div>
                            <div className="text-center shrink-0">
                                <div className="text-4xl font-black text-primary">{progress}%</div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider">Progresso</div>
                            </div>
                        </div>

                        {/* Progress bar */}
                        <div className="h-2.5 bg-primary/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-700"
                                style={{ width: `${progress}%` }}
                            />
                        </div>

                        {/* Phase chips */}
                        <div className="flex flex-wrap gap-2 mt-5">
                            {["setup", "development", "launch", "handoff"].map(p => {
                                const tasks = ws.tasks.filter((t: any) => t.phase === p);
                                const done = tasks.filter((t: any) => t.status === "done").length;
                                const active = tasks.some((t: any) => t.status === "doing");
                                return tasks.length > 0 ? (
                                    <div key={p} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${active ? "border-primary/50 bg-primary/10 text-primary" :
                                            done === tasks.length ? "border-green-500/30 bg-green-500/10 text-green-500" :
                                                "border-border/50 bg-muted/30 text-muted-foreground"}`}>
                                        {done === tasks.length ? <CheckCircle2 className="w-3 h-3" /> : active ? <Zap className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                        {phaseLabel(p)} ({done}/{tasks.length})
                                    </div>
                                ) : null;
                            })}
                        </div>
                    </div>
                </section>

                {/* ── Section 2: Integration Checklist ───────────────────────── */}
                {ws.checklist.length > 0 && (
                    <section>
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-primary" />
                            Checklist de Integrações
                        </h2>
                        <div className="space-y-4">
                            {Object.entries(checklistBySystem).map(([system, items]) => (
                                <div key={system} className="glass-panel rounded-xl border border-border/40 overflow-hidden">
                                    <div className="px-5 py-3 bg-muted/30 border-b border-border/40 flex items-center justify-between">
                                        <span className="font-semibold text-sm">{system}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {(items as any[]).filter(i => i.status !== "pending").length}/{(items as any[]).length} concluídos
                                        </span>
                                    </div>
                                    <ul className="divide-y divide-border/30">
                                        {(items as any[]).map(item => (
                                            <ChecklistItem
                                                key={item.id}
                                                item={item}
                                                workspaceId={workspaceId}
                                                token={token}
                                            />
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ── Section 3: Upload Center ────────────────────────────── */}
                <section>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <UploadCloud className="w-4 h-4 text-primary" />
                        Centro de Envio de Arquivos
                    </h2>
                    <UploadCenter
                        workspaceId={workspaceId}
                        token={token}
                        existingUploads={ws.uploads.map((u: any) => ({
                            id: u.id,
                            filename: u.filename,
                            type: u.type,
                            url: u.url,
                            createdAt: u.createdAt.toISOString(),
                        }))}
                    />
                </section>

                {/* ── Section 4: Tasks + Comments ────────────────────────── */}
                {ws.tasks.length > 0 && (
                    <section>
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Folder className="w-4 h-4 text-primary" />
                            Andamento das Tarefas
                        </h2>
                        <div className="space-y-3">
                            {ws.tasks.map((task: any) => {
                                const meta = STATUS_META[task.status as TaskStatus] ?? STATUS_META.todo;
                                const { Icon } = meta;
                                const taskComments = ws.comments.filter((c: any) => c.taskId === task.id);

                                return (
                                    <div key={task.id} className="glass-panel rounded-xl border border-border/40 p-5">
                                        <div className="flex items-start justify-between gap-4 mb-3">
                                            <div>
                                                <p className="font-semibold text-sm">{task.title}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                                            </div>
                                            <span className={`flex items-center gap-1 text-xs font-semibold shrink-0 ${meta.color}`}>
                                                <Icon className="w-3.5 h-3.5" />
                                                {meta.label}
                                            </span>
                                        </div>

                                        {/* Comments for this task */}
                                        {taskComments.length > 0 && (
                                            <div className="mb-3 space-y-2">
                                                {taskComments.slice(0, 3).map((c: any) => (
                                                    <div key={c.id} className="flex items-start gap-2 text-xs">
                                                        <MessageSquare className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                                                        <p className="text-muted-foreground">{c.body}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <TaskComment workspaceId={workspaceId} taskId={task.id} token={token} />
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

            </main>
        </div>
    );
}
