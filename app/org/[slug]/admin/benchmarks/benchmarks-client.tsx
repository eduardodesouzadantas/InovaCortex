"use client";

import { motion } from "framer-motion";
import { BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface BenchmarkMetric {
    id: string;
    industry: string;
    metric: string;
    value: number;
    sampleSize: number;
    period: string;
}

interface BenchmarksClientProps {
    orgSlug: string;
    industry: string;
    benchmarks: BenchmarkMetric[];
    companyMetrics: Record<string, number>;
}

export function BenchmarksClient({ orgSlug, industry, benchmarks, companyMetrics }: BenchmarksClientProps) {

    // Formatting helpers
    const formatValue = (metricKey: string, val: number) => {
        if (metricKey === 'average_deal_size') return `R$ ${val.toLocaleString('pt-BR')}`;
        if (metricKey === 'pipeline_velocity') return `${val.toFixed(1)} dias`;
        return `${val.toFixed(1)}%`;
    };

    const getTranslation = (key: string) => {
        const map: any = {
            'proposal_acceptance': 'Taxa de Aceite de Proposta',
            'average_deal_size': 'Ticket Médio (Fechado)',
            'pipeline_velocity': 'Ciclo de Vendas (Dias)',
            'meeting_show_rate': 'Comparecimento em Reuniões'
        };
        return map[key] || key;
    };

    const displayMetrics = ['proposal_acceptance', 'average_deal_size', 'pipeline_velocity', 'meeting_show_rate'];

    return (
        <div className="min-h-screen bg-[#0b0b0f] text-white p-8 xl:p-12">
            <div className="max-w-7xl mx-auto space-y-12">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight mb-2 flex items-center gap-3">
                            <BarChart3 className="w-8 h-8 text-[#d4af37]" />
                            Inteligência de Mercado
                        </h1>
                        <p className="text-zinc-400">
                            Compare o desempenho da sua operação contra o referencial do setor: <span className="text-[#d4af37] font-bold capitalize">{industry}</span>
                        </p>
                    </div>
                </div>

                {/* Benchmark Comparison Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {displayMetrics.map((key, i) => {
                        const benchmark = benchmarks.find(b => b.metric === key && b.industry !== 'all');
                        const globalBenchmark = benchmarks.find(b => b.metric === key && b.industry === 'all');
                        const activeBenchmark = benchmark || globalBenchmark;

                        const localValue = companyMetrics[key] || 0;
                        const benchmarkValue = activeBenchmark ? activeBenchmark.value : 0;

                        // Calculate Diff
                        let diffStr = "Sem Dados";
                        let Icon = Minus;
                        let color = "text-zinc-500";

                        if (activeBenchmark && localValue > 0) {
                            const diff = localValue - benchmarkValue;
                            const isPositive = diff > 0;

                            // For velocity, lower is better. Reverse the logic.
                            const lowerIsBetter = key === 'pipeline_velocity';
                            const goodPerformance = lowerIsBetter ? !isPositive : isPositive;

                            if (Math.abs(diff) < 0.1) {
                                diffStr = "Na Média";
                                Icon = Minus;
                                color = "text-zinc-400";
                            } else {
                                diffStr = isPositive ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
                                Icon = goodPerformance ? TrendingUp : TrendingDown;
                                color = goodPerformance ? "text-emerald-400" : "text-rose-400";
                            }
                        }

                        return (
                            <motion.div
                                key={key}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="p-8 rounded-3xl border border-white/5 bg-zinc-900/40 relative overflow-hidden"
                            >
                                <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">
                                    {getTranslation(key)}
                                </h3>

                                <div className="grid grid-cols-2 gap-8">
                                    {/* Local Metric */}
                                    <div>
                                        <p className="text-zinc-500 text-xs mb-1">Sua Operação</p>
                                        <p className="text-4xl font-black">{formatValue(key, localValue)}</p>
                                    </div>

                                    {/* Benchmark */}
                                    <div className="border-l border-white/10 pl-8">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-zinc-500 text-xs mb-1 flex items-center gap-2">
                                                    Referencial (Mercado)
                                                    <span className="text-[9px] bg-white/10 px-1.5 rounded">{activeBenchmark?.sampleSize || 0} Orgs</span>
                                                </p>
                                                <p className="text-2xl font-bold text-zinc-300">
                                                    {activeBenchmark ? formatValue(key, benchmarkValue) : '-'}
                                                </p>
                                            </div>

                                            {activeBenchmark && localValue > 0 && (
                                                <div className={`flex flex-col items-end ${color}`}>
                                                    <Icon className="w-5 h-5 mb-1" />
                                                    <span className="text-sm font-bold">{diffStr}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-8 h-2 w-full bg-zinc-800 rounded-full overflow-hidden flex">
                                    {/* Simple visual bar logic */}
                                    <div
                                        className={`h-full ${key === 'pipeline_velocity' ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${Math.min(100, Math.max(0, localValue / (benchmarkValue || 1) * 50))}%` }}
                                    />
                                    <div className="w-[2px] h-full bg-white opacity-50 relative z-10" />
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

            </div>
        </div>
    );
}
