"use client";
/**
 * app/org/[slug]/admin/outbound/outbound-client.tsx
 * V21: Interactive outbound admin — 4 tab UI.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Prospect { id: string; fullName: string; title: string; company: string; industry: string; companySize: string; status: string; source: string; createdAt: string; }
interface Sequence { id: string; prospectId: string; stage: string; nextAt: string; paused: boolean; lastResult: string; prospect: { fullName: string; company: string; status: string }; }
interface Message { id: string; prospectId: string; stage: string; templateKey: string; body: string; status: string; createdAt: string; prospect: { fullName: string; company: string }; }
interface Metrics { total: number; connected: number; replied: number; meetings: number; }

interface Props {
    orgSlug: string; prospects: Prospect[]; sequences: Sequence[];
    messages: Message[]; metrics: Metrics;
    activeFilters: { status?: string; industry?: string };
    activeTab: string;
}

// ─── Badges ───────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
    new: "bg-gray-700 text-gray-300",
    connected: "bg-blue-900 text-blue-300",
    replied: "bg-violet-900 text-violet-300",
    meeting: "bg-green-800 text-green-300",
    lost: "bg-red-900/60 text-red-400",
    do_not_contact: "bg-gray-900 text-gray-500",
};
const STAGE_COLORS: Record<string, string> = {
    connect_note: "bg-slate-700 text-slate-200",
    dm1: "bg-blue-900 text-blue-200",
    dm2: "bg-indigo-900 text-indigo-200",
    dm3: "bg-violet-900 text-violet-200",
    close: "bg-emerald-900 text-emerald-200",
};
const TABS = [
    { key: "radar", label: "🎯 Prospects" },
    { key: "sequences", label: "⚡ Sequências" },
    { key: "messages", label: "💬 Mensagens" },
    { key: "metrics", label: "📊 Métricas" },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function OutboundClient({ orgSlug, prospects, sequences, messages, metrics, activeFilters, activeTab }: Props) {
    const router = useRouter();
    const [, startTransition] = useTransition();
    const [tab, setTab] = useState(activeTab);
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const [replyId, setReplyId] = useState<string | null>(null);
    const [replyNotes, setReplyNotes] = useState("");
    const [replyMeeting, setReplyMeeting] = useState(false);

    async function generateStubs() {
        setLoading(true); setFeedback(null);
        try {
            const res = await fetch(`/api/org/${orgSlug}/outbound/recommend`, { method: "POST" });
            const d = await res.json();
            setFeedback(res.ok ? `✓ ${d.created} criados, ${d.skipped} existentes` : `✗ ${d.error}`);
            if (res.ok) startTransition(() => router.refresh());
        } finally { setLoading(false); }
    }

    async function startSequence(prospectId: string) {
        setLoading(true); setFeedback(null);
        try {
            const res = await fetch(`/api/org/${orgSlug}/outbound/sequences`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prospectId }),
            });
            const d = await res.json();
            setFeedback(res.ok ? `✓ Sequência iniciada (${d.stage})` : `✗ ${d.error}`);
            if (res.ok) startTransition(() => router.refresh());
        } finally { setLoading(false); }
    }

    async function togglePause(seqId: string, paused: boolean) {
        setLoading(true);
        try {
            await fetch(`/api/org/${orgSlug}/outbound/sequences/${seqId}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: paused ? "resume" : "pause" }),
            });
            startTransition(() => router.refresh());
        } finally { setLoading(false); }
    }

    async function runSequenceNow(seqId: string) {
        setLoading(true); setFeedback(null);
        try {
            const res = await fetch(`/api/org/${orgSlug}/outbound/sequences/${seqId}/run`, { method: "POST" });
            const d = await res.json();
            setFeedback(res.ok ? `✓ Mensagem gerada (${d.stage})` : `✗ ${d.error ?? "Erro"}`);
            if (res.ok) startTransition(() => router.refresh());
        } finally { setLoading(false); }
    }

    async function markMessageSent(msgId: string) {
        await fetch(`/api/org/${orgSlug}/outbound/messages/${msgId}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "sent" }),
        });
        startTransition(() => router.refresh());
    }

    async function submitReply(prospectId: string) {
        setLoading(true);
        try {
            const res = await fetch(`/api/org/${orgSlug}/outbound/prospects/${prospectId}/reply`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ replied: true, meeting: replyMeeting, notes: replyNotes }),
            });
            const d = await res.json();
            setFeedback(d.message);
            setReplyId(null); setReplyNotes(""); setReplyMeeting(false);
            startTransition(() => router.refresh());
        } finally { setLoading(false); }
    }

    function copyText(id: string, text: string) {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    }

    const industries = [...new Set(prospects.map(p => p.industry))];
    const closeRate = metrics.total > 0 ? ((metrics.meetings / metrics.total) * 100).toFixed(1) : "0";

    return (
        <div className="space-y-5">
            {/* Feedback */}
            {feedback && (
                <div className={`px-4 py-2 rounded-lg text-sm font-medium ${feedback.startsWith("✓") ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"}`}>
                    {feedback}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-900/60 p-1 rounded-xl w-fit">
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                            ${tab === t.key ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── TAB 1: Prospect Radar ─────────────────────────────────── */}
            {tab === "radar" && (
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-3">
                        <button onClick={generateStubs} disabled={loading}
                            className="px-4 py-2 bg-indigo-700 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-all">
                            {loading ? "Gerando…" : "🤖 Gerar 25 prospects (stub)"}
                        </button>
                        <a href={`/api/org/${orgSlug}/outbound/import`}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-all">
                            📥 Exportar CSV
                        </a>
                        <label className="px-4 py-2 bg-emerald-900 hover:bg-emerald-800 text-emerald-200 text-sm font-medium rounded-lg cursor-pointer transition-all">
                            📤 Importar CSV
                            <input type="file" accept=".csv" className="hidden" onChange={async e => {
                                const file = e.target.files?.[0]; if (!file) return;
                                const fd = new FormData(); fd.append("file", file);
                                setLoading(true);
                                const res = await fetch(`/api/org/${orgSlug}/outbound/import`, { method: "POST", body: fd });
                                const d = await res.json();
                                setFeedback(`✓ ${d.created} criados, ${d.updated} atualizados, ${d.skipped} ignorados`);
                                setLoading(false);
                                startTransition(() => router.refresh());
                            }} />
                        </label>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-2">
                        {["new", "connected", "replied", "meeting", "lost"].map(s => (
                            <button key={s} className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${activeFilters.status === s ? (STATUS_COLORS[s] ?? "") + " ring-2 ring-white/20" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
                                onClick={() => {
                                    const p = new URLSearchParams(activeFilters as any);
                                    p.get("status") === s ? p.delete("status") : p.set("status", s);
                                    startTransition(() => router.push(`/org/${orgSlug}/admin/outbound?tab=radar&${p}`));
                                }}>{s}</button>
                        ))}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                                    <th className="pb-2 pr-4">Nome</th>
                                    <th className="pb-2 pr-4">Empresa</th>
                                    <th className="pb-2 pr-4">Cargo</th>
                                    <th className="pb-2 pr-4">Ind.</th>
                                    <th className="pb-2 pr-4">Status</th>
                                    <th className="pb-2">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-900">
                                {prospects.slice(0, 50).map(p => (
                                    <tr key={p.id} className="hover:bg-gray-900/30">
                                        <td className="py-2 pr-4 font-medium">{p.fullName}</td>
                                        <td className="py-2 pr-4 text-gray-400">{p.company}</td>
                                        <td className="py-2 pr-4 text-gray-500 text-xs">{p.title}</td>
                                        <td className="py-2 pr-4">
                                            <span className="px-1.5 py-0.5 bg-gray-800 rounded text-xs text-gray-400">{p.industry.replace("_", " ")}</span>
                                        </td>
                                        <td className="py-2 pr-4">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] ?? "bg-gray-700 text-gray-300"}`}>{p.status}</span>
                                        </td>
                                        <td className="py-2">
                                            <div className="flex gap-1.5">
                                                <button onClick={() => startSequence(p.id)} disabled={loading}
                                                    className="px-2 py-0.5 text-xs rounded bg-indigo-900/60 text-indigo-200 hover:bg-indigo-800 disabled:opacity-50 transition-all">
                                                    ▶ Iniciar
                                                </button>
                                                {p.status === "new" && (
                                                    <button onClick={() => setReplyId(p.id)}
                                                        className="px-2 py-0.5 text-xs rounded bg-violet-900/60 text-violet-200 hover:bg-violet-800 transition-all">
                                                        💬 Reply
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {prospects.length === 0 && <p className="text-center text-gray-500 py-8">Nenhum prospect ainda.</p>}
                    </div>

                    {/* Reply modal */}
                    {replyId && (
                        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md space-y-4">
                                <h3 className="font-bold text-lg">Registrar Resposta</h3>
                                <textarea className="w-full bg-gray-800 rounded-lg p-3 text-sm text-white resize-none" rows={3}
                                    placeholder="Notas internas…" value={replyNotes} onChange={e => setReplyNotes(e.target.value)} />
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input type="checkbox" className="w-4 h-4" checked={replyMeeting} onChange={e => setReplyMeeting(e.target.checked)} />
                                    Reunião agendada
                                </label>
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setReplyId(null)} className="px-3 py-1.5 text-sm rounded bg-gray-700 text-gray-300">Cancelar</button>
                                    <button onClick={() => submitReply(replyId)} disabled={loading}
                                        className="px-3 py-1.5 text-sm rounded bg-violet-700 text-white hover:bg-violet-600 disabled:opacity-50">
                                        {loading ? "…" : "Salvar"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── TAB 2: Sequences ─────────────────────────────────────── */}
            {tab === "sequences" && (
                <div className="space-y-3">
                    {sequences.length === 0 && <p className="text-gray-500 text-center py-8">Nenhuma sequência ativa.</p>}
                    {sequences.map(seq => (
                        <div key={seq.id} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 flex flex-wrap gap-3 items-center">
                            <div className="flex-1 min-w-0">
                                <p className="font-medium">{seq.prospect.fullName}</p>
                                <p className="text-xs text-gray-500">{seq.prospect.company}</p>
                                <div className="flex flex-wrap gap-2 mt-1.5">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STAGE_COLORS[seq.stage] ?? "bg-gray-700 text-gray-300"}`}>{seq.stage}</span>
                                    {seq.paused && <span className="px-2 py-0.5 rounded text-xs bg-amber-900/60 text-amber-300">⏸ pausado</span>}
                                    <span className="text-xs text-gray-500">próx: {new Date(seq.nextAt).toLocaleString("pt-BR")}</span>
                                </div>
                            </div>
                            <div className="flex gap-1.5">
                                <button onClick={() => runSequenceNow(seq.id)} disabled={loading}
                                    className="px-2 py-1 text-xs rounded bg-indigo-900/60 text-indigo-200 hover:bg-indigo-800 disabled:opacity-50 transition-all">
                                    ▶ Rodar agora
                                </button>
                                <button onClick={() => togglePause(seq.id, seq.paused)} disabled={loading}
                                    className={`px-2 py-1 text-xs rounded transition-all disabled:opacity-50 ${seq.paused ? "bg-green-900/60 text-green-200 hover:bg-green-800" : "bg-amber-900/60 text-amber-200 hover:bg-amber-800"}`}>
                                    {seq.paused ? "▶ Retomar" : "⏸ Pausar"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── TAB 3: Messages ──────────────────────────────────────── */}
            {tab === "messages" && (
                <div className="space-y-2">
                    {messages.length === 0 && <p className="text-gray-500 text-center py-8">Nenhuma mensagem ainda.</p>}
                    {messages.map(msg => (
                        <div key={msg.id} className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
                            <div className="p-3 flex flex-wrap gap-2 items-center">
                                <div className="flex-1">
                                    <div className="flex gap-2 mb-1">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STAGE_COLORS[msg.stage] ?? "bg-gray-700"}`}>{msg.stage}</span>
                                        <span className={`px-2 py-0.5 rounded text-xs ${msg.status === "sent" ? "bg-green-900 text-green-300" : "bg-gray-700 text-gray-400"}`}>{msg.status}</span>
                                        <span className="text-xs text-gray-500 truncate max-w-xs">{msg.templateKey}</span>
                                    </div>
                                    <p className="text-xs text-gray-400">{msg.prospect.fullName} · {msg.prospect.company}</p>
                                </div>
                                <div className="flex gap-1.5">
                                    <button onClick={() => copyText(msg.id, msg.body)}
                                        className={`px-2 py-1 text-xs rounded transition-all ${copied === msg.id ? "bg-green-700 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}>
                                        {copied === msg.id ? "✓" : "📋"} Copiar
                                    </button>
                                    {msg.status === "stub" && (
                                        <button onClick={() => markMessageSent(msg.id)}
                                            className="px-2 py-1 text-xs rounded bg-blue-900/60 text-blue-200 hover:bg-blue-800 transition-all">
                                            ✅ Marcar enviado
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="border-t border-gray-800/60 px-3 py-2">
                                <pre className="text-xs text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto font-sans leading-relaxed">{msg.body}</pre>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── TAB 4: Metrics ───────────────────────────────────────── */}
            {tab === "metrics" && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: "Prospects", value: metrics.total, color: "text-white" },
                            { label: "Conectados", value: metrics.connected, color: "text-blue-400" },
                            { label: "Replies", value: metrics.replied, color: "text-violet-400" },
                            { label: "Reuniões", value: metrics.meetings, color: "text-green-400" },
                        ].map(m => (
                            <div key={m.label} className="bg-gray-900/60 border border-gray-800 rounded-xl p-5 text-center">
                                <div className={`text-3xl font-bold ${m.color}`}>{m.value}</div>
                                <div className="text-xs text-gray-500 mt-1">{m.label}</div>
                            </div>
                        ))}
                    </div>
                    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
                        <p className="text-sm text-gray-400">Close rate (prospects → reunião)</p>
                        <p className="text-4xl font-bold text-emerald-400 mt-1">
                            {metrics.total > 0 ? ((metrics.meetings / metrics.total) * 100).toFixed(1) : "0"}%
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
