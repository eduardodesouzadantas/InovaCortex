/* eslint-disable @typescript-eslint/no-explicit-any, react/no-unescaped-entities */
"use client";

import { useState, useCallback } from "react";
import {
    FileText, RefreshCw, Loader2, Send,
    CheckCircle2, Package, DollarSign, TrendingUp,
    ChevronDown, ChevronUp, Copy, ExternalLink
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProposalModule {
    id: string; title: string; description: string;
    deliverables: string[]; estimatedWeeks: number;
    basePrice: number; included: boolean;
}

interface PricingEstimate { minBRL: number; maxBRL: number; currency: string; basis: string; }

interface ProposalData {
    id: string; version: number; status: string;
    publicSlug: string; modules: ProposalModule[];
    pricingEstimate: PricingEstimate;
    roiSnapshot: { operationalSavings: number; revenueIncrease: number; paybackMonths: number; confidenceLevel: string };
    presalesSnapshot: { executiveSummary?: string; diagnosticQuestions?: string[] };
    executiveSummary?: string;
    timeline?: Array<{ phase: string; weeks: string; deliverables: string[] }>;
    customNotes?: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    draft: { label: "Rascunho", color: "text-gray-400  bg-gray-400/10  border-gray-400/20" },
    sent: { label: "Enviada", color: "text-blue-400  bg-blue-400/10  border-blue-400/20" },
    viewed: { label: "Visualizada", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
    accepted: { label: "Aceita ✓", color: "text-green-500 bg-green-500/10  border-green-500/20" },
    rejected: { label: "Rejeitada", color: "text-red-500   bg-red-500/10    border-red-400/20" },
};

function formatBRL(n: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProposalPanel({
    assessmentId,
    apiBasePath = "/api/admin/leads",
}: {
    assessmentId: string;
    apiBasePath?: string;
}) {
    const [proposal, setProposal] = useState<ProposalData | null>(null);
    const [allVersions, setAllVersions] = useState<ProposalData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [expandedModule, setExpandedModule] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [status, setStatus] = useState("idle");  // idle | saving | saved | error
    const [loadedOnce, setLoadedOnce] = useState(false);

    const loadProposals = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${apiBasePath}/${assessmentId}/proposal`);
            const data = await res.json();
            if (res.ok && data.proposals?.length > 0) {
                setAllVersions(data.proposals);
                setProposal(data.proposals[0]);
            }
        } finally {
            setIsLoading(false);
            setLoadedOnce(true);
        }
    }, [assessmentId, apiBasePath]);

    // Lazy load on first expand
    const handleInit = () => {
        if (!loadedOnce) loadProposals();
    };

    const generate = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch(`${apiBasePath}/${assessmentId}/proposal`, { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setProposal(data.proposal);
            setAllVersions(prev => [data.proposal, ...prev]);
        } catch (e: any) {
            alert("Erro: " + e.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const markAs = async (newStatus: string) => {
        if (!proposal) return;
        setStatus("saving");
        try {
            const res = await fetch(`${apiBasePath}/${assessmentId}/proposal`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ proposalId: proposal.id, status: newStatus }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setProposal(prev => prev ? { ...prev, status: newStatus } : null);
            setStatus("saved");
            setTimeout(() => setStatus("idle"), 2000);
        } catch {
            setStatus("error");
        }
    };

    const toggleModule = async (moduleId: string, included: boolean) => {
        if (!proposal) return;
        const newModules = proposal.modules.map(m =>
            m.id === moduleId ? { ...m, included } : m
        );
        setProposal(prev => prev ? { ...prev, modules: newModules } : null);
        await fetch(`${apiBasePath}/${assessmentId}/proposal`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ proposalId: proposal.id, modules: newModules }),
        });
    };

    const copyPublicLink = () => {
        const url = `${window.location.origin}/proposta/${proposal?.publicSlug}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const statusInfo = proposal ? STATUS_LABELS[proposal.status] ?? STATUS_LABELS.draft : null;

    return (
        <div className="glass-panel rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-transparent"
            onClick={handleInit}
        >
            {/* Header */}
            <div className="p-6 flex items-center justify-between border-b border-border/40">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">Proposta Comercial</h3>
                        <p className="text-sm text-muted-foreground">
                            {allVersions.length > 0 ? `${allVersions.length} versão(ões)` : "Nenhuma gerada ainda"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {statusInfo && (
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${statusInfo.color}`}>
                            {statusInfo.label}
                        </span>
                    )}
                    <button
                        onClick={generate}
                        disabled={isGenerating}
                        className="btn-primary flex items-center gap-2 text-sm"
                    >
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        {proposal ? "Regenerar" : "Gerar Proposta"}
                    </button>
                </div>
            </div>

            {isLoading && (
                <div className="p-8 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Carregando proposta...
                </div>
            )}

            {!isLoading && !proposal && loadedOnce && (
                <div className="p-8 text-center text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Clique em "Gerar Proposta" para criar a primeira versão.</p>
                </div>
            )}

            {proposal && !isLoading && (
                <div className="p-6 space-y-6">
                    {/* Executive Summary */}
                    <div>
                        <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Resumo Executivo</h4>
                        <p className="text-sm leading-relaxed text-foreground/90">
                            {proposal.executiveSummary || proposal.presalesSnapshot?.executiveSummary}
                        </p>
                    </div>

                    {/* Modules */}
                    <div>
                        <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Package className="w-4 h-4" /> Módulos ({proposal.modules.filter(m => m.included).length} incluídos)
                        </h4>
                        <div className="space-y-2">
                            {proposal.modules.map(mod => (
                                <div key={mod.id}
                                    className={`rounded-lg border transition-colors ${mod.included ? "border-primary/30 bg-primary/5" : "border-border/30 bg-muted/10 opacity-60"}`}
                                >
                                    <div className="p-4 flex items-center gap-3"
                                        onClick={() => setExpandedModule(expandedModule === mod.id ? null : mod.id)}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={mod.included}
                                            onChange={e => { e.stopPropagation(); toggleModule(mod.id, e.target.checked); }}
                                            className="w-4 h-4 accent-primary cursor-pointer shrink-0"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm">{mod.title}</p>
                                            <p className="text-xs text-muted-foreground truncate">{mod.description}</p>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className="text-xs text-muted-foreground">{mod.estimatedWeeks}w</span>
                                            <span className="text-xs font-semibold text-primary">{formatBRL(mod.basePrice)}</span>
                                            {expandedModule === mod.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </div>
                                    </div>
                                    {expandedModule === mod.id && (
                                        <div className="px-4 pb-4 pt-0 border-t border-border/30">
                                            <p className="text-xs font-semibold text-muted-foreground mb-2 mt-3">Entregas:</p>
                                            <ul className="space-y-1">
                                                {mod.deliverables.map((d, i) => (
                                                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                                                        <CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                                                        {d}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pricing + ROI */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="glass-panel rounded-xl border border-green-500/20 bg-green-500/5 p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <DollarSign className="w-4 h-4 text-green-500" />
                                <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Investimento</span>
                            </div>
                            <p className="text-2xl font-black text-foreground">
                                {formatBRL(proposal.pricingEstimate.minBRL)} – {formatBRL(proposal.pricingEstimate.maxBRL)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">{proposal.pricingEstimate.basis}</p>
                        </div>

                        <div className="glass-panel rounded-xl border border-blue-400/20 bg-blue-400/5 p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <TrendingUp className="w-4 h-4 text-blue-400" />
                                <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">ROI Projetado</span>
                            </div>
                            <p className="text-2xl font-black text-foreground">
                                {formatBRL(proposal.roiSnapshot.operationalSavings + proposal.roiSnapshot.revenueIncrease)}/mês
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">Payback: {proposal.roiSnapshot.paybackMonths} meses • Confiança: {proposal.roiSnapshot.confidenceLevel}</p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3 pt-2 border-t border-border/40">
                        <button
                            onClick={copyPublicLink}
                            className="btn-secondary flex items-center gap-2 text-sm"
                        >
                            {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            {copied ? "Copiado!" : "Copiar Link Público"}
                        </button>
                        <a
                            href={`/proposta/${proposal.publicSlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary flex items-center gap-2 text-sm"
                        >
                            <ExternalLink className="w-4 h-4" /> Ver Proposta
                        </a>
                        <button
                            onClick={() => markAs("sent")}
                            disabled={status === "saving" || proposal.status === "sent"}
                            className="btn-primary flex items-center gap-2 text-sm ml-auto"
                        >
                            <Send className="w-4 h-4" />
                            {status === "saving" ? "Salvando..." : status === "saved" ? "✓ Enviada!" : "Marcar como Enviada"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
