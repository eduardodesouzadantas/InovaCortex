"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Clock, Shield } from "lucide-react";

interface ChecklistItem {
    id: string;
    system: string;
    item: string;
    status: string;
    notes?: string | null;
}

const STATUS_CONFIG: Record<string, { icon: any; label: string; color: string; next: string }> = {
    pending: { icon: Circle, label: "Pendente", color: "text-muted-foreground", next: "provided" },
    provided: { icon: Clock, label: "Fornecido", color: "text-yellow-400", next: "verified" },
    verified: { icon: CheckCircle2, label: "Verificado", color: "text-green-500", next: "pending" },
};

function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
    return arr.reduce((acc, item) => {
        const k = String(item[key]);
        if (!acc[k]) acc[k] = [];
        acc[k].push(item);
        return acc;
    }, {} as Record<string, T[]>);
}

export function WorkspaceChecklist({
    items,
    workspaceId,
    canEdit,
}: {
    items: ChecklistItem[];
    workspaceId: string;
    canEdit: boolean;
}) {
    const [localItems, setLocalItems] = useState<ChecklistItem[]>(items);
    const [loading, setLoading] = useState<Record<string, boolean>>({});

    const cycleStatus = async (item: ChecklistItem) => {
        if (!canEdit) return;
        const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
        const nextStatus = cfg.next;

        setLoading(prev => ({ ...prev, [item.id]: true }));
        try {
            const res = await fetch(`/api/admin/workspaces/${workspaceId}/checklist/${item.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: nextStatus }),
            });
            if (res.ok) {
                setLocalItems(prev => prev.map(i => i.id === item.id ? { ...i, status: nextStatus } : i));
            }
        } finally {
            setLoading(prev => ({ ...prev, [item.id]: false }));
        }
    };

    const groups = groupBy(localItems, "system");

    return (
        <div className="space-y-4">
            {Object.entries(groups).map(([system, groupItems]) => {
                const verifiedCount = groupItems.filter(i => i.status === "verified").length;
                return (
                    <div key={system} className="glass-panel rounded-xl border border-border/50 overflow-hidden">
                        <div className="px-4 py-3 border-b border-border/30 bg-muted/10 flex items-center justify-between">
                            <h4 className="font-semibold text-sm flex items-center gap-1.5">
                                <Shield className="w-3.5 h-3.5 text-primary" /> {system}
                            </h4>
                            <span className="text-xs text-muted-foreground">{verifiedCount}/{groupItems.length}</span>
                        </div>
                        <div className="divide-y divide-border/20">
                            {groupItems.map(item => {
                                const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
                                const Icon = cfg.icon;
                                return (
                                    <div key={item.id}
                                        className={`px-4 py-3 flex items-center gap-3 ${canEdit ? "cursor-pointer hover:bg-muted/10" : ""} transition-colors`}
                                        onClick={() => cycleStatus(item)}
                                    >
                                        <Icon className={`w-4 h-4 shrink-0 ${cfg.color}`} />
                                        <span className={`text-sm flex-1 ${item.status === "verified" ? "line-through text-muted-foreground" : ""}`}>
                                            {item.item}
                                        </span>
                                        {canEdit && (
                                            <span className={`text-xs shrink-0 ${cfg.color}`}>{cfg.label}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
