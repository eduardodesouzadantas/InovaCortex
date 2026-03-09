"use client";

import { useState } from "react";
import { Plus, Loader2, Linkedin, Instagram, FileText, MessageSquare, Video } from "lucide-react";

const CONTENT_TYPES = [
    { value: "linkedin", label: "Post LinkedIn", icon: Linkedin },
    { value: "instagram", label: "Post Instagram", icon: Instagram },
    { value: "case_breakdown", label: "Case Breakdown", icon: FileText },
    { value: "authority_thread", label: "Thread", icon: MessageSquare },
    { value: "video_script", label: "Roteiro de Video", icon: Video },
] as const;

export function ContentGenerateButton({
    assessments,
    orgSlug,
    apiBasePath = "/api/admin/content",
    detailBasePath,
}: {
    assessments: { id: string; company: string; scoreTotal: number }[];
    orgSlug?: string;
    apiBasePath?: string;
    detailBasePath?: string;
}) {
    const [open, setOpen] = useState(false);
    const [type, setType] = useState<string>("linkedin");
    const [assessmentId, setAssessmentId] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();

    const resolvedDetailBasePath = detailBasePath ?? (orgSlug ? `/org/${orgSlug}/admin/content` : "/agency/content");

    const getErrorMessage = (error: unknown): string => {
        if (error instanceof Error) return error.message;
        return "Falha na geracao";
    };

    const handleGenerate = async () => {
        setLoading(true);
        setError(undefined);
        try {
            const res = await fetch(apiBasePath, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, assessmentId: assessmentId || undefined }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Falha na geracao");

            window.location.href = `${resolvedDetailBasePath}/${data.artifact.id}`;
        } catch (error: unknown) {
            setError(getErrorMessage(error));
            setLoading(false);
        }
    };

    return (
        <>
            <button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2 text-sm">
                <Plus className="w-4 h-4" /> Gerar Conteudo
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="glass-panel w-full max-w-md space-y-5 rounded-2xl border border-border/60 p-6">
                        <div>
                            <h2 className="text-lg font-bold">Gerar Conteudo</h2>
                            <p className="mt-1 text-xs text-muted-foreground">Selecione o tipo e a origem dos dados</p>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs text-muted-foreground">Tipo de conteudo</label>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {CONTENT_TYPES.map((contentType) => {
                                    const Icon = contentType.icon;
                                    return (
                                        <button
                                            key={contentType.value}
                                            onClick={() => setType(contentType.value)}
                                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-all ${
                                                type === contentType.value
                                                    ? "border-primary bg-primary/15 text-primary"
                                                    : "border-border/40 text-muted-foreground hover:border-border"
                                            }`}
                                        >
                                            <Icon className="h-3.5 w-3.5 shrink-0" /> {contentType.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs text-muted-foreground">Lead de origem (opcional)</label>
                            <select
                                value={assessmentId}
                                onChange={(e) => setAssessmentId(e.target.value)}
                                className="h-9 w-full rounded-lg border border-border bg-muted/20 px-3 text-sm"
                            >
                                <option value="">Cenario generico</option>
                                {assessments.map((assessment) => (
                                    <option key={assessment.id} value={assessment.id}>
                                        {assessment.company} ({assessment.scoreTotal}pts)
                                    </option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-muted-foreground/60">
                                Com lead: usa dados reais da empresa. Sem lead: usa cenario realista.
                            </p>
                        </div>

                        {error && (
                            <p className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-400">
                                {error}
                            </p>
                        )}

                        <div className="flex gap-3">
                            <button onClick={() => setOpen(false)} className="btn-secondary flex-1 text-sm">
                                Cancelar
                            </button>
                            <button
                                onClick={handleGenerate}
                                disabled={loading}
                                className="btn-primary flex flex-1 items-center justify-center gap-2 text-sm"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" /> Gerando...
                                    </>
                                ) : (
                                    "Gerar ->"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
