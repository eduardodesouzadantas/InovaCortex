"use client";

import { useState } from "react";
import { Award, Loader2, BookOpen, Linkedin, FileText, Video, BarChart2 } from "lucide-react";

const ASSET_TYPES = [
    { value: "case_study", label: "Case Study", icon: BookOpen },
    { value: "linkedin_post", label: "Post LinkedIn", icon: Linkedin },
    { value: "article", label: "Artigo", icon: FileText },
    { value: "video_script", label: "Roteiro de Vídeo", icon: Video },
    { value: "stat_card", label: "Estatísticas", icon: BarChart2 },
] as const;

const ANON_LEVELS = [
    { value: "full", label: "Completo — setor + porte", desc: "Mais seguro" },
    { value: "sector_only", label: "Apenas setor", desc: "Ex: 'Clínica médica'" },
    { value: "size_only", label: "Apenas porte", desc: "Ex: 'empresa com 30 pessoas'" },
    { value: "none", label: "Sem anonimização", desc: "Nome real — requer autorização" },
] as const;

export function AuthorityGenerateButton({
    workspaces,
    orgSlug,
}: {
    workspaces: { id: string; companyName: string; status: string }[];
    orgSlug: string;
}) {
    const [open, setOpen] = useState(false);
    const [type, setType] = useState("case_study");
    const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
    const [anonLevel, setAnonLevel] = useState("full");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();

    const handleGenerate = async () => {
        if (!workspaceId) return setError("Selecione um workspace");
        setLoading(true);
        setError(undefined);
        try {
            const res = await fetch("/api/admin/authority", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "generate", workspaceId, type, anonLevel }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Falha na geração");
            window.location.href = `/org/${orgSlug}/admin/authority/${data.asset.id}`;
        } catch (e: any) {
            setError(e.message);
            setLoading(false);
        }
    };

    return (
        <>
            <button onClick={() => setOpen(true)}
                className="btn-primary flex items-center gap-2 text-sm">
                <Award className="w-4 h-4" /> Gerar Asset
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="glass-panel rounded-2xl border border-border/60 p-6 w-full max-w-lg space-y-5">
                        <div>
                            <h2 className="font-bold text-lg">Gerar Authority Asset</h2>
                            <p className="text-xs text-muted-foreground mt-1">Extrai métricas reais de um workspace concluído e gera narrativa estruturada</p>
                        </div>

                        {/* Workspace picker */}
                        <div>
                            <label className="text-xs text-muted-foreground block mb-2">Workspace de origem</label>
                            {workspaces.length === 0 ? (
                                <p className="text-sm text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-2">
                                    Nenhum workspace ativo/concluído. Conclua uma implantação primeiro.
                                </p>
                            ) : (
                                <select value={workspaceId} onChange={e => setWorkspaceId(e.target.value)}
                                    className="w-full h-9 px-3 rounded-lg border border-border bg-muted/20 text-sm">
                                    {workspaces.map(w => (
                                        <option key={w.id} value={w.id}>{w.companyName} ({w.status})</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Type picker */}
                        <div>
                            <label className="text-xs text-muted-foreground block mb-2">Tipo de asset</label>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {ASSET_TYPES.map(t => {
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

                        {/* Anon level */}
                        <div>
                            <label className="text-xs text-muted-foreground block mb-2">Nível de anonimização</label>
                            <div className="space-y-1.5">
                                {ANON_LEVELS.map(lvl => (
                                    <button key={lvl.value} onClick={() => setAnonLevel(lvl.value)}
                                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all flex justify-between items-center ${anonLevel === lvl.value ? "border-primary bg-primary/10" : "border-border/30 hover:border-border"}`}>
                                        <span>{lvl.label}</span>
                                        <span className="text-muted-foreground/60">{lvl.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {error && (
                            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
                        )}

                        <div className="flex gap-3">
                            <button onClick={() => setOpen(false)} className="flex-1 btn-secondary text-sm">Cancelar</button>
                            <button onClick={handleGenerate} disabled={loading || !workspaceId}
                                className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</> : "Gerar →"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
