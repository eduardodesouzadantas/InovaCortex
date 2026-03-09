/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { CheckCircle2, Circle, AlertCircle, Loader2, Clock } from "lucide-react";

interface Task {
    id: string;
    title: string;
    description: string;
    status: string;
    ownerRole: string;
    dueAt?: string | null;
}

const STATUS_CONFIG: Record<string, { icon: any; label: string; color: string; bg: string }> = {
    todo: { icon: Circle, label: "A fazer", color: "text-muted-foreground", bg: "bg-muted/20" },
    doing: { icon: Loader2, label: "Em progresso", color: "text-blue-400", bg: "bg-blue-400/10" },
    blocked: { icon: AlertCircle, label: "Bloqueado", color: "text-red-400", bg: "bg-red-400/10" },
    done: { icon: CheckCircle2, label: "Concluído", color: "text-green-500", bg: "bg-green-500/10" },
};

const STATUS_FLOW = ["todo", "doing", "blocked", "done"] as const;

export function WorkspaceTaskBoard({
    tasks,
    workspaceId,
    canEdit,
    apiBasePath = "/api/admin/workspaces",
}: {
    tasks: Task[];
    workspaceId: string;
    canEdit: boolean;
    apiBasePath?: string;
}) {
    const [localTasks, setLocalTasks] = useState<Task[]>(tasks);
    const [loading, setLoading] = useState<Record<string, boolean>>({});

    const cycleStatus = async (task: Task) => {
        if (!canEdit) return;
        const idx = STATUS_FLOW.indexOf(task.status as any);
        const nextStatus = STATUS_FLOW[(idx + 1) % STATUS_FLOW.length];

        setLoading(prev => ({ ...prev, [task.id]: true }));
        try {
            const res = await fetch(`${apiBasePath}/${workspaceId}/tasks/${task.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: nextStatus }),
            });
            if (res.ok) {
                setLocalTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t));
            }
        } finally {
            setLoading(prev => ({ ...prev, [task.id]: false }));
        }
    };

    return (
        <div className="space-y-2">
            {localTasks.map(task => {
                const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.todo;
                const Icon = cfg.icon;
                const isLoading = loading[task.id];

                return (
                    <div key={task.id}
                        className={`rounded-xl border border-border/40 p-4 flex items-start gap-3 transition-all ${cfg.bg} ${canEdit ? "cursor-pointer hover:border-border/80" : ""}`}
                        onClick={() => cycleStatus(task)}
                    >
                        <div className={`mt-0.5 shrink-0 ${cfg.color}`}>
                            {isLoading
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Icon className={`w-4 h-4 ${task.status === "doing" ? "animate-pulse" : ""}`} />
                            }
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`font-semibold text-sm ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                                    {task.title}
                                </span>
                                <span className="text-xs text-muted-foreground/60 capitalize">{task.ownerRole}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                            {task.dueAt && (
                                <p className="text-xs text-muted-foreground/60 flex items-center gap-1 mt-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(task.dueAt).toLocaleDateString("pt-BR")}
                                </p>
                            )}
                        </div>
                        {canEdit && (
                            <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${cfg.color}`}>
                                {cfg.label}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
