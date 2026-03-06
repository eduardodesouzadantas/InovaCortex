"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    BarChart3,
    TrendingUp,
    ShieldAlert,
    Rocket,
    Target,
    ChevronRight,
    Zap,
    ArrowUpRight,
    Loader2,
    CheckCircle2,
    Calendar
} from "lucide-react";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    Legend
} from "recharts";

interface ExecutiveData {
    revenueBrain: {
        totalOpportunity: number;
        highProbabilityDeals: any[];
        fastWins: string[];
        recommendations: string[];
    };
    leakDetector: {
        totalLeakValue: number;
        leakItems: any[];
    };
    actionEngine: {
        actions: any[];
    };
}

export function ExecutiveDashboardClient({ slug, orgName }: { slug: string; orgName: string }) {
    const [data, setData] = useState<ExecutiveData | null>(null);
    const [loading, setLoading] = useState(true);
    const [executing, setExecuting] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/org/${slug}/executive/intelligence`);
                const json = await res.json();
                setData(json);
            } catch (err) {
                console.error("Failed to fetch executive intelligence", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [slug]);

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-[#030712]">
                <div className="text-center space-y-4">
                    <Loader2 className="h-10 w-10 animate-spin text-amber-500 mx-auto" />
                    <p className="text-slate-400 font-medium animate-pulse">Iniciando Executive Intelligence...</p>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const leakedValue = data.leakDetector.totalLeakValue;
    const opportunityValue = data.revenueBrain.totalOpportunity;

    // Pie data for Leak vs Opportunity (Simplified logic)
    const pieData = [
        { name: 'Oportunidade', value: opportunityValue, color: '#f59e0b' },
        { name: 'Vazamento', value: leakedValue, color: '#ef4444' }
    ];

    const formatCurrency = (cents: number) => {
        return `R$ ${(cents / 100).toLocaleString('pt-BR')}`;
    };

    return (
        <div className="relative z-10 p-6 md:p-10 max-w-7xl mx-auto space-y-10">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold uppercase tracking-widest mb-4"
                    >
                        <Zap className="h-3 w-3 fill-amber-500" />
                        Executive War Room
                    </motion.div>
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white via-white to-amber-500 bg-clip-text text-transparent tracking-tighter">
                        Intelligence Hub: {orgName}
                    </h1>
                    <p className="text-slate-400 mt-2 max-w-2xl text-lg">
                        Métricas consolidadas de receita, vazamento e priorização operacional para o CEO.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Status da Operação</p>
                        <p className="text-emerald-400 flex items-center gap-1.5 font-bold">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                            Live Intelligence
                        </p>
                    </div>
                </div>
            </header>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Revenue Opportunity Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="group relative bg-[#0f172a]/50 backdrop-blur-xl border border-white/5 rounded-3xl p-8 overflow-hidden hover:border-amber-500/30 transition-all duration-500 h-[320px] flex flex-col justify-between"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500 transform group-hover:scale-110">
                        <TrendingUp className="h-32 w-32" />
                    </div>

                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
                                <TrendingUp className="h-6 w-6 text-amber-500" />
                            </div>
                            <span className="font-bold text-slate-300 uppercase tracking-widest text-xs">Revenue Brain</span>
                        </div>
                        <h3 className="text-sm font-medium text-slate-400 mb-1">Total Opportunity</h3>
                        <p className="text-5xl font-black text-white tracking-tighter">
                            {formatCurrency(opportunityValue)}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sinais Quentes</p>
                        <div className="flex gap-2">
                            {data.revenueBrain.fastWins.map((win, i) => (
                                <span key={i} className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                                    {win}
                                </span>
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* Leak Detector Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="group relative bg-[#0f172a]/50 backdrop-blur-xl border border-white/5 rounded-3xl p-8 overflow-hidden hover:border-rose-500/30 transition-all duration-500 h-[320px] flex flex-col justify-between"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/30">
                            <ShieldAlert className="h-6 w-6 text-rose-500" />
                        </div>
                        <span className="font-bold text-slate-300 uppercase tracking-widest text-xs">Leak Detector</span>
                    </div>

                    <div className="flex-1 flex items-center justify-center">
                        <div className="h-40 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="80%"
                                        startAngle={180}
                                        endAngle={0}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                        itemStyle={{ color: '#f1f5f9' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="text-center -mt-8">
                                <p className="text-2xl font-black text-white">{formatCurrency(leakedValue)}</p>
                                <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Revenue Leaked</p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Action Engine Count Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="group relative bg-[#0f172a]/50 backdrop-blur-xl border border-white/5 rounded-3xl p-8 overflow-hidden hover:border-indigo-500/30 transition-all duration-500 h-[320px] flex flex-col justify-between"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 rounded-2xl bg-indigo-500/20 border border-indigo-500/30">
                            <Rocket className="h-6 w-6 text-indigo-500" />
                        </div>
                        <span className="font-bold text-slate-300 uppercase tracking-widest text-xs">Action Engine</span>
                    </div>

                    <div>
                        <h3 className="text-sm font-medium text-slate-400 mb-1">Priority Actions Today</h3>
                        <p className="text-6xl font-black text-white tracking-tighter">
                            {data.actionEngine.actions.length}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 group-hover:gap-4 transition-all duration-300 text-indigo-400 font-bold text-sm">
                        Ver Roadmap Operacional <ChevronRight className="h-4 w-4" />
                    </div>
                </motion.div>
            </div>

            {/* Detailed Lists Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Oportunidades List */}
                <div className="space-y-4">
                    <h3 className="flex items-center gap-2 font-bold text-lg text-slate-200 pl-2">
                        <Zap className="h-5 w-5 text-amber-500 fill-amber-500/20" />
                        Oportunidades de Receita
                    </h3>
                    <div className="space-y-3">
                        {data.revenueBrain.highProbabilityDeals.map((deal: any, i: number) => (
                            <motion.div
                                key={deal.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 * i }}
                                className="group/item flex items-center justify-between p-5 rounded-2xl bg-[#0f172a]/40 border border-white/5 hover:bg-white/[0.03] hover:border-white/10 transition-all duration-300"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                        <ArrowUpRight className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-100">{deal.email.split('@')[0]}</h4>
                                        <p className="text-xs text-slate-500">Probabilidade: {Math.round(deal.probability * 100)}%</p>
                                    </div>
                                </div>
                                <div className="text-right text-emerald-400 font-bold">
                                    {formatCurrency(deal.value)}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Top Actions Section */}
                <div className="space-y-4">
                    <h3 className="flex items-center gap-2 font-bold text-lg text-slate-200 pl-2">
                        <CheckCircle2 className="h-5 w-5 text-indigo-500" />
                        Top 3 Actions Today
                    </h3>
                    <div className="space-y-3">
                        {data.actionEngine.actions.slice(0, 3).map((action: any, i: number) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 * i }}
                                className="group/item relative p-6 rounded-2xl bg-gradient-to-br from-[#1e293b]/60 to-[#0f172a]/80 border border-white/5 hover:border-indigo-500/20 transition-all duration-300"
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`h-1.5 w-1.5 rounded-full ${action.priority === 'high' ? 'bg-rose-500 shadow-[0_0_8px_#ef4444]' : 'bg-indigo-500 shadow-[0_0_8px_#6366f1]'}`} />
                                            <h4 className="font-bold text-slate-100 text-lg leading-tight">{action.label}</h4>
                                        </div>
                                        <p className="text-sm text-slate-400 leading-relaxed font-medium">
                                            {action.description}
                                        </p>
                                        <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest pt-2">
                                            Impacto: {action.impact}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setExecuting(action.label);
                                            setTimeout(() => setExecuting(null), 1500);
                                        }}
                                        disabled={!!executing}
                                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white text-white hover:text-black font-bold transition-all duration-500 text-sm whitespace-nowrap"
                                    >
                                        {executing === action.label ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Executando...
                                            </>
                                        ) : (
                                            <>
                                                Execute
                                                <ChevronRight className="h-4 w-4" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer Insights */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="rounded-3xl p-6 bg-gradient-to-r from-amber-500/10 via-transparent to-rose-500/10 border border-white/5 flex flex-col md:flex-row items-center justify-between gap-4"
            >
                <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-slate-500" />
                    <p className="text-sm text-slate-400 font-medium">
                        Próxima calibração de dados em <span className="text-slate-200">54 segundos</span>.
                    </p>
                </div>
                <div className="flex gap-4">
                    <button className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Exportar para PDF</button>
                    <button className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Avisar Diretores</button>
                </div>
            </motion.div>
        </div>
    );
}
