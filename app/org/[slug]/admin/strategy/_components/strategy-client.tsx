"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    TrendingUp,
    AlertTriangle,
    Zap,
    Target,
    ArrowRight,
    RefreshCw,
    Plus,
    CheckCircle2
} from "lucide-react";
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
    ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, Cell
} from "recharts";
import { HelpPopover } from "@/components/ui/help-popover";
import { getHelp } from "@/lib/help/use-help";

interface StrategyClientProps {
    orgId: string;
    orgSlug: string;
    orgName: string;
    industry: string;
}

export function StrategyClient({ orgId, orgSlug, orgName, industry }: StrategyClientProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [recalculating, setRecalculating] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        try {
            const res = await fetch(`/api/org/${orgSlug}/strategy/recommendations`);
            const json = await res.json();
            setData(json);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function handleRecalc() {
        setRecalculating(true);
        try {
            await fetch(`/api/org/${orgSlug}/strategy/recommendations/recalc`, { method: 'POST' });
            await fetchData();
        } finally {
            setRecalculating(false);
        }
    }

    if (loading) return <div className="p-12 text-zinc-500">Analisando métricas do setor...</div>;

    const radarData = data ? [
        { subject: 'Conversão', A: data.kpis.proposalAcceptanceRate, B: data.benchmarks?.proposalAcceptanceRate || 40, fullMark: 100 },
        { subject: 'Show Rate', A: data.kpis.meetingShowRate, B: data.benchmarks?.meetingShowRate || 80, fullMark: 100 },
        { subject: 'Deal Size', A: Math.min(100, (data.kpis.averageDealSize / (data.benchmarks?.averageDealSize || 5000)) * 50), B: 50, fullMark: 100 },
        { subject: 'Velocidade', A: Math.max(0, 100 - (data.kpis.pipelineVelocityDays / (data.benchmarks?.pipelineVelocityDays || 10) * 50)), B: 50, fullMark: 100 },
    ] : [];

    const scatterData = data?.recommendations.map((r: any) => ({
        name: r.title,
        impact: r.impactScore,
        effort: r.effortScore,
        z: r.impactScore * 10
    })) || [];

    return (
        <div className="p-8 xl:p-12 max-w-7xl mx-auto space-y-12">

            {/* Strategy Hero */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold tracking-widest uppercase border border-emerald-500/20">
                            CEO Command Center
                        </span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-zinc-400 text-xs font-medium">Atualizado há 5 min</span>
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-white mb-4">
                        Diretrizes de Crescimento <br />
                        <span className="text-[#d4af37]">InovaCortex Strategy Engine</span>
                    </h1>
                    <p className="text-zinc-400 max-w-xl text-lg">
                        Transformando {data?.kpis?.proposalAcceptanceRate?.toFixed(1)}% de conversão em decisões acionáveis para dominar o setor de <span className="text-white font-bold">{industry}</span>.
                    </p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={handleRecalc}
                        disabled={recalculating}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm font-bold disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
                        Recalcular
                    </button>
                    <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#d4af37] text-black hover:bg-[#b8962e] transition-all text-sm font-black">
                        <Plus className="w-4 h-4" />
                        Novo Experimento
                    </button>
                </div>
            </div>

            {/* Radar & Matrix Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Visual Radar */}
                <div className="p-8 rounded-3xl border border-white/5 bg-zinc-900/40 relative overflow-hidden h-[400px]">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                Radar de Performance
                                <HelpPopover {...getHelp("benchmarkDelta")} />
                            </h3>
                            <p className="text-xs text-zinc-500">Métricas Reais vs. Benchmarks do Setor</p>
                        </div>
                        <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#d4af37]" /> Sua Org
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-white/20" /> Mercado
                            </div>
                        </div>
                    </div>
                    <div className="absolute inset-0 pt-16">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                <PolarGrid stroke="#333" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#666', fontSize: 12 }} />
                                <Radar name="Market" dataKey="B" stroke="#666" fill="#333" fillOpacity={0.3} />
                                <Radar name="You" dataKey="A" stroke="#d4af37" fill="#d4af37" fillOpacity={0.5} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Impact/Effort Matrix */}
                <div className="p-8 rounded-3xl border border-white/5 bg-zinc-900/40 relative overflow-hidden h-[400px]">
                    <div className="mb-8">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            Matriz de Priorização
                            <HelpPopover {...getHelp("impactScore")} />
                            <HelpPopover {...getHelp("effortScore")} />
                        </h3>
                        <p className="text-xs text-zinc-500">Impacto vs. Facilidade de Execução</p>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                            <XAxis type="number" dataKey="effort" name="Esforço" domain={[0, 10]} hide />
                            <YAxis type="number" dataKey="impact" name="Impacto" domain={[0, 10]} hide />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#111', border: '1px solid #333' }} />
                            <Scatter name="Recomendações" data={scatterData}>
                                {scatterData.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={entry.impact > 7 ? '#d4af37' : '#555'} />
                                ))}
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                    {/* Matrix Labels */}
                    <div className="absolute bottom-10 left-0 right-0 flex justify-between px-12 text-[10px] font-bold text-zinc-600 uppercase">
                        <span>Fácil (Baixo Esforço)</span>
                        <span>Difícil (Alto Esforço)</span>
                    </div>
                    <div className="absolute top-20 left-4 bottom-10 flex flex-col justify-between text-[10px] font-bold text-zinc-600 uppercase vertical-text">
                        <span>Alto Impacto</span>
                        <span>Baixo Impacto</span>
                    </div>
                </div>
            </div>

            {/* Next Best Moves */}
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-[#d4af37]" />
                    <h2 className="text-xl font-bold">Próximos Passos Recomendados</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <AnimatePresence>
                        {data?.recommendations.map((reco: any, i: number) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="p-6 rounded-2xl border border-white/5 bg-zinc-900/60 hover:border-[#d4af37]/30 transition-all group"
                            >
                                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mb-4 group-hover:bg-[#d4af37]/10 transition-all">
                                    {reco.type === 'revenue' ? <TrendingUp className="w-5 h-5 text-emerald-400" /> : <Target className="w-5 h-5 text-[#d4af37]" />}
                                </div>
                                <h3 className="font-bold text-white mb-2">{reco.title}</h3>
                                <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
                                    {reco.summary}
                                </p>
                                <div className="flex items-center justify-between mt-auto">
                                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">
                                        ROI Est: R$ {(reco.roiCents / 100).toLocaleString('pt-BR')}
                                    </span>
                                    <button className="flex items-center gap-1 text-xs font-bold text-white hover:text-[#d4af37] transition-all">
                                        Executar <ArrowRight className="w-3 h-3" />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            {/* Growth Experiments */}
            <div className="p-8 rounded-3xl border border-white/5 bg-zinc-900/40">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <RefreshCw className="w-5 h-5 text-zinc-400" />
                        <h2 className="text-xl font-bold">Experimentos de Crescimento</h2>
                    </div>
                    <div className="flex gap-4">
                        <span className="text-xs text-zinc-500 flex items-center gap-2">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> 2 Concluídos
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-zinc-500 uppercase font-bold border-b border-white/5">
                            <tr>
                                <th className="px-4 py-4">Hipótese</th>
                                <th className="px-4 py-4">Métrica-Chave</th>
                                <th className="px-4 py-4">Status</th>
                                <th className="px-4 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {data?.experimentSuggestions.map((exp: any, i: number) => (
                                <tr key={i} className="group hover:bg-white/5 transition-all">
                                    <td className="px-4 py-6 font-medium text-white max-w-md">{exp.hypothesis}</td>
                                    <td className="px-4 py-6 text-zinc-400 uppercase tracking-tighter text-xs font-bold">{exp.metricKey}</td>
                                    <td className="px-4 py-6">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-500 border border-white/5">
                                            SUGESTÃO
                                        </span>
                                    </td>
                                    <td className="px-4 py-6 text-right">
                                        <button className="text-[#d4af37] font-bold text-xs hover:underline">
                                            Criar Draft
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
