"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Users,
    Trophy,
    BarChart3,
    Zap,
    DollarSign,
    ChevronRight,
    Plus,
    Clock,
    Target,
    TrendingUp,
    AlertCircle
} from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    LineChart,
    Line
} from "recharts";

type TabType = "team" | "leaderboard" | "pipeline" | "performance" | "commissions";

export function SalesDashboardClient({ orgSlug }: { orgSlug: string }) {
    const [activeTab, setActiveTab] = useState<TabType>("team");
    const [isLoading, setIsLoading] = useState(true);

    // Mock data for initial UI layout - will be replaced with API calls
    const tabs = [
        { id: "team", label: "Team", icon: Users },
        { id: "leaderboard", label: "Leaderboard", icon: Trophy },
        { id: "pipeline", label: "Pipeline", icon: BarChart3 },
        { id: "performance", label: "Performance", icon: Zap },
        { id: "commissions", label: "Commissions", icon: DollarSign },
    ];

    useEffect(() => {
        // Simulate initial load for smooth Framer entry
        const timer = setTimeout(() => setIsLoading(false), 800);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="space-y-6">
            {/* Tabs Navigation */}
            <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={`
              flex items-center gap-2 px-5 py-3 rounded-xl transition-all duration-300 whitespace-nowrap border
              ${activeTab === tab.id
                                ? "bg-white/10 border-white/20 text-white shadow-xl shadow-black/20"
                                : "bg-transparent border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5"}
            `}
                    >
                        <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? "text-gold-400" : ""}`} />
                        <span className="font-medium">{tab.label}</span>
                    </button>
                ))}
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="min-h-[400px]"
                >
                    {activeTab === "team" && <TeamTab orgSlug={orgSlug} />}
                    {activeTab === "leaderboard" && <LeaderboardTab orgSlug={orgSlug} />}
                    {activeTab === "pipeline" && <PipelineTab orgSlug={orgSlug} />}
                    {activeTab === "performance" && <PerformanceTab orgSlug={orgSlug} />}
                    {activeTab === "commissions" && <CommissionsTab orgSlug={orgSlug} />}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

// ─── Individual Tabs (Placeholders for now, will implement fully next) ──────────

function TeamTab({ orgSlug }: { orgSlug: string }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Rep Card Example */}
            <div className="group relative overflow-hidden rounded-2xl bg-white/5 border border-white/10 p-6 hover:border-white/20 transition-all duration-500">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gold-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-gold-500/10 transition-colors" />

                <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gold-500 to-amber-700 flex items-center justify-center text-xl font-bold">
                            RL
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">Ricardo L.</h3>
                            <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                                <Zap className="w-3 h-3 text-gold-400" />
                                Senior Closer
                            </p>
                        </div>
                    </div>
                    <div className="px-2 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-[10px] font-bold text-green-400 uppercase tracking-wider">
                        Ativo
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-gray-400">Meta do Mês (Março)</span>
                            <span className="text-white font-medium">72%</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: "72%" }}
                                className="h-full bg-gradient-to-r from-gold-500 to-amber-400"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Revenue</p>
                            <p className="text-sm font-bold">R$ 92.400</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Active Leads</p>
                            <p className="text-sm font-bold">14</p>
                        </div>
                    </div>
                </div>

                <button className="w-full mt-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                    Ver Perfil Detalhado
                    <ChevronRight className="w-3 h-3" />
                </button>
            </div>

            {/* Add Rep Action */}
            <button className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-white/10 hover:border-white/20 hover:bg-white/5 transition-all duration-300 min-h-[260px]">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                    <Plus className="w-6 h-6 text-gray-400" />
                </div>
                <div className="text-center">
                    <p className="font-bold">Cadastrar Vendedor</p>
                    <p className="text-xs text-gray-500">Adicione SDRs ou Closers ao time</p>
                </div>
            </button>
        </div>
    );
}

function LeaderboardTab({ orgSlug }: { orgSlug: string }) {
    const data = [
        { name: "Ricardo L.", revenue: 92400 },
        { name: "Julia M.", revenue: 84000 },
        { name: "Felipe S.", revenue: 56000 },
        { name: "Ana P.", revenue: 42000 },
        { name: "Bruno T.", revenue: 28000 },
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6">
                <h3 className="font-bold mb-6 flex items-center gap-2 text-lg">
                    <TrendingUp className="w-5 h-5 text-gold-500" />
                    Ranking de Performa de Faturamento
                </h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                            <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis hide />
                            <Tooltip
                                contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: "12px", fontSize: "12px" }}
                                itemStyle={{ color: "#fff" }}
                                cursor={{ fill: 'transparent' }}
                            />
                            <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 0 ? "#facc15" : "#facc1533"} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold">Top Closers</h3>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Março 2026</span>
                </div>

                <div className="space-y-4">
                    {data.map((rep, i) => (
                        <div key={rep.name} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-colors">
                            <div className="flex items-center gap-3">
                                <span className={`text-xs font-bold ${i === 0 ? "text-gold-400" : "text-gray-500"}`}>#0{i + 1}</span>
                                <span className="font-medium text-sm">{rep.name}</span>
                            </div>
                            <span className="font-bold text-sm">R$ {(rep.revenue / 1000).toFixed(1)}k</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function PipelineTab({ orgSlug }: { orgSlug: string }) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
            <BarChart3 className="w-16 h-16 text-gray-700 mb-6" />
            <h3 className="text-xl font-bold mb-2">Visualização de Funil por Rep</h3>
            <p className="text-gray-500 max-w-sm">Estamos processando os dados do pipeline para agrupar por cada vendedor atribuído.</p>
        </div>
    );
}

function PerformanceTab({ orgSlug }: { orgSlug: string }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
                { label: "Win-rate Médio", value: "32%", sub: "+4% vs Jan", icon: Zap },
                { label: "Ciclo de Vendas", value: "14 dias", sub: "-2 dias", icon: Clock },
                { label: "Show-up Rate", value: "88%", sub: "Reuniões atendidas", icon: Users },
                { label: "Ticket Médio", value: "R$ 12.400", sub: "+R$ 800", icon: DollarSign }
            ].map((stat) => (
                <div key={stat.label} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                        <stat.icon className="w-5 h-5 text-gold-500" />
                    </div>
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">{stat.label}</p>
                    <h4 className="text-2xl font-bold mb-1">{stat.value}</h4>
                    <p className="text-[10px] text-green-400 font-bold">{stat.sub}</p>
                </div>
            ))}
        </div>
    );
}

function CommissionsTab({ orgSlug }: { orgSlug: string }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 lg:col-span-1">
                <h3 className="font-bold mb-6 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-gold-500" />
                    Visão de Payouts
                </h3>
                <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-gold-500/10 border border-gold-500/20">
                        <p className="text-[10px] text-gold-400 uppercase font-bold mb-1 tracking-widest">Pendentes</p>
                        <p className="text-2xl font-bold">R$ 14.250</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-1 tracking-widest">Pagos (Mês)</p>
                        <p className="text-2xl font-bold">R$ 42.800</p>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6 overflow-hidden">
                <h3 className="font-bold mb-4">Próximos Pagamentos</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="py-3 font-bold text-gray-500 text-[10px] uppercase">Vendedor</th>
                                <th className="py-3 font-bold text-gray-500 text-[10px] uppercase">Deal</th>
                                <th className="py-3 font-bold text-gray-500 text-[10px] uppercase">Valor Комиissão</th>
                                <th className="py-3 font-bold text-gray-500 text-[10px] uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                { rep: "Ricardo L.", deal: "InovaCortex Corp", value: "R$ 4.200", status: "Pending" },
                                { rep: "Julia M.", deal: "TechNova Ltda", value: "R$ 3.840", status: "Pending" },
                            ].map((p, i) => (
                                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                                    <td className="py-4 font-medium">{p.rep}</td>
                                    <td className="py-4 text-gray-400">{p.deal}</td>
                                    <td className="py-4 font-bold">{p.value}</td>
                                    <td className="py-4 shadow-sm">
                                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase tracking-wider">
                                            {p.status}
                                        </span>
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
