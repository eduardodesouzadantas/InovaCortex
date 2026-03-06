
"use client";

import React, { useState } from "react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, PieChart, Pie, Cell, LineChart, Line
} from "recharts";
import {
    LayoutDashboard, Trophy, Clock, AlertCircle, Users,
    ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign,
    Zap, Target, MessageSquare, Briefcase, Plus, Search,
    Filter, MoreHorizontal, UserCheck, UserX, Trash2, Edit,
    HelpCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useEffect } from "react";
import { HelpPopover } from "@/components/ui/help-popover";
import { HELP_CONTENT, HelpTopic } from "@/lib/help/help-content";
import { useLearningMode } from "@/lib/help/use-learning-mode";
import { isLearningModeEnabled } from "@/lib/help/learning-mode";
import { GUIDE_IDS } from "@/lib/help/guide-ids";
import { ProductWalkthrough } from "@/components/product-guide/walkthrough";
import { GuideLauncher } from "@/components/product-guide/guide-launcher";

interface Props {
    slug: string;
    initialOverview: any;
    initialLeaderboard: any[];
    initialSnapshots: any[];
    initialTeam: any[];
    initialSla: any[];
}

const TABS = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "leaderboard", label: "Ranking", icon: Trophy },
    { id: "sla", label: "SLA & Fluxo", icon: Clock },
    { id: "leaks", label: "Responsabilidade", icon: AlertCircle },
    { id: "team", label: "Equipe Admin", icon: Users },
];

/**
 * A wrapper around the generic HelpPopover that pulls content from the registry
 */
function RegistryHelpPopover({ topic }: { topic: HelpTopic }) {
    const content = HELP_CONTENT[topic];
    if (!content) return null;
    return <HelpPopover {...content} />;
}

// Walkthrough has been migrated to ProductWalkthrough

