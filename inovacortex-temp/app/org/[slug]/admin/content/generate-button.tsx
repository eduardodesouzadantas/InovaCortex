"use client";

import { useState } from "react";
import { Plus, Loader2, Linkedin, Instagram, FileText, MessageSquare, Video } from "lucide-react";

const CONTENT_TYPES = [
    { value: "linkedin", label: "Post LinkedIn", icon: Linkedin },
    { value: "instagram", label: "Post Instagram", icon: Instagram },
    { value: "case_breakdown", label: "Case Breakdown", icon: FileText },
    { value: "authority_thread", label: "Thread", icon: MessageSquare },
    { value: "video_script", label: "Roteiro de Vídeo", icon: Video },
] as const;

export function ContentGenerateButton({
    assessments,
    orgSlug,
}: {
    assessments: { id: string; company: string; scoreTotal: number }[];
    orgSlug: string;
}) {
    const [open, setOpen] = useState(false);
    const [type, setType] = useState<string>("linkedin");
    const [assessmentId, setAssessmentId] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();

    const handleGenerate = async () => {
        setLoading(true);
        setError(undefined);
        try {
            const res = await fetch("/api/admin/content", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, assessmentId: assessmentId || undefined }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Falha na geração");

            // Redirect to detail page
            window.location.href = `/org/${orgSlug}/admin/content/${data.artifact.id}`;
        } catch (e: any) {
            setError(e.message);
            setLoading(false);
        }
    };

    return (
        <>
            <button onClick={() => setOpen(true)}
                className="btn-primary flex items-center gap-2 text-sm">
                <Plus className="w-4 h-4" /> Gerar Conteúdo
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="glass-panel rounded-2xl border border-border/60 p-6 w-full max-w-md space-y-5">
                        <div>
                            <h2 className="font-bold text-lg">Gerar Conteúdo</h2>
                            <p className="text-xs text-muted-foreground mt-1">Selecione o tipo e a origem dos dados</p>
                        </div>

                        {/* Type picker */}
                        <div>
                            <label className="text-xs text-muted-foreground block mb-2">Tipo de conteúdo</label>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {CONTENT_TYPES.map(t => {
                                    const Icon = t.icon;
                                    return (
                                        <button key={t.value} onClick={() => setType(t.value)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${type === t.value ? "border-primary bg-primary/15 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                                            <Icon className="w-3.5 h-3.5 shrink-0" /> {t.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Assessment picker (optional) */}
                        <div>
                            <label className="text-xs text-muted-foreground block mb-2">Lead de origem (opcional)</label>
                            <select value={assessmentId} onChange={e => setAssessmentId(e.target.value)}
                                className="w-full h-9 px-3 rounded-lg border border-border bg-muted/20 text-sm">
                                <option value="">Cenário genérico</option>
                                {assessments.map(a => (
                                    <option key={a.id} value={a.id}>
                                        {a.company} ({a.scoreTotal}pts)
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-muted-foreground/60 mt-1">
                                Com lead: usa dados reais da empresa. Sem lead: usa cenário realista.
                            </p>
                        </div>

                        {error && (
                            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                                {error}
                            </p>
                        )}

                        <div className="flex gap-3">
                            <button onClick={() => setOpen(false)}
                                className="flex-1 btn-secondary text-sm">Cancelar</button>
                            <button onClick={handleGenerate} disabled={loading}
                                className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm">
                                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</> : "Gerar →"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
