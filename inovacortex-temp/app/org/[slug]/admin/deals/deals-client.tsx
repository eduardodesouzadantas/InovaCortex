"use client";
/**
 * app/org/[slug]/admin/deals/deals-client.tsx
 * V21: Interactive deals panel client component.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface DealSignal { id: string; type: string; createdAt: string; }
interface DealPacket {
    id: string; assessmentId: string; status: string; tier: string;
    execSlug: string; execOnePagerHtml: string; createdAt: string;
    signals: DealSignal[];
}
interface Props {
    orgSlug: string; packets: DealPacket[];
    activeFilters: { status?: string; tier?: string };
}

const TIER_BADGES: Record<string, { label: string; color: string }> = {
    hot: { label: "🔥 Hot", color: "bg-red-900/60 text-red-300 ring-1 ring-red-600/30" },
    warm: { label: "⚡ Warm", color: "bg-amber-900/60 text-amber-300 ring-1 ring-amber-600/30" },
    cold: { label: "❄ Cold", color: "bg-blue-900/60 text-blue-300 ring-1 ring-blue-600/30" },
};

const STATUS_COLORS: Record<string, string> = {
    draft: "bg-gray-700 text-gray-300",
    sent: "bg-blue-800 text-blue-200",
    viewed: "bg-indigo-800 text-indigo-200",
    meeting_booked: "bg-violet-800 text-violet-200",
    won: "bg-green-700 text-green-200",
    lost: "bg-red-900 text-red-300",
};

const SIGNAL_ICONS: Record<string, string> = {
    dossier_viewed: "👀",
    proposal_viewed: "📄",
    meeting_scheduled: "📅",
    whatsapp_replied: "💬",
    whatsapp_sent: "📤",
    no_response_72h: "⏰",
    stub_sent: "🔧",
};

export function DealsClient({ orgSlug, packets, activeFilters }: Props) {
    const router = useRouter();
    const [, startTransition] = useTransition();
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<{ id: string; msg: string; ok: boolean } | null>(null);
    const [previewId, setPreviewId] = useState<string | null>(null);

    function applyFilter(key: string, val: string) {
        const p = new URLSearchParams(activeFilters as Record<string, string>);
        if (p.get(key) === val) p.delete(key); else p.set(key, val);
        startTransition(() => router.push(`/org/${orgSlug}/admin/deals?${p}`));
    }

    async function mutate(packetId: string, action: string) {
        setLoadingId(packetId); setFeedback(null);
        try {
            const res = await fetch(`/api/org/${orgSlug}/deals/${packetId}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            const data = await res.json();
            setFeedback({ id: packetId, msg: data.message ?? (res.ok ? "Feito!" : "Erro"), ok: res.ok });
            if (res.ok) startTransition(() => router.refresh());
        } catch (e: any) {
            setFeedback({ id: packetId, msg: e?.message ?? "Erro", ok: false });
        } finally { setLoadingId(null); }
    }

    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

    const statuses = ["draft", "sent", "viewed", "meeting_booked", "won", "lost"];
    const tiers = ["hot", "warm", "cold"];

    return (
        <div className="space-y-5">
            {/* Filters */}
            <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-gray-500 self-center">Status:</span>
                    {statuses.map(s => (
                        <button key={s} onClick={() => applyFilter("status", s)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all
                                ${activeFilters.status === s ? (STATUS_COLORS[s] ?? "bg-gray-600 text-white") + " ring-2 ring-white/20" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
                            {s.replace("_", " ")}
                        </button>
                    ))}
                    <span className="text-xs text-gray-500 self-center ml-2">Tier:</span>
                    {tiers.map(t => (
                        <button key={t} onClick={() => applyFilter("tier", t)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all
                                ${activeFilters.tier === t ? (TIER_BADGES[t]?.color ?? "bg-gray-700 text-white") + " ring-2 ring-white/20" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
                            {TIER_BADGES[t]?.label ?? t}
                        </button>
                    ))}
                </div>
            </div>

            {packets.length === 0 && (
                <div className="text-center py-16 text-gray-500">Nenhum deal packet ainda.</div>
            )}

            {/* Deal Cards */}
            <div className="space-y-3">
                {packets.map(p => {
                    const isLoading = loadingId === p.id;
                    const fb = feedback?.id === p.id ? feedback : null;
                    const tier = TIER_BADGES[p.tier] ?? { label: p.tier, color: "bg-gray-700 text-gray-300" };
                    const isPreviewing = previewId === p.id;

                    return (
                        <div key={p.id} className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
                            <div className="p-4 flex flex-wrap gap-3 items-start">
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap gap-2 mb-1.5">
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${tier.color}`}>{tier.label}</span>
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] ?? "bg-gray-700 text-gray-300"}`}>{p.status.replace("_", " ")}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 font-mono">Assessment: {p.assessmentId.slice(0, 8)}…</p>
                                    <p className="text-xs text-gray-600 mt-0.5">{new Date(p.createdAt).toLocaleString("pt-BR")}</p>

                                    {/* Signal timeline */}
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {p.signals.slice(0, 8).map(sig => (
                                            <span key={sig.id} title={`${sig.type} — ${new Date(sig.createdAt).toLocaleString("pt-BR")}`}
                                                className="px-1.5 py-0.5 bg-gray-800 rounded text-xs text-gray-400">
                                                {SIGNAL_ICONS[sig.type] ?? "•"} {sig.type.replace("_", " ")}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-1.5 items-center">
                                    {fb && (
                                        <span className={`text-xs px-2 py-0.5 rounded ${fb.ok ? "text-green-400" : "text-red-400"}`}>
                                            {fb.ok ? "✓" : "✗"} {fb.msg}
                                        </span>
                                    )}

                                    {/* Preview one-pager */}
                                    <button onClick={() => setPreviewId(isPreviewing ? null : p.id)}
                                        className="px-2 py-1 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-all">
                                        {isPreviewing ? "▲ Fechar" : "👁 Ver One-Pager"}
                                    </button>

                                    {/* External link */}
                                    <a href={`/org/${orgSlug}/deal/${p.execSlug}`} target="_blank"
                                        className="px-2 py-1 text-xs rounded bg-indigo-900/60 text-indigo-200 hover:bg-indigo-800 transition-all">
                                        🔗 Link cliente
                                    </a>

                                    {/* Won/Lost */}
                                    {!["won", "lost"].includes(p.status) && (
                                        <>
                                            <button disabled={isLoading} onClick={() => mutate(p.id, "won")}
                                                className="px-2 py-1 text-xs rounded bg-green-900/60 text-green-200 hover:bg-green-800 disabled:opacity-50 transition-all">
                                                {isLoading ? "…" : "✅ Won"}
                                            </button>
                                            <button disabled={isLoading} onClick={() => mutate(p.id, "lost")}
                                                className="px-2 py-1 text-xs rounded bg-red-900/60 text-red-300 hover:bg-red-900 disabled:opacity-50 transition-all">
                                                {isLoading ? "…" : "❌ Lost"}
                                            </button>
                                        </>
                                    )}

                                    {/* Resend WhatsApp */}
                                    <button disabled={isLoading} onClick={() => mutate(p.id, "resend_whatsapp")}
                                        className="px-2 py-1 text-xs rounded bg-emerald-900/60 text-emerald-200 hover:bg-emerald-800 disabled:opacity-50 transition-all">
                                        {isLoading ? "…" : "📤 Reenviar"}
                                    </button>
                                </div>
                            </div>

                            {/* Inline HTML preview */}
                            {isPreviewing && (
                                <div className="border-t border-gray-800">
                                    <iframe
                                        srcDoc={p.execOnePagerHtml}
                                        className="w-full h-[600px] border-0 bg-white"
                                        sandbox="allow-scripts"
                                        title={`Deal One-Pager ${p.execSlug}`}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
