"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
    Send,
    Plus,
    MoreHorizontal,
    BarChart3,
    Play,
    Pause,
    Loader2,
    Calendar,
    CheckCircle2,
    AlertCircle,
    LayoutGrid
} from "lucide-react";
import { HelpPopover } from "@/components/ui/help-popover";
import { getHelp } from "@/lib/help/use-help";

export function CampaignsTab() {
    const params = useParams();
    const slug = params.slug as string;
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchCampaigns() {
            try {
                const res = await fetch(`/api/org/${slug}/whatsapp/campaigns`);
                const data = await res.json();
                setCampaigns(data.campaigns || []);
            } catch (err) {
                console.error("Failed to fetch campaigns:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchCampaigns();
    }, [slug]);

    const getStatusStyle = (status: string) => {
        switch (status) {
            case "completed": return "bg-green-500/10 text-green-500 border-green-500/20";
            case "running": return "bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse";
            case "scheduled": return "bg-gold/10 text-gold border-gold/20";
            case "draft": return "bg-white/5 text-white/40 border-white/10";
            default: return "bg-white/5 text-white/40 border-white/10";
        }
    };

    return (
        <div className="p-8 flex flex-col h-full overflow-y-auto custom-scrollbar">
            {/* Tab Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 id="campaign-tab" className="text-xl font-bold text-white/90 flex items-center gap-2">
                        Campanhas em Massa
                        <HelpPopover {...getHelp("campaignPerformance")} />
                    </h2>
                    <p className="text-sm text-white/40 mt-1">Gerencie e monitore o disparo de mensagens para seus leads.</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 bg-gold text-black rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gold/90 transition-all shadow-lg shadow-gold/20">
                    <Plus className="w-4 h-4" />
                    Nova Campanha
                </button>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gold/40" />
                </div>
            ) : campaigns.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center bg-white/[0.02] border border-white/[0.05] rounded-3xl p-12 border-dashed">
                    <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4 text-white/10">
                        <Send className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-white/40">Nenhuma campanha criada</h3>
                    <p className="text-sm text-white/20 mt-1 mb-6 max-w-xs text-center">
                        Comece disparando mensagens em massa utilizando seus templates aprovados.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {campaigns.map((camp) => (
                        <div key={camp.id} className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col gap-6 group hover:border-gold/30 transition-all hover:translate-y-[-2px]">
                            {/* Card Title */}
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className={`inline-flex px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-widest mb-3 ${getStatusStyle(camp.status)}`}>
                                        {camp.status}
                                    </div>
                                    <h3 className="text-base font-bold text-white/90 truncate">{camp.name}</h3>
                                    <p className="text-xs text-white/30 flex items-center gap-1.5 mt-1 capitalize">
                                        <LayoutGrid className="w-3.5 h-3.5" />
                                        Template: {camp.template.name}
                                    </p>
                                </div>
                                <button className="p-2 rounded-xl hover:bg-white/5 text-white/20 transition-colors">
                                    <MoreHorizontal className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Progress / Stats Area */}
                            <div className="flex flex-col gap-3 p-4 rounded-2xl bg-black/20 border border-white/5">
                                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/40">
                                    <span>Desempenho</span>
                                    <BarChart3 className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex items-end justify-between mt-1">
                                    <div className="flex flex-col">
                                        <span className="text-2xl font-black text-white/90">{camp._count.sends}</span>
                                        <span className="text-[10px] text-white/30 uppercase tracking-widest">Enviados</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs font-bold text-emerald-500">100% Ok</span>
                                        <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden mt-1.5">
                                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="mt-auto flex gap-3 pt-2">
                                {camp.status === "draft" && (
                                    <button className="flex-1 py-2.5 rounded-xl bg-gold/10 border border-gold/20 text-gold text-[10px] font-black uppercase tracking-widest hover:bg-gold/20 transition-all flex items-center justify-center gap-2">
                                        <Play className="w-3.5 h-3.5 fill-gold" />
                                        Iniciar Disparo
                                    </button>
                                )}
                                {camp.status === "running" && (
                                    <button className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                                        <Pause className="w-3.5 h-3.5 fill-white/60" />
                                        Pausar
                                    </button>
                                )}
                                {camp.status === "completed" && (
                                    <div className="flex-1 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] text-white/20 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Finalizada
                                    </div>
                                )}
                                <button className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white/80 transition-all">
                                    <BarChart3 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
