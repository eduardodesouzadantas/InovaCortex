"use client";

import { motion } from "framer-motion";
import { Radar, Send, MessageSquareReply, CalendarCheck, Zap } from "lucide-react";

interface GrowthClientProps {
    orgSlug: string;
    metrics: {
        leadsDiscovered: number;
        outboundSent: number;
        replies: number;
        meetingsBooked: number;
        revenueFromAutomation: number;
    };
    signals: any[];
}

export function GrowthClient({ orgSlug, metrics, signals }: GrowthClientProps) {
    const statCards = [
        { label: "Leads ICP Encontrados", value: metrics.leadsDiscovered, icon: Radar, color: "text-blue-400" },
        { label: "Outbounds Enviados", value: metrics.outboundSent, icon: Send, color: "text-purple-400" },
        { label: "Respostas Automáticas", value: metrics.replies, icon: MessageSquareReply, color: "text-emerald-400" },
        { label: "Reuniões Agendadas", value: metrics.meetingsBooked, icon: CalendarCheck, color: "text-orange-400" },
    ];

    return (
        <div className="min-h-screen bg-[#0b0b0f] text-white p-8 xl:p-12">
            <div className="max-w-7xl mx-auto space-y-12">

                {/* Header Phase */}
                <div>
                    <h1 className="text-3xl font-black tracking-tight mb-2 flex items-center gap-3">
                        Autonomous Growth Engine
                        <span className="text-xs font-bold px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 uppercase tracking-widest">
                            Em Operação
                        </span>
                    </h1>
                    <p className="text-zinc-400">
                        Seu exército de inteligência prospectando, ativando conteúdo e capturando contas High-Ticket 24/7.
                    </p>
                </div>

                {/* Hero Revenue Phase */}
                <div className="rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-3xl p-8 xl:p-12 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#d4af37]/20 blur-[120px] rounded-full opacity-20 pointer-events-none" />

                    <p className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500 mb-4">
                        Receita Gerada pela Automação
                    </p>
                    <p className="text-6xl xl:text-7xl font-black mb-2 text-[#d4af37]">
                        <span className="text-3xl tracking-normal text-zinc-500 mr-2">R$</span>
                        {(metrics.revenueFromAutomation / 100).toLocaleString('pt-BR')}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <Zap className="w-4 h-4 text-[#d4af37]" />
                        Mapeado via AI Discovery Source
                    </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {statCards.map((stat, i) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="p-6 rounded-2xl border border-white/5 bg-zinc-900/50"
                        >
                            <stat.icon className={`w-5 h-5 mb-4 ${stat.color}`} />
                            <p className="text-3xl font-black">{stat.value}</p>
                            <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">{stat.label}</p>
                        </motion.div>
                    ))}
                </div>

                {/* Signal Stream */}
                <div>
                    <h3 className="text-lg font-bold mb-6">Últimos Sinais de Crescimento</h3>
                    <div className="space-y-4">
                        {signals.map((signal, i) => (
                            <motion.div
                                key={signal.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="p-4 rounded-xl border border-white/5 bg-zinc-900/40 flex items-center justify-between"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-2 h-2 rounded-full ${signal.severity === 'high' ? 'bg-rose-500' : 'bg-[#d4af37]'}`} />
                                    <p className="font-medium">{signal.message}</p>
                                </div>
                                <div className="text-xs text-zinc-500">
                                    {new Date(signal.createdAt).toLocaleDateString('pt-BR')}
                                </div>
                            </motion.div>
                        ))}

                        {signals.length === 0 && (
                            <p className="text-sm text-zinc-500 py-8 text-center">Nenhum sinal detectado recentemente.</p>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
