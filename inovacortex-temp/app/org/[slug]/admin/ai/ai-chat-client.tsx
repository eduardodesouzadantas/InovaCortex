"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Send, Terminal, BarChart3, TrendingUp, AlertCircle,
    HelpCircle, Zap, ShieldCheck, History, X, Copy, Check, Target, Rocket, Activity, Cpu
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { GUIDE_IDS } from "@/lib/help/guide-ids";
import { GuideLauncher } from "@/components/product-guide/guide-launcher";
import { ProductWalkthrough } from "@/components/product-guide/walkthrough";

interface Message {
    role: "user" | "assistant" | "system";
    content: string;
    createdAt: string;
}

interface CommandResponse {
    title: string;
    resumo: string;
    dados: Record<string, any>;
    acoes: string[];
    atalhos: string[];
    meta: {
        timestamp: string;
        cached: boolean;
        ttlSeconds: number;
    };
}

const QUICK_COMMANDS = [
    { id: "/revenue", label: "Revenue Brain", icon: Zap, color: "text-amber-400" },
    { id: "/leaks", label: "Leak Detector", icon: ShieldCheck, color: "text-rose-400" },
    { id: "/today", label: "Action Engine", icon: Rocket, color: "text-indigo-400" },
    { id: "/pipeline", label: "Pipeline", icon: Target, color: "text-emerald-400" },
    { id: "/growth", label: "Growth", icon: Activity, color: "text-cyan-400" },
];

