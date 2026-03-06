"use client";

import { useState } from "react";
import { BarChart2, TrendingUp, Target, Zap, Globe, Loader2, AlertTriangle } from "lucide-react";
import { HelpPopover } from "@/components/ui/help-popover";
import { getHelp } from "@/lib/help/use-help";

interface PipelineHealth {
    weightedPipelineValue: number;
    avgProbability: number;
    projectedRevenue30d: number;
    projectedRevenue90d: number;
    pipelineQualityIndex: number;
    totalActiveSessions: number;
    hotCount: number;
    warmCount: number;
    coldCount: number;
    agingProposals: number;
}

interface Props {
    initialHealth: PipelineHealth | null;
    orgSlug: string;
}

function fmt(n: number): string {
    if (n >= 1_000_000) return `R$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `R$${(n / 1_000).toFixed(0)}k`;
    return `R$${Math.round(n)}`;
}

function QualityGauge({ value }: { value: number }) {
    const color = value >= 70 ? "text-green-400" : value >= 40 ? "text-yellow-400" : "text-red-400";
    const bgColor = value >= 70 ? "bg-green-400" : value >= 40 ? "bg-yellow-400" : "bg-red-400";
    const label = value >= 70 ? "Saudável" : value >= 40 ? "Atenção" : "Crítico";
    return (
        <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 flex-shrink-0">
                <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                    <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
                    <circle
                        cx="28" cy="28" r="22" fill="none"
                        stroke={value >= 70 ? "#4ade80" : value >= 40 ? "#facc15" : "#f87171"}
                        strokeWidth="5"
                        strokeDasharray={`${(value / 100) * 138} 138`}
                        strokeLinecap="round"
                    />
                </svg>
                <span className={`absolute inset-0 flex items-center justify-center text-xs font-black ${color}`}>{value}</span>
            </div>
            <div>
                <p className={`font-black text-sm ${color}`}>{label}</p>
                <p className="text-[10px] text-muted-foreground">Pipeline Quality Index</p>
            </div>
        </div>
    );
}

export function PipelineHealthBlock({ initialHealth, orgSlug }: Props) {
    const [health, setHealth] = useState<PipelineHealth | null>(initialHealth);
    const [running, setRunning] = useState(false);
    const [lastRun, setLastRun] = useState<string | null>(null);

    const runBrainCycle = async () => {
        setRunning(true);
        try {
            const res = await fetch("/api/admin/orchestrator/brain-cycle", { method: "POST" });
            const data = await res.json();
            if (data.pipelineHealth) setHealth(data.pipelineHealth);
            setLastRun(`${data.sessionsProcessed} sessões · ${data.actionQueueUpdates} fila atualizada · ${data.escalations} escalonamentos`);
        } finally {
            setRunning(false);
        }
    };

    if (!health) {
        return (
            <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                        <BarChart2 className="w-4 h-4 text-indigo-400" />
                    </div>
                    <h3 className="font-bold text-sm flex items-center gap-1.5">
                        Pipeline Health
                        <HelpPopover {...getHelp("pipeline")} />
                    </h3>
                </div>
                <p className="text-sm text-muted-foreground">Nenhuma sessão ativa. Execute o Brain Cycle.</p>
                <button onClick={runBrainCycle} disabled={running} className="mt-3 text-xs text-indigo-400 hover:underline flex items-center gap-1 disabled:opacity-50">
                    {running ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Rodar Brain Cycle
                </button>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                        <BarChart2 className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm flex items-center gap-1.5">
                            Pipeline Health · V17
                            <HelpPopover {...getHelp("pipeline")} />
                        </h3>
                        <p className="text-xs text-muted-foreground">{health.totalActiveSessions} sessões ativas</p>
                    </div>
                </div>
                <button
                    onClick={runBrainCycle}
                    disabled={running}
                    className="flex items-center gap-1.5 text-xs bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-lg px-3 py-1.5 font-semibold hover:bg-indigo-600/30 transition-colors disabled:opacity-50"
                >
                    {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    Brain Cycle
                </button>
            </div>

            {lastRun && (
                <div className="text-xs bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-lg px-3 py-1.5 mb-4">
                    ✓ {lastRun}
                </div>
            )}

            {/* Quality + Weighted Value */}
            <div className="flex items-center justify-between mb-5">
                <QualityGauge value={health.pipelineQualityIndex} />
                <div className="text-right">
                    <p className="text-2xl font-black text-white">{fmt(health.weightedPipelineValue)}</p>
                    <p className="text-xs text-muted-foreground">Pipeline Ponderado</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">P̄: {Math.round(health.avgProbability * 100)}%</p>
                </div>
            </div>

            {/* Tier breakdown */}
            <div className="flex gap-2 mb-4">
                <div className="flex-1 bg-red-500/10 border border-red-500/15 rounded-xl p-2.5 text-center">
                    <p className="text-base font-black text-red-400">{health.hotCount}</p>
                    <p className="text-[9px] text-muted-foreground">🔥 Hot</p>
                </div>
                <div className="flex-1 bg-yellow-500/10 border border-yellow-500/15 rounded-xl p-2.5 text-center">
                    <p className="text-base font-black text-yellow-400">{health.warmCount}</p>
                    <p className="text-[9px] text-muted-foreground">🌡 Warm</p>
                </div>
                <div className="flex-1 bg-blue-500/10 border border-blue-500/15 rounded-xl p-2.5 text-center">
                    <p className="text-base font-black text-blue-400">{health.coldCount}</p>
                    <p className="text-[9px] text-muted-foreground">❄️ Cold</p>
                </div>
            </div>

            {/* Projected Revenue */}
            <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-emerald-500/8 border border-emerald-500/15 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Target className="w-3 h-3 text-emerald-400" />
                        <p className="text-[10px] text-muted-foreground">Projeção 30d</p>
                    </div>
                    <p className="text-sm font-black text-emerald-400">{fmt(health.projectedRevenue30d)}</p>
                </div>
                <div className="bg-purple-500/8 border border-purple-500/15 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                        <TrendingUp className="w-3 h-3 text-purple-400" />
                        <p className="text-[10px] text-muted-foreground">Projeção 90d</p>
                    </div>
                    <p className="text-sm font-black text-purple-400">{fmt(health.projectedRevenue90d)}</p>
                </div>
            </div>

            {/* Aging warning */}
            {health.agingProposals > 0 && (
                <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-2 text-xs text-orange-300">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{health.agingProposals} proposta{health.agingProposals > 1 ? "s" : ""} sem resposta há +24h</span>
                </div>
            )}
        </div>
    );
}
