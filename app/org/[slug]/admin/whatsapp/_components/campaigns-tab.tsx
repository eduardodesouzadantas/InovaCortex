"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BarChart3, LayoutGrid, Loader2, Plus, Send } from "lucide-react";
import { HelpPopover } from "@/components/ui/help-popover";
import { getHelp } from "@/lib/help/use-help";

type CampaignTemplate = { id: string; name: string; status: string; language: string };

type CampaignSummary = {
    totalTargetContacts: number;
    totalProcessed: number;
    totalSent: number;
    totalFailed: number;
    totalSkipped: number;
    totalDeduped: number;
    pending: number;
    progressPercent: number;
    lastBatchAt?: string;
    nextBatchAt?: string | null;
    failureReason?: string | null;
};

type CampaignItem = {
    id: string;
    name: string;
    status: string;
    createdAt?: string;
    template: { name: string; language: string };
    _count: { sends: number };
    summary: CampaignSummary;
};

function getErrorMessage(err: unknown, fallback: string): string {
    return err instanceof Error && err.message ? err.message : fallback;
}

export function CampaignsTab({ slug: providedSlug }: { slug?: string }) {
    const params = useParams();
    const slug = providedSlug ?? (params.slug as string);

    const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
    const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [name, setName] = useState("");
    const [templateId, setTemplateId] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [actionCampaignId, setActionCampaignId] = useState<string | null>(null);
    const [actionType, setActionType] = useState<string | null>(null);

    async function fetchData() {
        setLoading(true);
        setError(null);
        try {
            const [campaignsRes, templatesRes] = await Promise.all([
                fetch(`/api/org/${slug}/whatsapp/campaigns`),
                fetch(`/api/org/${slug}/whatsapp/templates`),
            ]);
            if (!campaignsRes.ok) throw new Error("Falha ao carregar campanhas");
            if (!templatesRes.ok) throw new Error("Falha ao carregar templates");

            const campaignsData = await campaignsRes.json();
            const templatesData = await templatesRes.json();

            setCampaigns(campaignsData.campaigns || []);
            const approved = (templatesData.templates || []).filter((tmpl: CampaignTemplate) => tmpl.status === "approved");
            setTemplates(approved);
            if (!templateId && approved.length > 0) setTemplateId(approved[0].id);
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Erro inesperado"));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug]);

    async function handleCreateCampaign() {
        if (!name.trim()) return setError("Nome da campanha e obrigatorio");
        if (!templateId) return setError("Selecione um template aprovado");

        setCreating(true);
        setError(null);
        setWarnings([]);
        try {
            const res = await fetch(`/api/org/${slug}/whatsapp/campaigns`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), templateId, segmentQuery: {}, throttlePolicy: { msgsPerMinute: 10, maxBatchesPerRun: 2 } }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "Falha ao criar campanha");

            setName("");
            setShowCreate(false);
            await fetchData();
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Falha ao criar campanha"));
        } finally {
            setCreating(false);
        }
    }

    async function runCampaignAction(campaignId: string, action: "start" | "resume" | "pause" | "run_batch") {
        setActionCampaignId(campaignId);
        setActionType(action);
        setError(null);
        setWarnings([]);
        try {
            const response = await fetch(`/api/org/${slug}/whatsapp/campaigns/${campaignId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, maxBatches: action === "run_batch" ? 1 : 2, batchLimit: 25 }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.error || "Falha ao executar acao da campanha");
            setWarnings(Array.isArray(data?.warnings) ? data.warnings.filter((v: unknown) => typeof v === "string") : []);
            await fetchData();
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Falha ao executar acao da campanha"));
        } finally {
            setActionCampaignId(null);
            setActionType(null);
        }
    }

    const getStatusStyle = (status: string) => {
        switch (status) {
            case "completed": return "bg-green-500/10 text-green-500 border-green-500/20";
            case "running": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
            case "paused": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
            case "failed": return "bg-red-500/10 text-red-400 border-red-500/20";
            default: return "bg-white/5 text-white/40 border-white/10";
        }
    };

    return (
        <div className="p-8 flex flex-col h-full overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 id="campaign-tab" className="text-xl font-bold text-white/90 flex items-center gap-2">
                        Campanhas em Massa
                        <HelpPopover {...getHelp("campaignPerformance")} />
                    </h2>
                    <p className="text-sm text-white/40 mt-1">Execucao resiliente em lotes com telemetria operacional.</p>
                </div>
                <button
                    onClick={() => { setError(null); setWarnings([]); setShowCreate((prev) => !prev); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gold text-black rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gold/90 transition-all shadow-lg shadow-gold/20"
                >
                    <Plus className="w-4 h-4" />
                    Nova Campanha
                </button>
            </div>

            {showCreate && (
                <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da campanha" className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
                        <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white">
                            <option value="">Selecione template aprovado</option>
                            {templates.map((tmpl) => (<option key={tmpl.id} value={tmpl.id}>{tmpl.name} ({tmpl.language})</option>))}
                        </select>
                        <button onClick={handleCreateCampaign} disabled={creating} className="px-4 py-2.5 rounded-xl bg-gold text-black text-xs font-black uppercase tracking-widest hover:bg-gold/90 disabled:opacity-50">
                            {creating ? "Criando..." : "Criar rascunho"}
                        </button>
                    </div>
                </div>
            )}

            {error && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}
            {warnings.length > 0 && (
                <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    {warnings.join(" ")}
                </div>
            )}

            {loading ? (
                <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-gold/40" /></div>
            ) : campaigns.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center bg-white/[0.02] border border-white/[0.05] rounded-3xl p-12 border-dashed">
                    <div className="w-16 h-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4 text-white/10"><Send className="w-8 h-8" /></div>
                    <h3 className="text-lg font-bold text-white/40">Nenhuma campanha criada</h3>
                    <p className="text-sm text-white/20 mt-1 mb-6 max-w-xs text-center">Crie uma campanha para iniciar o disparo.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {campaigns.map((camp) => (
                        <div key={camp.id} className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col gap-5 group hover:border-gold/30 transition-all hover:translate-y-[-2px]">
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className={`inline-flex px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-widest mb-3 ${getStatusStyle(camp.status)}`}>{camp.status}</div>
                                    <h3 className="text-base font-bold text-white/90 truncate">{camp.name}</h3>
                                    <p className="text-xs text-white/30 flex items-center gap-1.5 mt-1 capitalize"><LayoutGrid className="w-3.5 h-3.5" />Template: {camp.template?.name ?? "N/A"} ({camp.template?.language ?? "-"})</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 p-4 rounded-2xl bg-black/20 border border-white/5">
                                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/40"><span>Execucao</span><BarChart3 className="w-3.5 h-3.5" /></div>
                                <div className="w-full h-2 rounded bg-white/10 overflow-hidden"><div className="h-full bg-gold" style={{ width: `${camp.summary?.progressPercent ?? 0}%` }} /></div>
                                <div className="grid grid-cols-2 gap-2 text-[10px] text-white/70">
                                    <span>Target: {camp.summary?.totalTargetContacts ?? 0}</span>
                                    <span>Processed: {camp.summary?.totalProcessed ?? 0}</span>
                                    <span>Sent: {camp.summary?.totalSent ?? 0}</span>
                                    <span>Failed: {camp.summary?.totalFailed ?? 0}</span>
                                    <span>Skipped: {camp.summary?.totalSkipped ?? 0}</span>
                                    <span>Pending: {camp.summary?.pending ?? 0}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {camp.status === "draft" && (
                                    <button onClick={() => runCampaignAction(camp.id, "start")} disabled={actionCampaignId === camp.id} className="flex-1 px-3 py-2 rounded-lg bg-gold text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                                        {actionCampaignId === camp.id && actionType === "start" ? "Iniciando..." : "Iniciar"}
                                    </button>
                                )}
                                {camp.status === "paused" && (
                                    <button onClick={() => runCampaignAction(camp.id, "resume")} disabled={actionCampaignId === camp.id} className="flex-1 px-3 py-2 rounded-lg bg-gold text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-50">
                                        {actionCampaignId === camp.id && actionType === "resume" ? "Retomando..." : "Retomar"}
                                    </button>
                                )}
                                {camp.status === "running" && (
                                    <>
                                        <button onClick={() => runCampaignAction(camp.id, "run_batch")} disabled={actionCampaignId === camp.id} className="flex-1 px-3 py-2 rounded-lg border border-white/20 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 disabled:opacity-50">
                                            {actionCampaignId === camp.id && actionType === "run_batch" ? "Executando..." : "Executar Lote"}
                                        </button>
                                        <button onClick={() => runCampaignAction(camp.id, "pause")} disabled={actionCampaignId === camp.id} className="flex-1 px-3 py-2 rounded-lg border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/10 disabled:opacity-50">
                                            {actionCampaignId === camp.id && actionType === "pause" ? "Pausando..." : "Pausar"}
                                        </button>
                                    </>
                                )}
                                {(camp.status === "completed" || camp.status === "failed") && (
                                    <div className="w-full text-[10px] uppercase tracking-widest text-white/40">Sem acao operacional pendente</div>
                                )}
                            </div>

                            <div className="text-[10px] uppercase tracking-widest text-white/30">
                                {camp.createdAt ? new Date(camp.createdAt).toLocaleDateString("pt-BR") : ""}
                                {camp.summary?.failureReason ? ` • Falha: ${camp.summary.failureReason}` : ""}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
