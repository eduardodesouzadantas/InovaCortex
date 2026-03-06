"use client";
/**
 * app/org/[slug]/admin/marketing/repurpose-panel.tsx
 * V21: Repurpose Asset panel — shown per MarketingPlan entry (posted/approved).
 *
 * Shows:
 *  - "Gerar Repurpose" button
 *  - Pipeline of artifacts: draft → reviewed → approved → published
 *  - Per-format copy buttons (LinkedIn V2, Carousel, Thread, Video, Email)
 *  - Status mutation buttons: revisar / aprovar
 */

import { useState } from "react";

interface RepurposeArtifact {
    id: string;
    status: string;
    formatsJson: string;
    createdAt: string;
}

interface Format {
    label: string;
    key: string;
    extract: (f: any) => string;
}

const FORMATS: Format[] = [
    {
        label: "🔷 LinkedIn V2",
        key: "linkedin_v2",
        extract: (f) => `${f?.hook ?? ""}\n\n${f?.text ?? ""}\n\n${f?.cta ?? ""}`.trim(),
    },
    {
        label: "📸 Carrossel",
        key: "carousel",
        extract: (f) => `${f?.title ?? ""}\n\n${(f?.slides ?? []).map((s: string, i: number) => `Slide ${i + 1}: ${s}`).join("\n")}\n\n${f?.cta ?? ""}`.trim(),
    },
    {
        label: "🐦 Thread",
        key: "thread",
        extract: (f) => (f?.tweets ?? []).join("\n\n"),
    },
    {
        label: "🎬 Roteiro",
        key: "video",
        extract: (f) => {
            const scenes = (f?.scenes ?? []).map((s: any) => `[${s.sec}s] Fala: ${s.fala}\n     Tela: ${s.tela}`).join("\n");
            return `HOOK: ${f?.hook ?? ""}\n\n${scenes}\n\nCTA: ${f?.cta ?? ""}`.trim();
        },
    },
    {
        label: "📧 E-mail",
        key: "email",
        extract: (f) => `Assunto: ${f?.subject ?? ""}\n\n${f?.body ?? ""}`.trim(),
    },
];

const STATUS_COLORS: Record<string, string> = {
    draft: "bg-gray-700 text-gray-300",
    reviewed: "bg-blue-900 text-blue-200",
    approved: "bg-emerald-900 text-emerald-300",
    published: "bg-green-700 text-green-200",
};

interface Props {
    orgSlug: string;
    planId: string;
    planStatus: string;
    artifacts: RepurposeArtifact[];
}

export function RepurposePanel({ orgSlug, planId, planStatus, artifacts }: Props) {
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [localArtifacts, setLocalArtifacts] = useState(artifacts);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const canGenerate = ["approved", "posted"].includes(planStatus);

    async function generate() {
        setLoading(true); setMsg(null);
        try {
            const res = await fetch(`/api/org/${orgSlug}/marketing/repurpose`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ marketingPlanId: planId }),
            });
            const data = await res.json();
            setMsg(data.message ?? (res.ok ? "Gerado!" : "Erro"));
            if (res.ok) window.location.reload();
        } catch (e: any) {
            setMsg(e?.message ?? "Erro inesperado");
        } finally {
            setLoading(false);
        }
    }

    async function mutateArtifact(artifactId: string, action: string) {
        setLoading(true); setMsg(null);
        try {
            const res = await fetch(`/api/org/${orgSlug}/marketing/repurpose`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ artifactId, action }),
            });
            const data = await res.json();
            setMsg(data.message ?? (res.ok ? "Feito!" : "Erro"));
            if (res.ok) {
                setLocalArtifacts(prev =>
                    prev.map(a => a.id === artifactId ? { ...a, status: data.status } : a)
                );
            }
        } catch (e: any) {
            setMsg(e?.message ?? "Erro inesperado");
        } finally {
            setLoading(false);
        }
    }

    function copyFormat(artifact: RepurposeArtifact, fmt: Format) {
        try {
            const parsed = JSON.parse(artifact.formatsJson);
            const text = fmt.extract(parsed[fmt.key]);
            navigator.clipboard.writeText(text);
            setCopiedKey(`${artifact.id}-${fmt.key}`);
            setTimeout(() => setCopiedKey(null), 2000);
        } catch { /* ignore */ }
    }

    return (
        <div className="mt-3 border border-gray-700 rounded-lg p-4 space-y-4 bg-gray-900/40">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-300">🔁 Repurpose Assets</h3>
                {canGenerate && (
                    <button
                        onClick={generate}
                        disabled={loading}
                        className="px-3 py-1 rounded text-xs font-medium bg-violet-800/70 text-violet-200 hover:bg-violet-700 disabled:opacity-50 transition-all"
                    >
                        {loading ? "Gerando…" : "✨ Gerar Repurpose"}
                    </button>
                )}
            </div>

            {msg && (
                <p className="text-xs text-amber-300">{msg}</p>
            )}

            {localArtifacts.length === 0 && (
                <p className="text-xs text-gray-500">Nenhum repurpose gerado ainda.</p>
            )}

            {localArtifacts.map(artifact => {
                const parsed = (() => { try { return JSON.parse(artifact.formatsJson); } catch { return {}; } })();

                return (
                    <div key={artifact.id} className="border border-gray-700 rounded-lg p-3 space-y-3">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[artifact.status] ?? "bg-gray-700 text-gray-300"}`}>
                                    {artifact.status}
                                </span>
                                <span className="text-xs text-gray-500">
                                    {new Date(artifact.createdAt).toLocaleDateString("pt-BR")}
                                </span>
                            </div>
                            <div className="flex gap-1.5">
                                {artifact.status === "draft" && (
                                    <button
                                        onClick={() => mutateArtifact(artifact.id, "review")}
                                        disabled={loading}
                                        className="px-2 py-0.5 text-xs rounded bg-blue-800/60 text-blue-200 hover:bg-blue-700 disabled:opacity-50"
                                    >Revisar</button>
                                )}
                                {["draft", "reviewed"].includes(artifact.status) && (
                                    <button
                                        onClick={() => mutateArtifact(artifact.id, "approve")}
                                        disabled={loading}
                                        className="px-2 py-0.5 text-xs rounded bg-emerald-800/60 text-emerald-200 hover:bg-emerald-700 disabled:opacity-50"
                                    >Aprovar</button>
                                )}
                            </div>
                        </div>

                        {/* Format copy buttons */}
                        <div className="flex flex-wrap gap-2">
                            {FORMATS.map(fmt => {
                                const ck = `${artifact.id}-${fmt.key}`;
                                const hasData = !!parsed[fmt.key];
                                return (
                                    <button
                                        key={fmt.key}
                                        onClick={() => copyFormat(artifact, fmt)}
                                        disabled={!hasData}
                                        title={hasData ? `Copiar ${fmt.label}` : "Sem dados"}
                                        className={`px-2 py-1 text-xs rounded transition-all
                                            ${copiedKey === ck
                                                ? "bg-green-700 text-white"
                                                : hasData
                                                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                                    : "bg-gray-800 text-gray-600 cursor-not-allowed"}`}
                                    >
                                        {copiedKey === ck ? "✓ Copiado" : fmt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
