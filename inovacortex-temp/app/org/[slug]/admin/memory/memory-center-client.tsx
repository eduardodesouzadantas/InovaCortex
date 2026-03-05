"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Brain, Search, BookOpen, Users, RefreshCw,
    Database, Zap, Target, MessageSquare, ChevronRight,
    AlertCircle, CheckCircle, Clock, Loader2
} from "lucide-react";

const TABS = [
    { id: "status", label: "Reindex & Status", icon: Database },
    { id: "search", label: "Busca Semântica", icon: Search },
    { id: "playbooks", label: "Playbooks", icon: BookOpen },
    { id: "client", label: "Client Memory", icon: Users },
] as const;

type TabId = typeof TABS[number]["id"];

const SOURCE_COLORS: Record<string, string> = {
    assessment: "text-blue-400 border-blue-500/30 bg-blue-500/10",
    proposal: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    meeting: "text-green-400 border-green-500/30 bg-green-500/10",
    profit_leak: "text-red-400 border-red-500/30 bg-red-500/10",
    strategic_insight: "text-purple-400 border-purple-500/30 bg-purple-500/10",
    system_event: "text-slate-400 border-slate-500/30 bg-slate-500/10",
    outbound: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
};

const MEMORY_TYPE_COLORS: Record<string, string> = {
    win_reason: "text-green-400 bg-green-500/10 border-green-500/30",
    objection: "text-red-400 bg-red-500/10 border-red-500/30",
    script: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    playbook: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
    lesson: "text-purple-400 bg-purple-500/10 border-purple-500/30",
};

