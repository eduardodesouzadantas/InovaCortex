"use client";

import { TrendingUp, Users, DollarSign, Eye, CheckCircle2, XCircle, AlertTriangle, Clock } from "lucide-react";
import { HelpPopover } from "@/components/ui/help-popover";
import { getHelp } from "@/lib/help/use-help";

interface MeetingMetrics {
    total: number;
    showed: number;
    showRate: number;
    closeRate: number;
    avgDealSize: number;
    totalRevenue: number;
    wonCount: number;
    lostCount: number;
    noShowCount: number;
    pendingCount: number;
}

interface Props {
    metrics: MeetingMetrics | null;
    orgSlug: string;
}

export function MeetingPerformanceBlock({ metrics, orgSlug }: Props) {
    const helpShowRate = getHelp("meetingShowRate");

    if (!metrics || metrics.total === 0) {
        return (
            <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm flex items-center gap-1">
                            Meeting Show Rate
                            <HelpPopover {...helpShowRate} />
                        </h3>
                        <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
                    </div>
                </div>
                <p className="text-sm text-muted-foreground">Nenhuma reunião nos últimos 30 dias.</p>
                <a href={`/org/${orgSlug}/admin/meetings`} className="mt-3 inline-block text-xs text-purple-400 hover:underline">Ver todas →</a>
            </div>
        );
    }

    const stats = [
        {
            label: "Reuniões",
            value: metrics.total,
            icon: Users,
            color: "text-slate-300",
            bg: "bg-slate-500/10",
        },
        {
            label: "Show Rate",
            value: `${metrics.showRate}%`,
            icon: Eye,
            color: metrics.showRate >= 70 ? "text-green-400" : metrics.showRate >= 50 ? "text-yellow-400" : "text-red-400",
            bg: "bg-purple-500/10",
        },
        {
            label: "Close Rate",
            value: `${metrics.closeRate}%`,
            icon: CheckCircle2,
            color: metrics.closeRate >= 30 ? "text-green-400" : metrics.closeRate >= 15 ? "text-yellow-400" : "text-red-400",
            bg: "bg-green-500/10",
        },
        {
            label: "Ticket Médio",
            value: metrics.avgDealSize > 0 ? `R$${metrics.avgDealSize.toLocaleString("pt-BR")}` : "—",
            icon: DollarSign,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
        },
    ];

    const outcomes = [
        { label: "Ganhos", count: metrics.wonCount, icon: CheckCircle2, color: "text-green-400" },
        { label: "Perdidos", count: metrics.lostCount, icon: XCircle, color: "text-red-400" },
        { label: "No-show", count: metrics.noShowCount, icon: AlertTriangle, color: "text-orange-400" },
        { label: "Pendentes", count: metrics.pendingCount, icon: Clock, color: "text-slate-400" },
    ];

    return (
        <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm flex items-center gap-1">
                            Meeting Show Rate
                            <HelpPopover {...helpShowRate} />
                        </h3>
                        <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
                    </div>
                </div>
                <a
                    href={`/org/${orgSlug}/admin/meetings`}
                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors font-semibold"
                >
                    Ver todas →
                </a>
            </div>

            {/* Key Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                {stats.map(s => (
                    <div key={s.label} className={`${s.bg} rounded-xl p-3 flex items-center gap-3`}>
                        <s.icon className={`w-4 h-4 ${s.color} flex-shrink-0`} />
                        <div>
                            <p className={`text-base font-black ${s.color}`}>{s.value}</p>
                            <p className="text-[10px] text-muted-foreground">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Revenue total */}
            {metrics.totalRevenue > 0 && (
                <div className="bg-emerald-500/8 border border-emerald-500/15 rounded-xl p-3 mb-4 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Receita total (30d)</span>
                    <span className="text-sm font-black text-emerald-400">R${metrics.totalRevenue.toLocaleString("pt-BR")}</span>
                </div>
            )}

            {/* Outcome breakdown */}
            <div className="flex gap-3">
                {outcomes.map(o => (
                    <div key={o.label} className="flex-1 text-center">
                        <o.icon className={`w-4 h-4 ${o.color} mx-auto mb-1`} />
                        <p className={`text-sm font-black ${o.color}`}>{o.count}</p>
                        <p className="text-[10px] text-muted-foreground">{o.label}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
