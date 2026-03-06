"use client";
/**
 * app/org/[slug]/admin/authority/authority-library-client.tsx
 * V21: Authority Library interactive client.
 *
 * Features:
 *  - ProofStatSnapshot top banner with copy buttons per stat
 *  - Filter pills: status / type
 *  - ProofAsset cards: type + anonLevel badges, body preview + full viewer
 *  - Actions: review → approve → publish (with guardrail for 'none' + !allowPublicName)
 *  - Copy body to clipboard
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatBRL } from "@/lib/authority/stub-proof-pack";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProofAsset {
    id: string;
    workspaceId: string;
    type: string;
    anonLevel: string;
    status: string;
    title: string;
    body: string;
    metricsJson: string;
    createdAt: string;
}

interface ProofStats {
    totalCases: number;
    avgPaybackMonths: number;
    avgMonthlyEconomy: number;
    avgMonthlyRevenue: number;
    avgHoursSaved: number;
}

interface Props {
    orgSlug: string;
    orgId: string;
    assets: ProofAsset[];
    stats: ProofStats | null;
    activeFilters: { status?: string; type?: string };
}

// ─── Badges ───────────────────────────────────────────────────────────────────

const TYPE_BADGES: Record<string, { icon: string; color: string }> = {
    case_study: { icon: "📄", color: "bg-blue-900 text-blue-200" },
    linkedin_case: { icon: "🔷", color: "bg-indigo-900 text-indigo-200" },
    stat_card: { icon: "📊", color: "bg-amber-900 text-amber-200" },
};

const STATUS_COLORS: Record<string, string> = {
    draft: "bg-gray-700 text-gray-300",
    reviewed: "bg-blue-900 text-blue-300",
    approved: "bg-emerald-900 text-emerald-300",
    published: "bg-green-700 text-green-200",
};

const ANON_BADGES: Record<string, string> = {
    full: "🔒 full",
    sector_only: "🏢 sector",
    size_only: "👥 size",
    none: "🌐 nome real",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AuthorityLibraryClient({ orgSlug, assets, stats, activeFilters }: Props) {
    const router = useRouter();
    const [, startTransition] = useTransition();
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<{ id: string; msg: string; ok: boolean } | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    function applyFilter(key: string, value: string) {
        const current = new URLSearchParams(activeFilters as Record<string, string>);
        if (current.get(key) === value) current.delete(key); else current.set(key, value);
        startTransition(() => router.push(`/org/${orgSlug}/admin/authority?${current.toString()}`));
    }

    async function mutate(assetId: string, action: string) {
        setLoadingId(assetId); setFeedback(null);
        try {
            const res = await fetch(`/api/org/${orgSlug}/authority/assets`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assetId, action }),
            });
            const data = await res.json();
            setFeedback({ id: assetId, msg: data.message ?? (res.ok ? "Feito!" : "Erro"), ok: res.ok });
            if (res.ok) startTransition(() => router.refresh());
        } catch (e: any) {
            setFeedback({ id: assetId, msg: e?.message ?? "Erro", ok: false });
        } finally { setLoadingId(null); }
    }

    function copyText(key: string, text: string) {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    }

    const statuses = ["draft", "reviewed", "approved", "published"];
    const types = ["case_study", "linkedin_case", "stat_card"];

    return (
        <div className="space-y-6">
            {/* ── Proof Stats Banner ──────────────────────────────────────── */}
            {stats && (
                <div className="bg-gradient-to-r from-emerald-950/60 to-blue-950/60 border border-emerald-800/40 rounded-xl p-5">
                    <h2 className="text-sm font-semibold text-emerald-300 mb-3">📈 Proof Stats Agregadas</h2>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                            { label: "Casos", value: `${stats.totalCases}`, key: "cases" },
                            { label: "Payback médio", value: `${stats.avgPaybackMonths} meses`, key: "payback" },
                            { label: "Economia/mês", value: formatBRL(stats.avgMonthlyEconomy), key: "economy" },
                            { label: "Receita/mês", value: formatBRL(stats.avgMonthlyRevenue), key: "revenue" },
                            { label: "Horas/mês", value: `${stats.avgHoursSaved}h`, key: "hours" },
                        ].map(stat => (
                            <button
                                key={stat.key}
                                onClick={() => copyText(`stat-${stat.key}`, `${stat.label}: ${stat.value}`)}
                                className="flex flex-col items-start bg-gray-900/60 rounded-lg p-3 hover:bg-gray-800/60 transition-all text-left"
                                title="Copiar para proposta"
                            >
                                <span className="text-xs text-gray-400">{stat.label}</span>
                                <span className="text-lg font-bold text-white mt-0.5">{stat.value}</span>
                                <span className="text-xs text-emerald-500 mt-1">
                                    {copiedKey === `stat-${stat.key}` ? "✓ Copiado" : "📋 copiar"}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Filters ────────────────────────────────────────────────── */}
            <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-gray-500 self-center">Status:</span>
                    {statuses.map(s => (
                        <button key={s} onClick={() => applyFilter("status", s)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all
                                ${activeFilters.status === s
                                    ? (STATUS_COLORS[s] ?? "bg-gray-600 text-white") + " ring-2 ring-white/20"
                                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
                            {s}
                        </button>
                    ))}
                    <span className="text-xs text-gray-500 self-center ml-3">Tipo:</span>
                    {types.map(t => (
                        <button key={t} onClick={() => applyFilter("type", t)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all
                                ${activeFilters.type === t
                                    ? "bg-blue-800 text-blue-200 ring-2 ring-blue-400/30"
                                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
                            {TYPE_BADGES[t]?.icon} {t.replace("_", " ")}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Assets List ─────────────────────────────────────────────── */}
            {assets.length === 0 && (
                <div className="text-center py-16 text-gray-500">
                    Nenhum ativo encontrado. Quando um workspace for concluído, os proof assets serão gerados automaticamente.
                </div>
            )}

            <div className="space-y-3">
                {assets.map(asset => {
                    const isLoading = loadingId === asset.id;
                    const fb = feedback?.id === asset.id ? feedback : null;
                    const typeBadge = TYPE_BADGES[asset.type] ?? { icon: "📁", color: "bg-gray-700 text-gray-300" };
                    const isExpanded = expandedId === asset.id;

                    return (
                        <div key={asset.id} className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
                            {/* Header */}
                            <div className="p-4 flex flex-wrap items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap gap-2 mb-1.5">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeBadge.color}`}>
                                            {typeBadge.icon} {asset.type.replace("_", " ")}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[asset.status] ?? "bg-gray-700 text-gray-300"}`}>
                                            {asset.status}
                                        </span>
                                        <span className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-400">
                                            {ANON_BADGES[asset.anonLevel] ?? asset.anonLevel}
                                        </span>
                                    </div>
                                    <p className="text-white font-medium text-sm truncate">{asset.title}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {new Date(asset.createdAt).toLocaleDateString("pt-BR")}
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-wrap gap-1.5 items-center">
                                    {fb && (
                                        <span className={`text-xs px-2 py-0.5 rounded ${fb.ok ? "text-green-400" : "text-red-400"}`}>
                                            {fb.ok ? "✓" : "✗"} {fb.msg}
                                        </span>
                                    )}

                                    {/* Copy body */}
                                    <button
                                        onClick={() => copyText(asset.id, asset.body)}
                                        className={`px-2 py-1 text-xs rounded transition-all
                                            ${copiedKey === asset.id ? "bg-green-700 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
                                    >{copiedKey === asset.id ? "✓ Copiado" : "📋"}</button>

                                    {/* Expand / collapse */}
                                    <button
                                        onClick={() => setExpandedId(isExpanded ? null : asset.id)}
                                        className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-all"
                                    >{isExpanded ? "▲" : "▼"}</button>

                                    {/* Status transitions */}
                                    {asset.status === "draft" && (
                                        <ActionBtn label="Revisar" color="blue" loading={isLoading} onClick={() => mutate(asset.id, "review")} />
                                    )}
                                    {["draft", "reviewed"].includes(asset.status) && (
                                        <ActionBtn label="Aprovar" color="green" loading={isLoading} onClick={() => mutate(asset.id, "approve")} />
                                    )}
                                    {asset.status === "approved" && (
                                        <ActionBtn label="Publicar" color="emerald" loading={isLoading} onClick={() => mutate(asset.id, "publish")} />
                                    )}
                                </div>
                            </div>

                            {/* Expanded body viewer */}
                            {isExpanded && (
                                <div className="border-t border-gray-800 bg-gray-950/40 p-4">
                                    <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto">
                                        {asset.body}
                                    </pre>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function ActionBtn({ label, color, loading, onClick }: {
    label: string; color: string; loading: boolean; onClick: () => void;
}) {
    const colors: Record<string, string> = {
        blue: "bg-blue-800/60 text-blue-200 hover:bg-blue-700",
        green: "bg-green-800/60 text-green-200 hover:bg-green-700",
        emerald: "bg-emerald-800/60 text-emerald-200 hover:bg-emerald-700",
    };
    return (
        <button onClick={onClick} disabled={loading}
            className={`px-2 py-1 text-xs rounded font-medium transition-all disabled:opacity-50
                ${colors[color] ?? "bg-gray-700 text-white hover:bg-gray-600"}`}>
            {loading ? "…" : label}
        </button>
    );
}