export function AiChatClient({ slug, orgName }: { slug: string; orgName: string }) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [scope, setScope] = useState<"admin" | "ceo">("admin");
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [budget, setBudget] = useState<{ used: number; limit: number; pctUsed: number } | null>(null);
    const [copying, setCopying] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [forceStartGuide, setForceStartGuide] = useState(false);

    useEffect(() => {
        fetchHistory();
        fetchBudget();
        const interval = setInterval(fetchBudget, 30000);
        return () => clearInterval(interval);
    }, [scope]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const fetchHistory = async () => {
        try {
            const resp = await fetch(`/api/org/${slug}/ai/history?scope=${scope}${sessionId ? `&sessionId=${sessionId}` : ""}`);
            if (resp.ok) {
                const data = await resp.json();
                setMessages(data);
            }
        } catch (err) {
            console.error("Failed to load history", err);
        }
    };

    const fetchBudget = async () => {
        try {
            const resp = await fetch(`/api/org/${slug}/ai/budget`);
            if (resp.ok) {
                const data = await resp.json();
                setBudget(data);
            }
        } catch (err) {
            console.error("Failed to load budget", err);
        }
    };

    const handleSend = async (forcedCommand?: string) => {
        const text = forcedCommand || input;
        if (!text.trim() || loading) return;

        const userMsg: Message = { role: "user", content: text, createdAt: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            const isCommand = text.startsWith("/");
            const endpoint = isCommand ? `/api/org/${slug}/ai/command` : `/api/org/${slug}/ai/chat`;
            const body = isCommand
                ? { command: text.split(" ")[0], args: text.split(" ").slice(1).join(" "), scope, sessionId }
                : { message: text, scope, sessionId };

            const resp = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            if (!resp.ok) throw new Error("API failure");
            const result = await resp.json();

            setMessages(prev => [...prev, {
                role: "assistant",
                content: JSON.stringify(result),
                createdAt: new Date().toISOString()
            }]);

            fetchBudget();
        } catch (err) {
            setMessages(prev => [...prev, {
                role: "system",
                content: "Operational failure. Review budget or server logs.",
                createdAt: new Date().toISOString()
            }]);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopying(id);
        setTimeout(() => setCopying(null), 2000);
    };

    const renderContent = (content: string, msgId: string) => {
        try {
            const data: CommandResponse = JSON.parse(content);
            return (
                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <h3 className="font-bold text-amber-100 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-500" />
                            {data.title}
                        </h3>
                        <div className="flex items-center gap-2">
                            {data.meta?.cached && (
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3" /> CACHED
                                </span>
                            )}
                            <button
                                onClick={() => copyToClipboard(content, msgId)}
                                className="p-1 hover:bg-white/10 rounded transition-colors text-slate-400"
                            >
                                {copying === msgId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                    </div>

                    <p className="text-sm text-slate-300 leading-relaxed italic border-l-2 border-amber-500/30 pl-3">
                        {data.resumo}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(data.dados).map(([key, val], idx) => {
                            if (key === "trends") return null;
                            return (
                                <div key={idx} className="bg-black/40 border border-white/5 p-3 rounded-lg flex flex-col items-start gap-1">
                                    <span className="text-[10px] text-slate-500 uppercase font-mono">{key}</span>
                                    <span className="text-lg font-bold text-slate-100">{String(val)}</span>
                                </div>
                            );
                        })}
                    </div>

                    {data.dados.trends && (
                        <div className="h-24 w-full bg-black/40 rounded-lg p-2 border border-white/5">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data.dados.trends.map((v: number, i: number) => ({ v, i }))}>
                                    <Line
                                        type="monotone"
                                        dataKey="v"
                                        stroke="#fbbf24"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                            <div className="text-[10px] text-slate-500 text-center uppercase tracking-tighter mt-1">Snapshot Velocity Trend</div>
                        </div>
                    )}

                    {data.acoes?.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-[10px] text-indigo-400 uppercase font-bold tracking-wider">Ações Recomendadas</h4>
                            <div className="flex flex-wrap gap-2">
                                {data.acoes.map((acao, idx) => (
                                    <span key={idx} className="text-xs bg-indigo-500/10 text-indigo-300 px-2 py-1 rounded border border-indigo-500/20">
                                        • {acao}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {data.atalhos?.length > 0 && (
                        <div className="flex gap-2 items-center flex-wrap pt-2">
                            <span className="text-[10px] text-slate-500">NEXT:</span>
                            {data.atalhos.map((s, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleSend(s)}
                                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded transition-colors"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            );
        } catch {
            return <p className="text-slate-300 whitespace-pre-wrap">{content}</p>;
        }
    };

    return (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr,350px] relative overflow-hidden">
            <ProductWalkthrough guide="aiRoom" forceStart={forceStartGuide} onClose={() => setForceStartGuide(false)} />

            {/* CHAT COLUMN */}
            <div className="flex flex-col border-r border-slate-800/50 relative bg-[#080808]">
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide"
                >
                    <AnimatePresence initial={false}>
                        {messages.map((msg, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                                <div className={`max-w-[90%] md:max-w-[80%] rounded-2xl p-5 ${msg.role === "user"
                                    ? "bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-lg shadow-indigo-500/20"
                                    : "bg-black/60 backdrop-blur-xl border border-white/10 text-slate-200 shadow-xl"
                                    }`}>
                                    {msg.role === "assistant" ? renderContent(msg.content, `msg-${idx}`) : msg.content}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {loading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-2 text-amber-500/50 font-mono text-xs"
                        >
                            <Cpu className="w-3 h-3 animate-pulse" /> Processing Intelligence...
                        </motion.div>
                    )}
                </div>

                {/* INPUT AREA */}
                <div data-guide-id={GUIDE_IDS.ai_input} className="p-6 bg-black/40 backdrop-blur-xl border-t border-white/5 space-y-4">
                    {/* Autocomplete hint */}
                    {input.startsWith("/") && (
                        <div className="flex gap-2 absolute bottom-[100px] left-6">
                            {QUICK_COMMANDS.filter(c => c.id.startsWith(input)).map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => { setInput(c.id); }}
                                    className="bg-slate-800/80 backdrop-blur text-xs px-3 py-1.5 rounded-full border border-white/10 hover:bg-slate-700 flex items-center gap-2 transition-all"
                                >
                                    <c.icon className={`w-3 h-3 ${c.color}`} /> {c.id}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-4 relative">
                        <input
                            type="text"
                            placeholder="Transmita ordens ou comandos /..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSend()}
                            className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-4 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all font-mono text-sm pr-12"
                        />
                        <button
                            onClick={() => handleSend()}
                            disabled={loading || !input.trim()}
                            className="absolute right-2 top-2 h-10 w-10 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-all shadow-lg shadow-indigo-500/30"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* SIDEBAR COLUMN */}
            <div className="hidden lg:flex flex-col bg-black/60 backdrop-blur-2xl p-6 space-y-8 overflow-y-auto border-l border-white/5">

                <div className="flex justify-end">
                    <GuideLauncher guideKey="aiRoom" onStartGuide={() => setForceStartGuide(true)} />
                </div>

                {/* BUDGET STATUS */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">Agent Budget</h4>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${(budget?.pctUsed || 0) > 80 ? "border-rose-500/50 bg-rose-500/10 text-rose-400" : "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                            }`}>
                            {budget?.pctUsed || 0}% USED
                        </span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <motion.div
                            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${budget?.pctUsed || 0}%` }}
                            transition={{ duration: 1 }}
                        />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>{budget?.used || 0} tokens</span>
                        <span>{budget?.limit || 20000} limit</span>
                    </div>
                </section>

                {/* SCOPE SELECTOR */}
                <div className="grid grid-cols-2 p-1 bg-white/5 rounded-xl border border-white/10">
                    <button
                        onClick={() => setScope("admin")}
                        className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${scope === "admin" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                            }`}
                    >
                        <ShieldCheck className="w-3.5 h-3.5" /> ADMIN
                    </button>
                    <button
                        onClick={() => setScope("ceo")}
                        className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${scope === "ceo" ? "bg-amber-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                            }`}
                    >
                        <Zap className="w-3.5 h-3.5" /> CEO
                    </button>
                </div>

                {/* QUICK TILES */}
                <section className="space-y-4">
                    <h4 className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">Quick Tactical Commands</h4>
                    <div className="grid grid-cols-2 gap-3" data-guide-id={GUIDE_IDS.ai_quick_tiles}>
                        {QUICK_COMMANDS.map((cmd) => {
                            const guideId = cmd.id === "/revenue" ? GUIDE_IDS.ai_revenue_brain :
                                cmd.id === "/today" ? GUIDE_IDS.ai_action_engine : undefined;
                            return (
                                <button
                                    key={cmd.id}
                                    data-guide-id={guideId}
                                    onClick={() => handleSend(cmd.id)}
                                    className="flex flex-col items-center justify-center p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all group active:scale-95"
                                >
                                    <cmd.icon className={`w-6 h-6 mb-2 transition-transform group-hover:scale-110 ${cmd.color}`} />
                                    <span className="text-[10px] text-slate-300 font-mono uppercase">{cmd.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* RECENT HISTORY PREVIEW */}
                <section className="flex-1 space-y-4 overflow-hidden flex flex-col">
                    <h4 className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em] flex items-center justify-between">
                        Operative Log <History className="w-3 h-3" />
                    </h4>
                    <div className="flex-1 space-y-3 overflow-y-auto text-[10px] font-mono scrollbar-hide">
                        {messages.slice(-5).map((m, idx) => (
                            <div key={idx} className="border-l border-white/10 pl-3 py-1 text-slate-400">
                                <div className="text-slate-600 mb-1">{new Date(m.createdAt).toLocaleTimeString()} : {m.role}</div>
                                <div className="truncate max-w-full opacity-60">
                                    {m.content.startsWith("{") ? "STRUCTURED PACK" : m.content}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
