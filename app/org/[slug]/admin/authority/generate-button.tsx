"use client";

import { useState } from "react";
import { Award, Loader2, BookOpen, Linkedin, FileText, Video, BarChart2 } from "lucide-react";

const ASSET_TYPES = [
    { value: "case_study", label: "Case Study", icon: BookOpen },
    { value: "linkedin_post", label: "Post LinkedIn", icon: Linkedin },
    { value: "article", label: "Artigo", icon: FileText },
    { value: "video_script", label: "Roteiro de Video", icon: Video },
    { value: "stat_card", label: "Estatisticas", icon: BarChart2 },
] as const;

const ANON_LEVELS = [
    { value: "full", label: "Completo - setor + porte", desc: "Mais seguro" },
    { value: "sector_only", label: "Apenas setor", desc: "Ex: clinica medica" },
    { value: "size_only", label: "Apenas porte", desc: "Ex: empresa com 30 pessoas" },
    { value: "none", label: "Sem anonimizar", desc: "Nome real - exige autorizacao" },
] as const;

export function AuthorityGenerateButton({
    workspaces,
    orgSlug,
    apiBasePath = "/api/admin/authority",
    onGenerated,
}: {
    workspaces: { id: string; companyName: string; status: string }[];
    orgSlug?: string;
    apiBasePath?: string;
    onGenerated?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [type, setType] = useState("case_study");
    const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
    const [anonLevel, setAnonLevel] = useState("full");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();

    const getErrorMessage = (value: unknown): string => {
        if (value instanceof Error) return value.message;
        return "Falha na geracao";
    };

    const handleGenerate = async () => {
        if (!workspaceId) return setError("Selecione um workspace");
        setLoading(true);
        setError(undefined);
        try {
            const res = await fetch(apiBasePath, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "generate", workspaceId, type, anonLevel }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Falha na geracao");

            setOpen(false);
            onGenerated?.();
            if (orgSlug) {
                window.location.href = `/org/${orgSlug}/admin/authority`;
            }
        } catch (error: unknown) {
            setError(getErrorMessage(error));
            setLoading(false);
        }
    };

    return (
        <>
            <button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2 text-sm">
                <Award className="h-4 w-4" /> Gerar Asset
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="glass-panel w-full max-w-lg space-y-5 rounded-2xl border border-border/60 p-6">
                        <div>
                            <h2 className="text-lg font-bold">Gerar Authority Asset</h2>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Extrai metricas reais do workspace e gera narrativa estruturada.
                            </p>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs text-muted-foreground">Workspace de origem</label>
                            {workspaces.length === 0 ? (
                                <p className="rounded-lg border border-yellow-400/20 bg-yellow-400/10 px-3 py-2 text-sm text-yellow-400">
                                    Nenhum workspace disponivel.
                                </p>
                            ) : (
                                <select
                                    value={workspaceId}
                                    onChange={(e) => setWorkspaceId(e.target.value)}
                                    className="h-9 w-full rounded-lg border border-border bg-muted/20 px-3 text-sm"
                                >
                                    {workspaces.map((workspace) => (
                                        <option key={workspace.id} value={workspace.id}>
                                            {workspace.companyName} ({workspace.status})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div>
                            <label className="mb-2 block text-xs text-muted-foreground">Tipo de asset</label>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {ASSET_TYPES.map((assetType) => {
                                    const Icon = assetType.icon;
                                    return (
                                        <button
                                            key={assetType.value}
                                            onClick={() => setType(assetType.value)}
                                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-all ${
                                                type === assetType.value
                                                    ? "border-primary bg-primary/15 text-primary"
                                                    : "border-border/40 text-muted-foreground hover:border-border"
                                            }`}
                                        >
                                            <Icon className="h-3.5 w-3.5 shrink-0" /> {assetType.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs text-muted-foreground">Nivel de anonimato</label>
                            <div className="space-y-1.5">
                                {ANON_LEVELS.map((level) => (
                                    <button
                                        key={level.value}
                                        onClick={() => setAnonLevel(level.value)}
                                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-all ${
                                            anonLevel === level.value
                                                ? "border-primary bg-primary/10"
                                                : "border-border/30 hover:border-border"
                                        }`}
                                    >
                                        <span>{level.label}</span>
                                        <span className="text-muted-foreground/60">{level.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {error && (
                            <p className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-400">{error}</p>
                        )}

                        <div className="flex gap-3">
                            <button onClick={() => setOpen(false)} className="btn-secondary flex-1 text-sm">
                                Cancelar
                            </button>
                            <button
                                onClick={handleGenerate}
                                disabled={loading || !workspaceId}
                                className="btn-primary flex flex-1 items-center justify-center gap-2 text-sm disabled:opacity-50"
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
