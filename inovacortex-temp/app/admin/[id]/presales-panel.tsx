"use client";

import { useState } from "react";
import {
    Sparkles, RefreshCw, Copy, Check, Loader2,
    FileText, HelpCircle, Network, ChevronDown, ChevronUp,
    AlertCircle
} from "lucide-react";

interface PreSalesData {
    id: string;
    version: number;
    executiveSummary: string;
    diagnosticQuestions: string[];
    initialArchitecture: {
        blocks: { title: string; description: string }[];
        integrations: string[];
        roadmap: { week: string; action: string }[];
    };
    createdAt: string;
}

export function PreSalesPanel({ assessmentId }: { assessmentId: string }) {
    const [isLoading, setIsLoading] = useState(false);
    const [artifact, setArtifact] = useState<PreSalesData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copiedSection, setCopiedSection] = useState<string | null>(null);
    const [openSection, setOpenSection] = useState<string>("summary");

    const generate = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/leads/${assessmentId}/generate-presales`, {
                method: "POST"
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erro ao gerar artefatos");
            setArtifact(data.artifact);
            setOpenSection("summary");
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopiedSection(label);
        setTimeout(() => setCopiedSection(null), 2000);
    };

    const copyQuestionsForWhatsApp = () => {
        if (!artifact) return;
        const text = artifact.diagnosticQuestions
            .map((q, i) => `${i + 1}. ${q}`)
            .join("\n");
        const message = `Olá! Para avançarmos com a proposta personalizada, preciso esclarecer alguns pontos:\n\n${text}\n\nPodemos agendar uma call rápida? 🚀`;
        copyToClipboard(message, "whatsapp");
    };

    const toggleSection = (s: string) => setOpenSection(prev => prev === s ? "" : s);

    return (
        <div className="glass-panel rounded-xl border border-primary/20 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-border/50 bg-gradient-to-r from-primary/10 to-transparent flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">Agent de Pré-Vendas</h3>
                        <p className="text-xs text-muted-foreground">
                            {artifact ? `Versão ${artifact.version} • Gerado em ${new Date(artifact.createdAt).toLocaleDateString("pt-BR")}` : "Nenhum artefato gerado ainda"}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    {artifact && (
                        <button
                            onClick={copyQuestionsForWhatsApp}
                            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-green-500/30 bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors"
                        >
                            {copiedSection === "whatsapp" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            Copiar p/ WhatsApp
                        </button>
                    )}
                    <button
                        onClick={generate}
                        disabled={isLoading}
                        className="btn-primary flex items-center gap-2 text-sm"
                    >
                        {isLoading ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                        ) : artifact ? (
                            <><RefreshCw className="w-4 h-4" /> Regenerar</>
                        ) : (
                            <><Sparkles className="w-4 h-4" /> Gerar Pré-Vendas</>
                        )}
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="mx-6 mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-red-500">Falha ao gerar artefatos</p>
                        <p className="text-xs text-red-400 mt-1">{error}</p>
                        {error.includes("OPENAI_API_KEY") && (
                            <p className="text-xs text-muted-foreground mt-2">
                                Adicione <code className="bg-muted px-1 rounded">OPENAI_API_KEY=sk-...</code> no seu arquivo <code className="bg-muted px-1 rounded">.env</code>
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Loading skeleton */}
            {isLoading && !artifact && (
                <div className="p-6 space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="animate-pulse space-y-2">
                            <div className="h-4 bg-muted rounded w-1/3" />
                            <div className="h-3 bg-muted/50 rounded w-full" />
                            <div className="h-3 bg-muted/50 rounded w-5/6" />
                        </div>
                    ))}
                </div>
            )}

            {/* Empty state */}
            {!isLoading && !artifact && !error && (
                <div className="p-12 text-center">
                    <Sparkles className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium">Nenhum artefato gerado</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">Clique em "Gerar Pré-Vendas" para o agente de IA criar os 3 artefatos personalizados</p>
                </div>
            )}

            {/* Artifact Content */}
            {artifact && !isLoading && (
                <div className="divide-y divide-border/30">
                    {/* Resumo Executivo */}
                    <div>
                        <button
                            onClick={() => toggleSection("summary")}
                            className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/20 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <FileText className="w-4 h-4 text-primary" />
                                <span className="font-semibold">Resumo Executivo</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(artifact.executiveSummary, "summary"); }}
                                    className="text-xs text-muted-foreground hover:text-foreground p-1 rounded"
                                >
                                    {copiedSection === "summary" ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                                {openSection === "summary" ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                            </div>
                        </button>
                        {openSection === "summary" && (
                            <div className="px-6 pb-5">
                                <div className="bg-muted/20 rounded-lg p-4 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap border border-border/30">
                                    {artifact.executiveSummary}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Perguntas de Diagnóstico */}
                    <div>
                        <button
                            onClick={() => toggleSection("questions")}
                            className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/20 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <HelpCircle className="w-4 h-4 text-blue-400" />
                                <span className="font-semibold">Perguntas de Diagnóstico</span>
                                <span className="text-xs text-muted-foreground">({artifact.diagnosticQuestions.length} perguntas)</span>
                            </div>
                            {openSection === "questions" ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </button>
                        {openSection === "questions" && (
                            <div className="px-6 pb-5 space-y-2">
                                {artifact.diagnosticQuestions.map((q, i) => (
                                    <div key={i} className="flex gap-3 p-3 rounded-lg bg-muted/20 border border-border/30 hover:border-blue-400/30 transition-colors group">
                                        <span className="text-blue-400 font-bold text-sm shrink-0 mt-0.5">{i + 1}.</span>
                                        <p className="text-sm">{q}</p>
                                        <button
                                            onClick={() => copyToClipboard(q, `q-${i}`)}
                                            className="opacity-0 group-hover:opacity-100 ml-auto shrink-0 transition-opacity"
                                        >
                                            {copiedSection === `q-${i}` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Proposta de Arquitetura */}
                    <div>
                        <button
                            onClick={() => toggleSection("architecture")}
                            className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/20 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <Network className="w-4 h-4 text-purple-400" />
                                <span className="font-semibold">Proposta de Arquitetura Inicial</span>
                            </div>
                            {openSection === "architecture" ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </button>
                        {openSection === "architecture" && (
                            <div className="px-6 pb-6 space-y-6">
                                {/* Blocos */}
                                <div>
                                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Módulos / Agentes</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {artifact.initialArchitecture.blocks.map((block, i) => (
                                            <div key={i} className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5">
                                                <h5 className="font-semibold text-sm text-purple-400 mb-1">{block.title}</h5>
                                                <p className="text-xs text-muted-foreground leading-relaxed">{block.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Integrações */}
                                <div>
                                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Integrações</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {artifact.initialArchitecture.integrations.map((int, i) => (
                                            <span key={i} className="px-3 py-1 rounded-full text-xs font-medium bg-muted border border-border/50">
                                                {int}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Roadmap */}
                                <div>
                                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Roadmap 30 Dias</h4>
                                    <div className="space-y-2">
                                        {artifact.initialArchitecture.roadmap.map((step, i) => (
                                            <div key={i} className="flex gap-4 p-3 rounded-lg bg-muted/20 border border-border/30">
                                                <span className="text-xs font-bold text-primary shrink-0 w-28">{step.week}</span>
                                                <p className="text-sm">{step.action}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
