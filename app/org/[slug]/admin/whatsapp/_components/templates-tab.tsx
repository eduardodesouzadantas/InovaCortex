"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
    CheckCircle2,
    Clock,
    FileText,
    Loader2,
    MessageSquare,
    RefreshCw,
    XCircle,
} from "lucide-react";
import { readApiData } from "./api-envelope";

type TemplateItem = {
    id: string;
    name: string;
    category: string;
    status: string;
    language: string;
    bodyJson?: string;
    updatedAt?: string;
};

function getErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
}

function extractPreviewFromParsed(parsed: unknown): string | null {
    if (typeof parsed === "string") return parsed.slice(0, 140);
    if (!parsed || typeof parsed !== "object") return null;

    const parsedRecord = parsed as { body?: unknown; components?: Array<{ text?: unknown }> };
    if (typeof parsedRecord.body === "string") return parsedRecord.body.slice(0, 140);
    if (Array.isArray(parsedRecord.components)) {
        const firstWithText = parsedRecord.components.find((component) => typeof component?.text === "string");
        if (firstWithText && typeof firstWithText.text === "string") {
            return firstWithText.text.slice(0, 140);
        }
    }
    return null;
}

export function TemplatesTab({ slug: providedSlug }: { slug?: string }) {
    const params = useParams();
    const slug = providedSlug ?? (params.slug as string);
    const [templates, setTemplates] = useState<TemplateItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function fetchTemplates(isRefresh = false) {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        setError(null);
        try {
            const res = await fetch(`/api/org/${slug}/whatsapp/templates`);
            const data = await readApiData<{ templates?: TemplateItem[] }>(res, "Falha ao carregar templates");
            setTemplates(data.templates || []);
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Erro inesperado"));
        } finally {
            if (isRefresh) setRefreshing(false);
            else setLoading(false);
        }
    }

    useEffect(() => {
        fetchTemplates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug]);

    async function handleSyncTemplates() {
        setSyncing(true);
        setError(null);
        try {
            const response = await fetch(`/api/org/${slug}/whatsapp/templates`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            await readApiData<unknown>(response, "Falha ao sincronizar templates");

            await fetchTemplates(true);
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Erro ao sincronizar templates"));
        } finally {
            setSyncing(false);
        }
    }

    function getStatusIcon(status: string) {
        switch (status) {
            case "approved":
                return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case "pending":
                return <Clock className="w-4 h-4 text-amber-500" />;
            case "rejected":
                return <XCircle className="w-4 h-4 text-red-500" />;
            default:
                return null;
        }
    }

    function getTemplatePreview(bodyJson?: string): string {
        if (!bodyJson) return "Template sem corpo cadastrado.";
        try {
            const parsed = JSON.parse(bodyJson);
            const extracted = extractPreviewFromParsed(parsed);
            if (extracted) return extracted;
            return bodyJson.slice(0, 140);
        } catch {
            return bodyJson.slice(0, 140);
        }
    }

    return (
        <div className="p-8 flex flex-col h-full overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-xl font-bold text-white/90">Galeria de Templates</h2>
                    <p className="text-sm text-white/40 mt-1">Lista operacional dos templates disponíveis para envio no CRM.</p>
                </div>
                <button
                    onClick={handleSyncTemplates}
                    disabled={refreshing || syncing}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all text-white/60 disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${refreshing || syncing ? "animate-spin" : ""}`} />
                    {syncing ? "Sincronizando..." : "Sincronizar Meta"}
                </button>
            </div>

            {error && (
                <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gold/40" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {templates.length === 0 ? (
                        <div className="col-span-full py-20 bg-white/[0.02] border border-white/[0.05] rounded-3xl border-dashed flex flex-col items-center justify-center text-center">
                            <FileText className="w-12 h-12 text-white/10 mb-4" />
                            <p className="text-sm text-white/40">Nenhum template disponível ainda.</p>
                        </div>
                    ) : (
                        templates.map((tmpl) => (
                            <div key={tmpl.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-4 relative group hover:border-gold/30 transition-all">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex flex-col gap-1 min-w-0">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-white/30">{tmpl.category}</span>
                                        <h3 className="text-sm font-black text-white/80 truncate">{tmpl.name}</h3>
                                    </div>
                                    {getStatusIcon(tmpl.status)}
                                </div>

                                <div className="bg-black/20 p-4 rounded-xl border border-white/5 min-h-[120px] flex flex-col gap-2 overflow-hidden">
                                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                                        <MessageSquare className="w-4 h-4 text-white/20" />
                                    </div>
                                    <p className="text-xs text-white/60 leading-relaxed">
                                        {getTemplatePreview(tmpl.bodyJson)}
                                    </p>
                                </div>

                                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/20">
                                    <span>{tmpl.language}</span>
                                    <span>{tmpl.updatedAt ? new Date(tmpl.updatedAt).toLocaleDateString("pt-BR") : ""}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
