"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Zap, CheckCircle2, Clock, ChevronRight } from "lucide-react";

const PRIORITY_CONFIG = {
    critical: { color: "border-l-red-500 bg-red-500/5", dot: "bg-red-500", label: "Crítico" },
    high: { color: "border-l-yellow-400 bg-yellow-400/5", dot: "bg-yellow-400", label: "Alto" },
    medium: { color: "border-l-blue-400 bg-blue-400/5", dot: "bg-blue-400", label: "Médio" },
};

const TYPE_ICON: Record<string, any> = {
    alert: AlertTriangle,
    hot_lead: Zap,
    pending_approval: CheckCircle2,
    blocked_workspace: AlertTriangle,
    usage_threshold: Clock,
};

interface ActionItem {
    id: string;
    priority: "critical" | "high" | "medium";
    type: string;
    label: string;
    subtext: string;
    href: string;
}

export function ActionQueue({ items, orgSlug }: { items: ActionItem[]; orgSlug: string }) {
    const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mb-2 text-green-500/40" />
                <p className="text-sm">Tudo em ordem — sem ações pendentes.</p>
            </div>
        );
    }

    async function handleAction(item: ActionItem) {
        setLoadingIds(prev => new Set(prev).add(item.id));
        try {
            let actionType = "unknown";
            let itemId = item.id.split("_").pop() || item.id;

            if (item.type === "blocked_workspace") actionType = "nudge_workspace";
            if (item.type === "alert") actionType = "resolve_alert";
            if (item.type === "hot_lead") actionType = "start_sequence";
            if (item.id.includes("proposal")) actionType = "followup_proposal";
            if (item.id === "pending_content") actionType = "approve_content";
            if (item.id === "pending_authority") actionType = "approve_authority";

            await fetch("/api/admin/cockpit/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ actionType, itemId })
            });
            // Reload page to reflect changes
            window.location.reload();
        } catch {
            // Revert loading on error
            setLoadingIds(prev => {
                const next = new Set(prev);
                next.delete(item.id);
                return next;
            });
        }
    }

    function getButtonLabel(item: ActionItem) {
        if (item.type === "blocked_workspace") return "Nudge";
        if (item.type === "alert") return "Resolver";
        if (item.type === "hot_lead") return "Iniciar Seq.";
        if (item.id.includes("proposal")) return "Follow-up";
        if (item.type === "pending_approval") return "Aprovar";
        return "Ver";
    }

    return (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
            {items.map(item => {
                const cfg = PRIORITY_CONFIG[item.priority];
                const Icon = TYPE_ICON[item.type] ?? ChevronRight;
                const isLoading = loadingIds.has(item.id);

                return (
                    <div key={item.id} className={`flex flex-col gap-2 px-3 py-2.5 rounded-lg border-l-2 ${cfg.color} group`}>
                        <div className="flex items-start gap-3 w-full">
                            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${cfg.dot}`} />
                            <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{item.label}</p>
                                <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{item.subtext}</p>
                            </div>
                        </div>

                        {/* Actions Row */}
                        <div className="flex items-center justify-end gap-2 ml-7 mt-1 border-t border-border/10 pt-2 opacity-80 group-hover:opacity-100 transition-opacity">
                            <Link href={item.href} className="text-[10px] text-muted-foreground hover:text-white px-2 py-1 rounded bg-muted/20 hover:bg-muted/40 transition-colors">
                                Ver Detalhes
                            </Link>
                            <button
                                onClick={() => handleAction(item)}
                                disabled={isLoading}
                                className="text-[10px] font-semibold text-white bg-primary/20 hover:bg-primary/40 px-2 py-1 rounded border border-primary/30 transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                                {isLoading ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block" /> : null}
                                {isLoading ? "Aguarde..." : getButtonLabel(item)}
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