export function MemoryCenterClient({ slug }: { slug: string }) {
    const [activeTab, setActiveTab] = useState<TabId>("status");

    return (
        <div className="flex flex-col flex-1 overflow-hidden">
            {/* Tab Bar */}
            <div className="border-b border-white/5 px-6 pt-2 flex gap-1 bg-black/20">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-all ${active
                                    ? "border-amber-400 text-amber-300 bg-amber-500/5"
                                    : "border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/3"
                                }`}
                        >
                            <Icon size={14} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    className="flex-1 overflow-y-auto p-6"
                >
                    {activeTab === "status" && <StatusTab slug={slug} />}
                    {activeTab === "search" && <SearchTab slug={slug} />}
                    {activeTab === "playbooks" && <PlaybooksTab slug={slug} />}
                    {activeTab === "client" && <ClientMemoryTab slug={slug} />}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

// ─── STATUS TAB ──────────────────────────────────────────────────────────────

function StatusTab({ slug }: { slug: string }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [reindexing, setReindexing] = useState(false);
    const [reindexMsg, setReindexMsg] = useState("");

    const loadStatus = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch(`/api/org/${slug}/memory/status`);
            const d = await r.json();
            setData(d);
        } finally { setLoading(false); }
    }, [slug]);

    const triggerReindex = async () => {
        setReindexing(true);
        setReindexMsg("");
        try {
            // get orgId first
            const st = await fetch(`/api/org/${slug}/memory/status`);
            const { orgId } = await st.json();
            const r = await fetch(`/api/admin/memory/reindex`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orgId: slug })
            });
            const d = await r.json();
            setReindexMsg(d.success ? `✅ Tarefa enfileirada: ${d.taskId?.slice(0, 8)}...` : `❌ ${d.error}`);
        } finally { setReindexing(false); }
    };

    // auto-load
    if (!data && !loading) { loadStatus(); }

    const indexPct = data ? Math.round((data.indexedCount / Math.max(data.chunkCount, 1)) * 100) : 0;

    return (
        <div className="max-w-2xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-slate-100">Knowledge Base Status</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Estado atual do índice semântico da organização</p>
                </div>
                <button onClick={loadStatus} className="p-2 rounded-lg border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all">
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {loading && !data ? (
                <div className="flex items-center gap-2 text-slate-500 py-8"><Loader2 size={16} className="animate-spin" /> Carregando...</div>
            ) : data ? (
                <>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { label: "Documentos Indexados", value: data.docCount, icon: Database, color: "amber" },
                            { label: "Total de Chunks", value: data.chunkCount, icon: Zap, color: "indigo" },
                            { label: "Chunks com Embedding", value: data.indexedCount, icon: CheckCircle, color: "green" },
                            { label: "Itens de Memória", value: data.memoryItems, icon: Brain, color: "purple" },
                        ].map((stat) => {
                            const Icon = stat.icon;
                            return (
                                <div key={stat.label} className="bg-white/3 border border-white/8 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Icon size={14} className={`text-${stat.color}-400`} />
                                        <span className="text-xs text-slate-500">{stat.label}</span>
                                    </div>
                                    <div className={`text-2xl font-bold text-${stat.color}-300`}>{stat.value}</div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Index Progress */}
                    <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-2">
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>Progresso de Indexação</span>
                            <span className={indexPct === 100 ? "text-green-400" : "text-amber-400"}>{indexPct}%</span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${indexPct}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className={`h-full rounded-full ${indexPct === 100 ? "bg-green-500" : "bg-gradient-to-r from-amber-500 to-indigo-500"}`}
                            />
                        </div>
                        <p className="text-xs text-slate-600">
                            Último index: {data.lastIndexed ? new Date(data.lastIndexed).toLocaleString("pt-BR") : "Nunca"}
                        </p>
                    </div>

                    {/* Reindex Button */}
                    <div className="bg-gradient-to-r from-amber-500/5 to-indigo-500/5 border border-amber-500/20 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <Brain className="text-amber-400 mt-0.5 flex-shrink-0" size={20} />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-slate-200">Reindexação Semântica</p>
                                <p className="text-xs text-slate-500 mt-1">Processa chunks sem embedding. Enfileira na ActionQueue para execução assíncrona.</p>
                                {reindexMsg && <p className="text-xs mt-2 font-mono text-slate-300">{reindexMsg}</p>}
                            </div>
                            <button
                                onClick={triggerReindex}
                                disabled={reindexing}
                                className="px-4 py-2 bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-lg text-sm font-medium hover:bg-amber-500/25 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {reindexing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                                {reindexing ? "Enfileirando..." : "Reindexar"}
                            </button>
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
}

// ─── SEARCH TAB ──────────────────────────────────────────────────────────────

function SearchTab({ slug }: { slug: string }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const doSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setSearched(true);
        try {
            const r = await fetch(`/api/org/${slug}/memory/search`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query, topK: 8 })
            });
            const d = await r.json();
            setResults(d.results || []);
        } finally { setLoading(false); }
    };

    return (
        <div className="max-w-3xl space-y-5">
            <div>
                <h2 className="text-lg font-semibold text-slate-100">Busca Semântica</h2>
                <p className="text-xs text-slate-500 mt-0.5">Encontre evidências internas por significado, não apenas por palavras-chave</p>
            </div>

            {/* Search Bar */}
            <div className="flex gap-3">
                <div className="flex-1 flex items-center gap-3 bg-white/4 border border-white/10 rounded-xl px-4 py-3 focus-within:border-amber-500/40 transition-all">
                    <Search size={16} className="text-slate-500 flex-shrink-0" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && doSearch()}
                        placeholder="ex: estratégia para clínicas, objeção de preço, playbook de follow-up..."
                        className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none"
                    />
                </div>
                <button
                    onClick={doSearch}
                    disabled={loading || !query.trim()}
                    className="px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold rounded-xl text-sm hover:opacity-90 transition-all disabled:opacity-40 flex items-center gap-2"
                >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    Buscar
                </button>
            </div>

            {/* Results */}
            {loading && (
                <div className="flex items-center gap-2 text-slate-500 py-8 justify-center">
                    <Loader2 size={16} className="animate-spin" /> Buscando evidências semânticas...
                </div>
            )}

            {!loading && searched && results.length === 0 && (
                <div className="text-center py-12 text-slate-600">
                    <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma evidência encontrada. Execute um Reindex primeiro.</p>
                </div>
            )}

            {!loading && results.length > 0 && (
                <div className="space-y-3">
                    <p className="text-xs text-slate-500">{results.length} evidências encontradas para <span className="text-amber-400">"{query}"</span></p>
                    {results.map((r: any, i: number) => {
                        const colorClass = SOURCE_COLORS[r.sourceType] || SOURCE_COLORS.system_event;
                        const pct = Math.round(r.score * 100);
                        return (
                            <motion.div
                                key={r.chunkId}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="bg-white/3 border border-white/8 rounded-xl p-4 hover:border-white/15 transition-all"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="text-xs font-mono text-slate-600 mt-0.5 w-5 text-center">[E{i + 1}]</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            <span className={`text-xs px-2 py-0.5 rounded-full border font-mono ${colorClass}`}>{r.sourceType}</span>
                                            <span className="text-xs text-slate-500 truncate">{r.title}</span>
                                            <span className="ml-auto text-xs font-semibold" style={{ color: pct > 70 ? "#4ade80" : pct > 40 ? "#fbbf24" : "#94a3b8" }}>
                                                {pct}% relevância
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">{r.chunkText}</p>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── PLAYBOOKS TAB ────────────────────────────────────────────────────────────

function PlaybooksTab({ slug }: { slug: string }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState("all");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch(`/api/org/${slug}/memory/playbooks`);
            setData(await r.json());
        } finally { setLoading(false); }
    }, [slug]);

    if (!data && !loading) { load(); }

    const typeLabels: Record<string, string> = {
        win_reason: "Vitória", objection: "Objeção", script: "Script",
        playbook: "Playbook", lesson: "Lição"
    };

    const filtered = data?.playbooks?.filter((p: any) => filter === "all" || p.type === filter) || [];

    return (
        <div className="max-w-3xl space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-slate-100">Playbooks & Memória</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Padrões de vitória, objeções e scripts catalogados</p>
                </div>
                <button onClick={load} className="p-2 rounded-lg border border-white/10 text-slate-400 hover:text-slate-200 transition-all">
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
            </div>

            {/* Won Meetings Highlight */}
            {data?.wonMeetings?.length > 0 && (
                <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Target size={14} className="text-green-400" />
                        <span className="text-sm font-medium text-green-300">Top Reuniões Ganhas (Fonte dos Playbooks)</span>
                    </div>
                    <div className="space-y-2">
                        {data.wonMeetings.map((m: any) => (
                            <div key={m.id} className="flex items-center gap-3 text-xs text-slate-400">
                                <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
                                <span className="flex-1 truncate">{m.notes?.slice(0, 80) || "Reunião ganha"}</span>
                                <span className="text-green-400 font-mono font-semibold">R$ {(m.closedValue || 0) / 100}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Filter Pills */}
            <div className="flex gap-2 flex-wrap">
                {["all", "win_reason", "objection", "script", "playbook", "lesson"].map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${filter === f
                                ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                                : "bg-white/3 border-white/10 text-slate-500 hover:text-slate-300"
                            }`}
                    >
                        {f === "all" ? "Todos" : typeLabels[f]}
                    </button>
                ))}
            </div>

            {/* Playbook Items */}
            {loading && !data && (
                <div className="flex items-center gap-2 text-slate-500 py-8 justify-center">
                    <Loader2 size={16} className="animate-spin" /> Carregando...
                </div>
            )}
            {!loading && filtered.length === 0 && (
                <div className="text-center py-12 text-slate-600">
                    <BookOpen size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum {filter === "all" ? "playbook" : typeLabels[filter]} registrado ainda.</p>
                    <p className="text-xs mt-1">Use o chat para catalogar: "salvar vitória" ou "registrar objeção"</p>
                </div>
            )}
            <div className="space-y-3">
                {filtered.map((p: any, i: number) => {
                    const colorClass = MEMORY_TYPE_COLORS[p.type] || "text-slate-400 bg-white/5 border-white/10";
                    return (
                        <motion.div
                            key={p.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="bg-white/3 border border-white/8 rounded-xl p-4 hover:border-white/15 transition-all"
                        >
                            <div className="flex items-start gap-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full border font-mono flex-shrink-0 mt-0.5 ${colorClass}`}>
                                    {typeLabels[p.type] || p.type}
                                </span>
                                <div className="flex-1">
                                    <p className="text-sm text-slate-300 leading-relaxed">{p.summary || p.text}</p>
                                    <p className="text-xs text-slate-600 mt-1">{new Date(p.createdAt).toLocaleDateString("pt-BR")}</p>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── CLIENT MEMORY TAB ───────────────────────────────────────────────────────

function ClientMemoryTab({ slug }: { slug: string }) {
    const [query, setQuery] = useState("");
    const [client, setClient] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [notFound, setNotFound] = useState(false);

    const searchClient = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setNotFound(false);
        setClient(null);
        try {
            const r = await fetch(`/api/org/${slug}/memory/search`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: `cliente ${query} empresa histórico`, topK: 6 })
            });
            const d = await r.json();
            if (d.results?.length > 0) {
                setClient({ name: query, evidence: d.results });
            } else {
                setNotFound(true);
            }
        } finally { setLoading(false); }
    };

    return (
        <div className="max-w-3xl space-y-5">
            <div>
                <h2 className="text-lg font-semibold text-slate-100">Client Memory</h2>
                <p className="text-xs text-slate-500 mt-0.5">Busque um cliente para ver toda a memória semântica relacionada</p>
            </div>

            {/* Search */}
            <div className="flex gap-3">
                <div className="flex-1 flex items-center gap-3 bg-white/4 border border-white/10 rounded-xl px-4 py-3 focus-within:border-indigo-500/40 transition-all">
                    <Users size={16} className="text-slate-500 flex-shrink-0" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && searchClient()}
                        placeholder="Nome da empresa ou lead..."
                        className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none"
                    />
                </div>
                <button
                    onClick={searchClient}
                    disabled={loading || !query.trim()}
                    className="px-5 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold rounded-xl text-sm hover:opacity-90 transition-all disabled:opacity-40 flex items-center gap-2"
                >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
                    Ver Cliente
                </button>
            </div>

            {notFound && (
                <div className="text-center py-12 text-slate-600">
                    <Users size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma memória encontrada para "{query}".</p>
                    <p className="text-xs mt-1">Execute um /ingest para indexar os dados do cliente.</p>
                </div>
            )}

            {client && (
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                            {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-100">{client.name}</h3>
                            <p className="text-xs text-slate-500">{client.evidence.length} fragmentos de memória encontrados</p>
                        </div>
                    </div>

                    {/* Evidence Timeline */}
                    <div className="relative pl-6 space-y-4">
                        <div className="absolute left-2 top-2 bottom-2 w-px bg-gradient-to-b from-indigo-500/50 to-transparent" />
                        {client.evidence.map((e: any, i: number) => {
                            const colorClass = SOURCE_COLORS[e.sourceType] || SOURCE_COLORS.system_event;
                            const pct = Math.round(e.score * 100);
                            return (
                                <motion.div
                                    key={e.chunkId}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.08 }}
                                    className="relative"
                                >
                                    <div className="absolute -left-4 top-3 h-2.5 w-2.5 rounded-full border-2 border-indigo-500 bg-black" />
                                    <div className="bg-white/3 border border-white/8 rounded-xl p-4 hover:border-white/15 transition-all">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`text-xs px-2 py-0.5 rounded-full border font-mono ${colorClass}`}>{e.sourceType}</span>
                                            <span className="text-xs text-slate-500 flex-1 truncate">{e.title}</span>
                                            <span className="text-xs font-mono text-slate-600">{pct}%</span>
                                        </div>
                                        <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">{e.chunkText}</p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
