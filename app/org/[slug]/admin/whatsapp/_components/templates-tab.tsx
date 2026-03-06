"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
    LayoutGrid,
    RotateCw,
    Search,
    Loader2,
    FileText,
    MessageSquare,
    CheckCircle2,
    Clock,
    XCircle
} from "lucide-react";

export function TemplatesTab() {
    const params = useParams();
    const slug = params.slug as string;
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        async function fetchTemplates() {
            try {
                const res = await fetch(`/api/org/${slug}/whatsapp/templates`);
                const data = await res.json();
                setTemplates(data.templates || []);
            } catch (err) {
                console.error("Failed to fetch templates:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchTemplates();
    }, [slug]);

    const handleSync = async () => {
        setSyncing(true);
        // In a real app, this would trigger a Meta API sync
        setTimeout(() => {
            setSyncing(false);
        }, 2000);
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "approved": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case "pending": return <Clock className="w-4 h-4 text-amber-500" />;
            case "rejected": return <XCircle className="w-4 h-4 text-red-500" />;
            default: return null;
        }
    };

    return (
        <div className="p-8 flex flex-col h-full overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-xl font-bold text-white/90">Galeria de Templates</h2>
                    <p className="text-sm text-white/40 mt-1">Sincronize e selecione modelos de mensagem aprovados pelo Meta.</p>
                </div>
                <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all text-white/60"
                >
                    <RotateCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                    Sincronizar Meta
                </button>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gold/40" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {templates.length === 0 ? (
                        <div className="col-span-full py-20 bg-white/[0.02] border border-white/[0.05] rounded-3xl border-dashed flex flex-col items-center justify-center text-center">
                            <FileText className="w-12 h-12 text-white/10 mb-4" />
                            <p className="text-sm text-white/40">Nenhum template sincronizado ainda.</p>
                        </div>
                    ) : (
                        templates.map((tmpl) => (
                            <div key={tmpl.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-4 relative group hover:border-gold/30 transition-all">
                                <div className="flex items-start justify-between">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-white/30">{tmpl.category}</span>
                                        <h3 className="text-sm font-black text-white/80 truncate">{tmpl.name}</h3>
                                    </div>
                                    {getStatusIcon(tmpl.status)}
                                </div>

                                <div className="bg-black/20 p-4 rounded-xl border border-white/5 aspect-[4/3] flex flex-col gap-2 overflow-hidden">
                                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                                        <MessageSquare className="w-4 h-4 text-white/20" />
                                    </div>
                                    {/* Simulated Template Preview */}
                                    <div className="flex flex-col gap-2 mt-2">
                                        <div className="h-2 w-3/4 bg-white/5 rounded-full" />
                                        <div className="h-2 w-1/2 bg-white/5 rounded-full" />
                                        <div className="h-2 w-full bg-white/5 rounded-full" />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/20">
                                    <span>{tmpl.language}</span>
                                    <span className="text-white/10">v1.2</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