export function PerformanceClient({
    slug,
    initialOverview,
    initialLeaderboard,
    initialSnapshots,
    initialTeam,
    initialSla
}: Props) {
    const [activeTab, setActiveTab] = useState("overview");
    const [forceStartGuide, setForceStartGuide] = useState(false);
    const { userSettings, toggleLearningMode } = useLearningMode();

    return (
        <div className="min-h-screen bg-[#050505] text-white p-8">
            <ProductWalkthrough
                guide="performance"
                forceStart={forceStartGuide}
                onClose={() => setForceStartGuide(false)}
            />

            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                    <div className="flex items-center gap-2 text-[#d4af37] mb-2">
                        <Zap className="w-5 h-5 fill-[#d4af37]" />
                        <span className="text-xs font-black uppercase tracking-[0.3em]">Performance Intelligence</span>
                    </div>
                    <h1 className="text-4xl font-black tracking-tight">Mission Control : Team</h1>
                    <p className="text-muted-foreground mt-2">Gestão de accountability e performance em tempo real.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={toggleLearningMode}
                        className={`p-2 border rounded-xl transition-colors flex items-center gap-2 text-xs font-bold ${isLearningModeEnabled(userSettings) ? "bg-[#d4af37]/20 border-[#d4af37]/50 text-[#d4af37]" : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"}`}
                    >
                        Learning Mode {isLearningModeEnabled(userSettings) ? "ON" : "OFF"}
                    </button>
                    <GuideLauncher guideKey="performance" onStartGuide={() => setForceStartGuide(true)} />
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                        {["7d", "30d", "90d"].map((w) => (
                            <button
                                key={w}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${w === "30d" ? "bg-[#d4af37] text-black" : "hover:bg-white/5 text-muted-foreground"}`}
                            >
                                {w}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {/* Navigation Tabs */}
            <div id="navigation-tabs" className="flex gap-2 p-1 bg-white/5 border border-white/10 rounded-2xl w-fit mb-8">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 ${isActive
                                ? "bg-[#d4af37] text-black shadow-[0_0_20px_rgba(212,175,55,0.3)]"
                                : "text-muted-foreground hover:text-white"
                                }`}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? "" : "opacity-60"}`} />
                            <span className="text-sm font-bold tracking-tight">{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            <main>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-8"
                    >
                        {activeTab === "overview" && (
                            <OverviewTab overview={initialOverview} snapshots={initialSnapshots} />
                        )}
                        {activeTab === "leaderboard" && (
                            <LeaderboardTab leaderboard={initialLeaderboard} />
                        )}
                        {activeTab === "sla" && (
                            <SLATab sla={initialSla} />
                        )}
                        {activeTab === "leaks" && (
                            <LeaksTab overview={initialOverview} leaderboard={initialLeaderboard} />
                        )}
                        {activeTab === "team" && (
                            <TeamAdminTab team={initialTeam} slug={slug} />
                        )}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div >
    );
}

// ─── Tab Components ──────────────────────────────────────────────────────────

function OverviewTab({ overview, snapshots }: { overview: any; snapshots: any[] }) {
    const kpis = [
        { label: "Receita", value: `R$ ${(overview.revenueCents / 100).toLocaleString()}`, icon: DollarSign, trend: "+12%", color: "text-green-400" },
        { label: "Pipeline", value: `R$ ${(overview.pipelineCents / 100).toLocaleString()}`, icon: Briefcase, trend: "+5%", color: "text-blue-400" },
        { label: "Aceitação", value: `${overview.proposalAcceptanceRate.toFixed(1)}%`, icon: Target, trend: "-2%", color: "text-red-400", helpTopic: "proposalAcceptance" as HelpTopic },
        { label: "Tempo de Resposta", value: `${overview.avgReplyTimeMinutes}m`, icon: MessageSquare, trend: "-15m", color: "text-green-400", helpTopic: "replyTime" as HelpTopic },
    ];

    return (
        <div id="metric-cards" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-guide-id={GUIDE_IDS.perf_kpi_strip}>
            {kpis.map((kpi, i) => (
                <Card key={i} className="bg-white/5 border-white/10 backdrop-blur-md overflow-hidden group">
                    <CardContent className="pt-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-2 bg-white/10 rounded-lg group-hover:bg-[#d4af37]/20 transition-colors">
                                <kpi.icon className="w-5 h-5 text-[#d4af37]" />
                            </div>
                            <span className={`text-xs font-bold ${kpi.color} flex items-center gap-1`}>
                                {kpi.trend} <ArrowUpRight className="w-3 h-3" />
                            </span>
                        </div>
                        <div className="text-2xl font-black mb-1">{kpi.value}</div>
                        <div className="flex items-center gap-2">
                            <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider">{kpi.label}</div>
                            {kpi.helpTopic && <RegistryHelpPopover topic={kpi.helpTopic} />}
                        </div>
                    </CardContent>
                </Card>
            ))}

            <Card className="md:col-span-3 bg-white/5 border-white/10 backdrop-blur-md">
                <CardHeader>
                    <CardTitle className="text-lg font-bold">Histórico de Performance</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={snapshots.slice().reverse()}>
                            <defs>
                                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#d4af37" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#d4af37" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                            <XAxis dataKey="createdAt" stroke="#555" tickFormatter={(t) => new Date(t).toLocaleDateString()} />
                            <YAxis stroke="#555" />
                            <Tooltip
                                contentStyle={{ backgroundColor: "#000", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                                itemStyle={{ color: "#d4af37" }}
                            />
                            <Area type="monotone" dataKey="revenueCents" stroke="#d4af37" fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10 backdrop-blur-md">
                <CardHeader>
                    <CardTitle className="text-lg font-bold">Funil de Vendas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <FunnelItem label="Reuniões Agendadas" value={overview.meetingsBooked} total={overview.meetingsBooked} />
                    <FunnelItem label="Show Rate (Completed)" value={`${overview.meetingShowRate.toFixed(1)}%`} total={overview.meetingsBooked} helpTopic="meetingShowRate" />
                    <FunnelItem label="Propostas Enviadas" value={overview.proposalsSent} total={overview.meetingsBooked} />
                    <FunnelItem label="Propostas Aceitas" value={`${overview.proposalAcceptanceRate.toFixed(1)}%`} total={overview.proposalsSent} helpTopic="proposalAcceptance" />
                </CardContent>
            </Card>
        </div>
    );
}

function FunnelItem({ label, value, total, helpTopic }: { label: string; value: string | number; total: number; helpTopic?: HelpTopic }) {
    return (
        <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
                <div className="flex items-center gap-1.5">
                    <span className="font-bold text-muted-foreground uppercase">{label}</span>
                    {helpTopic && <RegistryHelpPopover topic={helpTopic} />}
                </div>
                <span className="font-black text-white">{value}</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    className="h-full bg-gradient-to-r from-[#d4af37] to-[#f9d976]"
                />
            </div>
        </div>
    );
}

function LeaderboardTab({ leaderboard }: { leaderboard: any[] }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" data-guide-id={GUIDE_IDS.perf_leaderboard}>
            <Card className="lg:col-span-2 bg-white/5 border-white/10 backdrop-blur-md">
                <CardHeader>
                    <CardTitle className="text-xl font-black italic">Sales Leaderboard</CardTitle>
                    <CardDescription>Scoring baseado em conversão, receita e SLA.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {leaderboard.map((rep, i) => (
                            <div key={rep.repId} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-[#d4af37]/30 transition-all group">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${i === 0 ? "bg-[#d4af37] text-black" : "bg-white/10 text-muted-foreground"}`}>
                                    #{i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold">{rep.name}</div>
                                    <div className="text-xs text-muted-foreground">{rep.role}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-black text-[#d4af37]">{rep.score} pts</div>
                                    <div className="flex items-center gap-1 justify-end">
                                        <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Total Score</div>
                                        <RegistryHelpPopover topic="salesScore" />
                                    </div>
                                </div>
                                <div className="w-32 hidden md:block">
                                    <Progress value={Math.min(100, rep.score * 10)} className="h-2" />
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-6">
                <Card className="bg-[#d4af37]/10 border-[#d4af37]/20">
                    <CardHeader>
                        <CardTitle className="text-sm font-black uppercase tracking-widest text-[#d4af37]">Top Performer</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{leaderboard[0]?.name || "N/A"}</div>
                        <div className="text-xs text-muted-foreground mb-4">Líder em receita e velocidade.</div>
                        <div className="flex items-center gap-2">
                            <Trophy className="w-8 h-8 text-[#d4af37]" />
                            <div className="text-xl font-black">R$ {(leaderboard[0]?.revenueCents / 100).toLocaleString()}</div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10">
                    <CardHeader>
                        <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Métricas Médias</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <StatRow label="Frequência Mensal" value="23 deals" />
                        <StatRow label="Ticket Médio" value="R$ 15.400" />
                        <StatRow label="Ciclo de Venda" value="14 dias" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function StatRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground font-bold">{label}</span>
            <span className="font-black">{value}</span>
        </div>
    );
}

function SLATab({ sla }: { sla: any[] }) {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-black italic">Active SLA Breaches</h3>
                <Badge variant="destructive" className="px-4 py-1.5 rounded-full font-black">
                    {sla.length} Critical
                </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-guide-id={GUIDE_IDS.perf_sla_panel}>
                {sla.map((item) => (
                    <Card key={item.id} className="bg-red-500/5 border-red-500/20 backdrop-blur-md group hover:bg-red-500/10 transition-colors">
                        <CardContent className="pt-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="font-black text-lg">{item.contactName}</div>
                                    <div className="text-xs text-red-400 font-bold uppercase tracking-widest">Atraso Crítico</div>
                                </div>
                                <div className="p-2 bg-red-500/10 rounded-lg">
                                    <Clock className="w-5 h-5 text-red-500" />
                                </div>
                            </div>

                            <p className="text-sm text-muted-foreground line-clamp-2 mb-6 min-h-[40px]">
                                "{item.preview || "Nenhuma mensagem encontrada..."}"
                            </p>

                            <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Responsável</span>
                                    <span className="text-xs font-bold">{item.assignedTo}</span>
                                </div>
                                <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white font-black rounded-lg">
                                    Resolver
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {sla.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-white/5 border border-dashed border-white/10 rounded-2xl">
                        <UserCheck className="w-12 h-12 text-[#d4af37] opacity-20 mx-auto mb-4" />
                        <p className="text-muted-foreground italic">Todas as conversas estão dentro do SLA de ouro.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function LeaksTab({ overview, leaderboard }: { overview: any; leaderboard: any[] }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="bg-white/5 border-white/10">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xl font-black italic">Vazamentos por Responsável</CardTitle>
                        <RegistryHelpPopover topic="profitLeaks" />
                    </div>
                </CardHeader>
                <CardContent className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={leaderboard} layout="vertical">
                            <XAxis type="number" stroke="#555" hide />
                            <YAxis dataKey="name" type="category" stroke="#fff" fontSize={12} width={100} />
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{ backgroundColor: "#000", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                            />
                            <Bar dataKey="leaksOwnedCents" radius={[0, 10, 10, 0]}>
                                {leaderboard.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.leaksOwnedCents > 500000 ? "#ef4444" : "#f97316"} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <div className="space-y-6">
                <Card className="bg-red-500/10 border-red-500/20">
                    <CardHeader>
                        <CardTitle className="text-lg font-black italic">Total em Risco</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black text-red-500">R$ {(overview.leaksOpenCents / 100).toLocaleString()}</div>
                        <p className="text-sm text-muted-foreground mt-2">Vazamentos ativos identificados pelo Alert Engine.</p>
                    </CardContent>
                </Card>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h4 className="text-sm font-black uppercase tracking-[0.2em] mb-4 text-[#d4af37]">Top Leak Owners</h4>
                    <div className="space-y-4">
                        {leaderboard.filter(r => r.leaksOwnedCents > 0).sort((a, b) => b.leaksOwnedCents - a.leaksOwnedCents).map(r => (
                            <div key={r.repId} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                                <span className="font-bold text-sm">{r.name}</span>
                                <span className="text-sm font-black text-red-400">R$ {(r.leaksOwnedCents / 100).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function TeamAdminTab({ team, slug }: { team: any[]; slug: string }) {
    const [searchTerm, setSearchTerm] = useState("");

    const filtered = team.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Buscar por nome..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-[#d4af37]/50"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Button className="bg-[#d4af37] hover:bg-[#d4af37]/80 text-black font-black rounded-xl flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Novo Vendedor
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((member) => (
                    <Card key={member.id} className="bg-white/5 border-white/10 hover:border-white/20 transition-all overflow-hidden">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center font-black text-lg border border-white/10">
                                    {member.name[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-black truncate">{member.name}</div>
                                    <div className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{member.role}</div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className={`w-2 h-2 rounded-full ${member.active ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-gray-500"}`} />
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground">{member.active ? "Ativo" : "Off"}</span>
                                </div>
                            </div>

                            <div className="space-y-2 mb-6">
                                <TeamInfoRow icon={Clock} label="Resposta Média" value="12m" helpTopic="replyTime" />
                                <TeamInfoRow icon={DollarSign} label="Receita Gerada" value="R$ 45.000" />
                            </div>

                            <div className="flex items-center gap-2 pt-4 border-t border-white/5">
                                <Button variant="ghost" size="sm" className="flex-1 text-xs font-bold hover:bg-white/5">
                                    <Edit className="w-3.5 h-3.5 mr-2" /> Editar
                                </Button>
                                <Button variant="ghost" size="sm" className="flex-1 text-xs font-bold text-red-400 hover:bg-red-400/10 active:bg-red-400/20">
                                    <UserX className="w-3.5 h-3.5 mr-2" /> Desativar
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

function TeamInfoRow({ icon: Icon, label, value, helpTopic }: { icon: any; label: string; value: string; helpTopic?: HelpTopic }) {
    return (
        <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="w-3 h-3" />
                <span className="font-bold">{label}</span>
                {helpTopic && <RegistryHelpPopover topic={helpTopic} />}
            </div>
            <span className="font-black text-white">{value}</span>
        </div>
    );
}

// Custom Progress component to avoid missing shadcn dependency if it's not installed
function Progress({ value, className }: { value: number, className: string }) {
    return (
        <div className={`w-full bg-white/10 rounded-full overflow-hidden ${className}`}>
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${value}%` }}
                className="h-full bg-[#d4af37]"
            />
        </div>
    );
}
