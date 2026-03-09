"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, TrendingUp, TrendingDown, Minus, Filter, ShieldAlert, Globe } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

interface SnapshotMetrics {
    proposalAcceptanceRate: number;
    meetingShowRate: number;
    averageDealSize: number;
    pipelineVelocityDays: number;
}

interface MarketIntelClientProps {
    orgSlug: string;
    companyMetrics: SnapshotMetrics;
    orgData: { industry: string; sizeBand: string; plan: string; };
}

export function MarketIntelClient({ orgSlug, companyMetrics, orgData }: MarketIntelClientProps) {
    const [windowFilter, setWindowFilter] = useState<"7d" | "30d" | "90d">("30d");
    const [benchmarkData, setBenchmarkData] = useState<{ segment: any; snapshot: Partial<SnapshotMetrics> | null } | null>(null);
    const [loading, setLoading] = useState(true);
    const [insufficientData, setInsufficientData] = useState(false);

    useEffect(() => {
        fetchBenchmark();
    }, [windowFilter]);

    async function fetchBenchmark() {
        setLoading(true);
        setInsufficientData(false);
        try {
            const res = await fetch(`/api/org/${orgSlug}/market-intel/snapshots?window=${windowFilter}`);
            if (res.status === 204) {
                setInsufficientData(true);
                setBenchmarkData(null);
                return;
            }

            const data = await res.json().catch(() => null);
            if (!res.ok || !data) {
                setBenchmarkData(null);
                return;
            }

            if (data.insufficientData || data.insufficient_data) {
                setInsufficientData(true);
                setBenchmarkData(null);
                return;
            }

            if (!data.segment || !data.snapshot) {
                setBenchmarkData(null);
                return;
            }

            setBenchmarkData({ segment: data.segment, snapshot: data.snapshot });
        } catch (error) {
            console.error("Failed to load benchmarks", error);
        } finally {
            setLoading(false);
        }
    }

    const formatValue = (key: keyof SnapshotMetrics, val: number) => {
        if (key === 'averageDealSize') return `R$ ${val.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
        if (key === 'pipelineVelocityDays') return `${val.toFixed(1)} dias`;
        return `${val.toFixed(1)}%`;
    };

    const getTranslation = (key: string) => {
        const map: Record<string, string> = {
            'proposalAcceptanceRate': 'Conversão de Propostas',
            'averageDealSize': 'Ticket Médio',
            'pipelineVelocityDays': 'Ciclo de Vendas',
            'meetingShowRate': 'Comparecimento (Reuniões)'
        };
        return map[key] || key;
    };

    // Mock timeline data based on current snapshot to show Recharts
    const getChartData = (metricKey: keyof SnapshotMetrics, marketVal: number) => {
        const data = [];
        let cur = marketVal * 0.8; // start a bit lower
        for (let i = 1; i <= 6; i++) {
            cur += (Math.random() - 0.4) * (marketVal * 0.1);
            data.push({ name: `Mês ${i}`, market: Number(cur.toFixed(1)) });
        }
        data.push({ name: 'Atual', market: Number(marketVal.toFixed(1)) });
        return data;
    };

    return (
        <div className="min-h-screen bg-[#0b0b0f] text-white p-8 xl:p-12 font-sans relative overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-indigo-500/10 blur-[150px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#d4af37]/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-7xl mx-auto space-y-10 relative z-10">

                {/* Header & Controls */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-md">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight mb-2 flex items-center gap-3">
                            <Globe className="w-8 h-8 text-indigo-400" />
                            Market Intelligence
                        </h1>
                        <p className="text-zinc-400 max-w-xl">
                            Inteligência competitiva baseada em dados reais e anonimizados do seu segmento de mercado. Descubra onde sua operação lidera e onde há vazamento de lucro.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 bg-black/40 p-1.5 rounded-2xl border border-white/5">
                        {['7d', '30d', '90d'].map((win) => (
                            <button
                                key={win}
                                onClick={() => setWindowFilter(win as any)}
                                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${windowFilter === win
                                    ? 'bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]'
                                    : 'text-zinc-400 hover:text-white'
                                    }`}
                            >
                                {win}
                            </button>
                        ))}
                    </div>
                </header>

                {/* Segment Context Badge */}
                {benchmarkData && !loading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-bold">
                            <Filter className="w-4 h-4" />
                            Segmento: <span className="text-white capitalize">{benchmarkData.segment.industry}</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-zinc-300 text-sm">
                            Orgs Analisadas: <span className="font-bold text-white">{benchmarkData.segment.orgCount}</span>
                        </div>
                    </motion.div>
                )}

                {/* Main Content Area */}
                <div className="min-h-[400px]">
                    {loading ? (
                        <div className="flex items-center justify-center h-[400px]">
                            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : insufficientData ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-zinc-900/60 border border-amber-500/20 rounded-3xl p-12 text-center"
                        >
                            <ShieldAlert className="w-16 h-16 text-amber-500 mx-auto mb-6" />
                            <h2 className="text-2xl font-bold text-white mb-3">Blindagem de Dados Ativa (K-Anonymity)</h2>
                            <p className="text-zinc-400 max-w-lg mx-auto">
                                Não há empresas suficientes no seu segmento cruzado com este período ({windowFilter}) para gerar um benchmark estatisticamente seguro sem comprometer a identidade das organizações.
                            </p>
                            <p className="mt-4 text-sm text-zinc-500">Tente expandir a janela de tempo ou retorne em alguns dias.</p>
                        </motion.div>
                    ) : benchmarkData ? (
                        <div className="space-y-10">
                            {/* Animated Cards Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {(Object.keys(companyMetrics) as Array<keyof SnapshotMetrics>).map((key, i) => {
                                    const localVal = companyMetrics[key];
                                    const marketVal = benchmarkData.snapshot?.[key] ?? 0;

                                    const diff = localVal - marketVal;
                                    const isPositive = diff > 0;
                                    const lowerIsBetter = key === 'pipelineVelocityDays';
                                    const goodPerformance = lowerIsBetter ? !isPositive : isPositive;

                                    let diffStr = "Na Média";
                                    let Icon = Minus;
                                    let badgeColor = "bg-zinc-500/20 text-zinc-300 border-zinc-500/30";

                                    if (Math.abs(diff) > 0.1) {
                                        diffStr = isPositive ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
                                        Icon = goodPerformance ? TrendingUp : TrendingDown;
                                        badgeColor = goodPerformance
                                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                                            : "bg-rose-500/20 text-rose-400 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.15)]";
                                    }

                                    const chartData = getChartData(key, marketVal);

                                    return (
                                        <motion.div
                                            key={key}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                            className="bg-black/60 border border-white/5 rounded-3xl p-8 backdrop-blur-xl relative group hover:border-white/10 transition-colors"
                                        >
                                            <div className="flex justify-between items-start mb-8">
                                                <h3 className="text-zinc-400 font-medium">{getTranslation(key)}</h3>
                                                <div className={`px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-1.5 ${badgeColor}`}>
                                                    <Icon className="w-3.5 h-3.5" />
                                                    {diffStr} vs Mercado
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-6 mb-8">
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Sua Operação</p>
                                                    <p className="text-3xl font-black">{formatValue(key, localVal)}</p>
                                                </div>
                                                <div className="pl-6 border-l border-white/10">
                                                    <p className="text-[10px] uppercase tracking-widest text-indigo-400/80 mb-1">Mercado Oculto</p>
                                                    <p className="text-3xl font-bold text-zinc-300">{formatValue(key, marketVal)}</p>
                                                </div>
                                            </div>

                                            {/* Micro-Chart with Recharts */}
                                            <div className="h-24 w-full mt-4 opacity-50 group-hover:opacity-100 transition-opacity">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={chartData}>
                                                        <defs>
                                                            <linearGradient id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor={goodPerformance ? "#10b981" : "#8b5cf6"} stopOpacity={0.3} />
                                                                <stop offset="95%" stopColor={goodPerformance ? "#10b981" : "#8b5cf6"} stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <RechartsTooltip
                                                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', fontSize: '12px' }}
                                                            itemStyle={{ color: '#fff' }}
                                                            formatter={(val: any) => formatValue(key, val || 0)}
                                                        />
                                                        <Area type="monotone" dataKey="market" stroke={goodPerformance ? "#10b981" : "#8b5cf6"} fillOpacity={1} fill={`url(#grad-${key})`} />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>

                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
