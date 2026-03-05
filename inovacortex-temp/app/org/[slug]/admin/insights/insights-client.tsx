"use client";

import { motion } from "framer-motion";
import { Brain, TrendingUp, AlertTriangle, CheckCircle, Clock } from "lucide-react";

interface StrategicInsight {
    id: string;
    organizationId: string;
    category: string;
    title: string;
    description: string;
    impactScore: number;
    estimatedRevenueImpact: number | null;
    recommendedAction: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}

interface InsightsClientProps {
    orgSlug: string;
    insights: StrategicInsight[];
}

export function InsightsClient({ orgSlug, insights }: InsightsClientProps) {
    const getCategoryStyles = (category: string) => {
        switch (category) {
            case 'revenue': return { icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10", border: 'border-emerald-500/20' };
            case 'sales': return { icon: AlertTriangle, color: "text-rose-400", bg: "bg-rose-500/10", border: 'border-rose-500/20' };
            case 'marketing': return { icon: Brain, color: "text-blue-400", bg: "bg-blue-500/10", border: 'border-blue-500/20' };
            case 'operations': return { icon: Clock, color: "text-purple-400", bg: "bg-purple-500/10", border: 'border-purple-500/20' };
            default: return { icon: CheckCircle, color: "text-zinc-400", bg: "bg-zinc-500/10", border: 'border-white/5' };
        }
    };

    return (
        <div className="min-h-screen bg-[#0b0b0f] text-white p-8 xl:p-12">
            <div className="max-w-7xl mx-auto space-y-12">

                {/* Header Sequence */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight mb-2 flex items-center gap-3">
                            <Brain className="w-8 h-8 text-[#d4af37]" />
                            AI Business Brain
                        </h1>
                        <p className="text-zinc-400">
                            Inteligência estratégica derivada dos padrões vitais do seu negócio.
                        </p>
                    </div>

                    <button className="px-6 py-3 bg-[#d4af37] text-black font-bold text-sm tracking-widest uppercase rounded-full hover:bg-white transition-colors duration-300">
                        Forçar Análise Geral
                    </button>
                </div>

                {/* Insight Feed */}
                <div className="space-y-6">
                    {insights.map((insight, i) => {
                        const style = getCategoryStyles(insight.category);
                        const Icon = style.icon;

                        return (
                            <motion.div
                                key={insight.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className={`rounded-3xl border ${style.border} ${style.bg} p-8 backdrop-blur-md relative overflow-hidden`}
                            >
                                {/* Impact Score Ribbon */}
                                <div className="absolute top-0 right-8 px-4 py-2 bg-black/40 rounded-b-xl border border-t-0 border-white/10 backdrop-blur-xl">
                                    <span className="text-xs uppercase tracking-widest text-zinc-500 mr-2">Impacto</span>
                                    <span className={`font-black ${insight.impactScore >= 8 ? 'text-rose-400' : 'text-[#d4af37]'}`}>
                                        {insight.impactScore}/10
                                    </span>
                                </div>

                                <div className="flex items-start gap-6">
                                    <div className={`p-4 rounded-2xl bg-black/40 border ${style.border}`}>
                                        <Icon className={`w-8 h-8 ${style.color}`} />
                                    </div>

                                    <div className="flex-1">
                                        <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2 font-bold">
                                            Alerta de <span className={style.color}>{insight.category}</span>
                                        </p>
                                        <h3 className="text-2xl font-black mb-3">{insight.title}</h3>
                                        <p className="text-zinc-300 leading-relaxed mb-6">
                                            {insight.description}
                                        </p>

                                        {/* Action Block */}
                                        <div className="p-4 rounded-2xl bg-black/50 border border-white/5 flex items-center justify-between">
                                            <div>
                                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 font-bold">Ação Recomendada pela IA</p>
                                                <p className="font-medium text-[#d4af37]">{insight.recommendedAction}</p>
                                            </div>

                                            {insight.estimatedRevenueImpact && (
                                                <div className="text-right">
                                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1 font-bold">Receita Estimada (Risco/Ganho)</p>
                                                    <p className="font-black text-white text-lg">
                                                        R$ {(insight.estimatedRevenueImpact / 100).toLocaleString('pt-BR')}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}

                    {insights.length === 0 && (
                        <div className="p-12 text-center border border-white/5 rounded-3xl bg-zinc-900/30">
                            <Brain className="w-12 h-12 text-[#d4af37] mx-auto mb-4 opacity-50" />
                            <h3 className="text-lg font-bold mb-2">Sistema Operando em Ordem Perfeita</h3>
                            <p className="text-zinc-500">
                                O AI Brain não detectou gargalos no funil de receita ou quebras de padrão nos últimos 30 dias.
                            </p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
