"use client";

import { useState } from "react";
import { Check, X, Play, Clock, AlertTriangle, MessageSquare, Briefcase, FileCode } from "lucide-react";

export function CommandQueue({ items, orgSlug }: { items: any[]; orgSlug: string }) {
    const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

    const handleAction = async (id: string, actionUrl: string) => {
        setLoadingIds(prev => new Set(prev).add(id));
        try {
            await fetch(actionUrl, { method: "POST" });
            window.location.reload();
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-6 text-center border border-white/5 rounded-xl bg-white/5">
                <Check className="w-8 h-8 text-green-400/50 mb-2" />
                <p className="text-sm font-medium">Nenhuma ação pendente</p>
                <p className="text-xs text-muted-foreground mt-1">O Revisor e o Planner estão aguardando dados</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {items.map(item => {
                const isReview = item.status === "review_required";
                const isApproved = item.status === "approved";
                const isLoading = loadingIds.has(item.id);

                let Icon = Play;
                if (item.type === "send_whatsapp") Icon = MessageSquare;
                if (item.type === "generate_proposal") Icon = Briefcase;
                if (item.type === "publish_content") Icon = FileCode;

                return (
                    <div key={item.id} className={`group flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border bg-white/5 transition-colors
                        ${item.priority === "critical" ? "border-l-4 border-l-red-500 border-white/10" : "border-l-4 border-l-blue-400 border-white/5"}
                    `}>
                        <div className="flex items-start gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isReview ? "bg-yellow-400/10 text-yellow-400" : isApproved ? "bg-green-400/10 text-green-400" : "bg-white/10 text-white"}`}>
                                <Icon className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold flex items-center gap-2">
                                    {item.type}
                                    {isReview && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-400 uppercase font-black">Revisão Pendente</span>}
                                    {isApproved && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-400/20 text-green-400 uppercase font-black">Aprovado</span>}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5 max-w-md truncate" title={item.payloadJson}>
                                    Payload: {item.payloadJson}
                                </p>
                                {item.reason && (
                                    <p className="text-[10px] text-yellow-500/80 mt-1 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" /> {item.reason}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {isReview && (
                                <>
                                    <button
                                        disabled={isLoading}
                                        onClick={() => handleAction(item.id, `/api/admin/actions/${item.id}/approve`)}
                                        className="bg-green-500/20 text-green-400 hover:bg-green-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1">
                                        <Check className="w-3 h-3" /> Aprovar
                                    </button>
                                    <button
                                        disabled={isLoading}
                                        onClick={() => handleAction(item.id, `/api/admin/actions/${item.id}/reject`)}
                                        className="bg-red-500/20 text-red-400 hover:bg-red-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1">
                                        <X className="w-3 h-3" /> Negar
                                    </button>
                                </>
                            )}
                            {isApproved && (
                                <button
                                    disabled={isLoading}
                                    onClick={() => handleAction(item.id, `/api/admin/actions/${item.id}/execute`)}
                                    className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1">
                                    <Play className="w-3 h-3" /> Executar Agora
                                </button>
                            )}
                            {item.status === "pending" && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1 px-2">
                                    <Clock className="w-3 h-3" /> Na fila
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
