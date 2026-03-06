"use client";
/**
 * app/org/[slug]/admin/marketing/marketing-calendar-client.tsx
 * V20.1: Interactive 30-day marketing calendar.
 *
 * Actions:
 *  - "Revisar"      → status: reviewed
 *  - "Aprovar"      → status: approved
 *  - "Agendar"      → status: scheduled + scheduledFor = best hour today/tomorrow
 *  - "Publicar"     → calls /api/org/[slug]/marketing/publish
 *  - "Copiar pack"  → copies PostingPack instructions to clipboard
 *
 * Filters: status, platform, postType (URL-based via router.push)
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarketingPlan {
    id: string;
    day: number;
    platform: string;
    postType: string;
    topic: string;
    hook: string;
    cta: string;
    priority: number;
    status: string;
    scheduledFor: string | null;
    postedAt: string | null;
    contentJson: string | null;
}

interface Props {
    orgSlug: string;
    orgId: string;
    plans: MarketingPlan[];
    activeFilters: { status?: string; platform?: string; postType?: string };
}

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
    draft: "bg-gray-700 text-gray-200",
    reviewed: "bg-blue-900 text-blue-200",
    approved: "bg-emerald-900 text-emerald-300",
    scheduled: "bg-purple-900 text-purple-200",
    posted: "bg-green-700 text-green-200",
    ready_to_post: "bg-amber-800 text-amber-200",
};

const POST_TYPE_ICONS: Record<string, string> = {
    authority: "⚡",
    case: "📊",
    insight: "💡",
    demonstration: "🎬",
    offer: "🎯",
    myth_break: "🔍",
};

const PLATFORM_ICONS: Record<string, string> = {
    linkedin: "🔷",
    instagram: "📸",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function MarketingCalendarClient({ orgSlug, orgId, plans, activeFilters }: Props) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<{ id: string; msg: string; ok: boolean } | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // ── Filter Controls ───────────────────────────────────────────────────────

    function applyFilter(key: string, value: string) {
        const params = new URLSearchParams({
            ...activeFilters,
            [key]: value === (activeFilters as any)[key] ? "" : value,
        });
        // remove empty params
        for (const k of Array.from(params.keys())) {
            if (!params.get(k)) params.delete(k);
        }
        startTransition(() => router.push(`/org/${orgSlug}/admin/marketing?${params.toString()}`));
    }

    // ── Mutation helper ───────────────────────────────────────────────────────

    async function callApi(planId: string, action: string, extra?: object) {
        setLoadingId(planId);
        setFeedback(null);
        try {
            const res = await fetch(`/api/org/${orgSlug}/marketing/plans`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planId, action, ...extra }),
            });
            const data = await res.json();
            setFeedback({ id: planId, msg: data.message ?? (res.ok ? "Feito!" : "Erro"), ok: res.ok });
            if (res.ok) startTransition(() => router.refresh());
        } catch (err: any) {
            setFeedback({ id: planId, msg: err?.message ?? "Erro inesperado", ok: false });
        } finally {
            setLoadingId(null);
        }
    }

    // ── Copy pack to clipboard ────────────────────────────────────────────────

    function copyPack(plan: MarketingPlan) {
        try {
            const parsed = JSON.parse(plan.contentJson ?? "{}");
            const pack = parsed.postingPack;
            if (!pack) return;
            navigator.clipboard.writeText(pack.instructions ?? JSON.stringify(pack, null, 2));
            setCopiedId(plan.id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch { /* ignore */ }
    }

    // ── Filter pills ──────────────────────────────────────────────────────────

    const statuses = ["draft", "reviewed", "approved", "scheduled", "posted", "ready_to_post"];
    const platforms = ["linkedin", "instagram"];
    const postTypes = ["authority", "case", "insight", "demonstration", "offer", "myth_break"];

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-gray-500 self-center">Status:</span>
                    {statuses.map(s => (
                        <button
                            key={s}
                            onClick={() => applyFilter("status", s)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all
                                ${activeFilters.status === s
                                    ? (STATUS_COLORS[s] ?? "bg-gray-600 text-white") + " ring-2 ring-white/30"
                                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
                        >
                            {s.replace("_", " ")}
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-gray-500 self-center">Plataforma:</span>
                    {platforms.map(p => (
                        <button
                            key={p}
                            onClick={() => applyFilter("platform", p)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all
                                ${activeFilters.platform === p
                                    ? "bg-blue-600 text-white ring-2 ring-blue-400/30"
                                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
                        >
                            {PLATFORM_ICONS[p]} {p}
                        </button>
                    ))}
                    <span className="text-xs text-gray-500 self-center ml-3">Tipo:</span>
                    {postTypes.map(t => (
                        <button
                            key={t}
                            onClick={() => applyFilter("postType", t)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all
                                ${activeFilters.postType === t
                                    ? "bg-violet-700 text-white ring-2 ring-violet-400/30"
                                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
                        >
                            {POST_TYPE_ICONS[t]} {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* Plans Table */}
            <div className="overflow-x-auto rounded-xl border border-gray-800">
                <table className="w-full text-sm">
                    <thead className="bg-gray-900 text-gray-400 uppercase text-xs">
                        <tr>
                            <th className="px-4 py-3 text-left w-12">Dia</th>
                            <th className="px-4 py-3 text-left">Plataforma</th>
                            <th className="px-4 py-3 text-left">Tipo</th>
                            <th className="px-4 py-3 text-left">Tópico</th>
                            <th className="px-4 py-3 text-left">Status</th>
                            <th className="px-4 py-3 text-left">Agendado</th>
                            <th className="px-4 py-3 text-left">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {plans.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                                    Nenhum post encontrado. Gere o calendário primeiro.
                                </td>
                            </tr>
                        )}
                        {plans.map(plan => {
                            const isLoading = loadingId === plan.id;
                            const fb = feedback?.id === plan.id ? feedback : null;
                            const contentParsed = (() => { try { return JSON.parse(plan.contentJson ?? "{}"); } catch { return {}; } })();
                            const hasContent = !!contentParsed.text;
                            const hasPack = !!contentParsed.postingPack;

                            return (
                                <tr key={plan.id} className="bg-gray-900/50 hover:bg-gray-800/60 transition-colors">
                                    {/* Day */}
                                    <td className="px-4 py-3 font-bold text-gray-300">
                                        {plan.day}
                                        <div className="text-xs text-gray-600">P{plan.priority}</div>
                                    </td>

                                    {/* Platform */}
                                    <td className="px-4 py-3">
                                        <span className="flex items-center gap-1 text-gray-300">
                                            {PLATFORM_ICONS[plan.platform]}
                                            <span className="capitalize hidden sm:inline">{plan.platform}</span>
                                        </span>
                                    </td>

                                    {/* Post Type */}
                                    <td className="px-4 py-3">
                                        <span className="flex items-center gap-1 text-gray-300">
                                            {POST_TYPE_ICONS[plan.postType]}
                                            <span className="text-xs text-gray-400">{plan.postType}</span>
                                        </span>
                                    </td>

                                    {/* Topic */}
                                    <td className="px-4 py-3 max-w-xs">
                                        <p className="text-gray-200 truncate" title={plan.topic}>{plan.topic}</p>
                                        {!hasContent && (
                                            <span className="text-xs text-amber-500">⚠ Sem conteúdo gerado</span>
                                        )}
                                    </td>

                                    {/* Status */}
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[plan.status] ?? "bg-gray-700 text-gray-300"}`}>
                                            {plan.status.replace("_", " ")}
                                        </span>
                                        {plan.postedAt && (
                                            <div className="text-xs text-gray-500 mt-1">
                                                {new Date(plan.postedAt).toLocaleDateString("pt-BR")}
                                            </div>
                                        )}
                                    </td>

                                    {/* Scheduled */}
                                    <td className="px-4 py-3 text-xs text-gray-400">
                                        {plan.scheduledFor
                                            ? new Date(plan.scheduledFor).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })
                                            : <span className="text-gray-600">—</span>}
                                    </td>

                                    {/* Actions */}
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1.5">
                                            {/* Feedback message */}
                                            {fb && (
                                                <span className={`text-xs px-2 py-0.5 rounded ${fb.ok ? "text-green-400" : "text-red-400"}`}>
                                                    {fb.ok ? "✓" : "✗"} {fb.msg}
                                                </span>
                                            )}

                                            {/* Revisar */}
                                            {plan.status === "draft" && (
                                                <ActionBtn
                                                    label="Revisar"
                                                    color="blue"
                                                    loading={isLoading}
                                                    onClick={() => callApi(plan.id, "review")}
                                                />
                                            )}

                                            {/* Aprovar */}
                                            {(plan.status === "reviewed" || plan.status === "draft") && (
                                                <ActionBtn
                                                    label="Aprovar"
                                                    color="green"
                                                    loading={isLoading}
                                                    onClick={() => callApi(plan.id, "approve")}
                                                />
                                            )}

                                            {/* Agendar */}
                                            {plan.status === "approved" && (
                                                <ActionBtn
                                                    label="⏰ Agendar"
                                                    color="purple"
                                                    loading={isLoading}
                                                    onClick={() => callApi(plan.id, "schedule")}
                                                />
                                            )}

                                            {/* Publicar agora */}
                                            {(plan.status === "approved" || plan.status === "scheduled") && (
                                                <ActionBtn
                                                    label="▶ Publicar"
                                                    color="emerald"
                                                    loading={isLoading}
                                                    onClick={() => callApi(plan.id, "publish")}
                                                />
                                            )}

                                            {/* Copy pack */}
                                            {hasPack && (
                                                <button
                                                    onClick={() => copyPack(plan)}
                                                    className={`px-2 py-1 rounded text-xs font-medium transition-all
                                                        ${copiedId === plan.id
                                                            ? "bg-green-700 text-white"
                                                            : "bg-amber-800/60 text-amber-200 hover:bg-amber-700"}`}
                                                    title="Copiar instruções de publicação"
                                                >
                                                    {copiedId === plan.id ? "✓ Copiado" : "📋 Pack"}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Sub-component ────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
    blue: "bg-blue-800/60 text-blue-200 hover:bg-blue-700",
    green: "bg-green-800/60 text-green-200 hover:bg-green-700",
    purple: "bg-purple-800/60 text-purple-200 hover:bg-purple-700",
    emerald: "bg-emerald-800/60 text-emerald-200 hover:bg-emerald-700",
};

function ActionBtn({ label, color, loading, onClick }: {
    label: string; color: string; loading: boolean; onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className={`px-2 py-1 rounded text-xs font-medium transition-all disabled:opacity-50
                ${COLOR_MAP[color] ?? "bg-gray-700 text-white hover:bg-gray-600"}`}
        >
            {loading ? "…" : label}
        </button>
    );
}
