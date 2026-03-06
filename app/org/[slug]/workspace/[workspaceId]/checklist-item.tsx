"use client";

import { useState } from "react";
import { CheckCircle2, Clock, ShieldCheck, Loader2 } from "lucide-react";

interface ChecklistItemProps {
    item: {
        id: string;
        system: string;
        item: string;
        status: "pending" | "provided" | "verified";
        notes?: string | null;
    };
    workspaceId: string;
    token: string;
}

const STATUS_CONFIG = {
    pending: { label: "Aguardando", Icon: Clock, className: "text-muted-foreground" },
    provided: { label: "Enviado", Icon: CheckCircle2, className: "text-blue-400" },
    verified: { label: "Verificado", Icon: ShieldCheck, className: "text-green-500" },
};

export function ChecklistItem({ item, workspaceId, token }: ChecklistItemProps) {
    const [status, setStatus] = useState<"pending" | "provided" | "verified">(item.status);
    const [loading, setLoading] = useState(false);

    const cfg = STATUS_CONFIG[status];
    const { Icon } = cfg;
    const isDone = status !== "pending";

    const handleProvide = async () => {
        if (isDone || loading) return;
        setLoading(true);
        try {
            const res = await fetch(
                `/api/public/workspace/${workspaceId}/checklist/${item.id}/provide?t=${encodeURIComponent(token)}`,
                { method: "POST" }
            );
            if (res.ok) setStatus("provided");
        } catch {
            // silent — no crash
        } finally {
            setLoading(false);
        }
    };

    return (
        <li className="flex items-center gap-4 px-5 py-3.5 group hover:bg-muted/20 transition-colors">
            <button
                onClick={handleProvide}
                disabled={isDone || loading}
                aria-label={`Marcar ${item.item} como fornecido`}
                className={`flex items-center justify-center w-5 h-5 rounded-md border transition-all shrink-0
                    ${isDone
                        ? "border-transparent cursor-default"
                        : "border-border/60 hover:border-primary/60 hover:bg-primary/10 cursor-pointer"
                    } ${cfg.className}`}
            >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
            </button>

            <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : ""}`}>
                    {item.item}
                </p>
                {item.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>
                )}
            </div>

            <span className={`text-xs font-semibold shrink-0 ${cfg.className}`}>{cfg.label}</span>
        </li>
    );
}
