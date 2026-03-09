"use client";

import { useState } from "react";
import { SlidersHorizontal, RefreshCw, Save, Loader2, TrendingUp, DollarSign, Clock, Zap } from "lucide-react";

interface ROIData {
    operationalSavingsEstimate: number;
    revenueIncreaseEstimate: number;
    monthlyHoursRecovered: number;
    estimatedPaybackMonths: number;
    confidenceLevel: string;
    savingsRange?: string;
    revenueRange?: string;
    hoursRange?: string;
    manualOverride?: boolean;
    avgHourlyCost?: number;
    avgTicket?: number;
    conversionRate?: number;
}

function formatBRL(n: number) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency", currency: "BRL", maximumFractionDigits: 0,
    }).format(n);
}

export function ROISimulator({
    assessmentId,
    initialROI,
    apiBasePath = "/api/admin/leads",
}: {
    assessmentId: string;
    initialROI: ROIData;
    apiBasePath?: string;
}) {
    const [roi, setROI] = useState<ROIData>(initialROI);
    const [avgHourlyCost, setAvgHourlyCost] = useState(initialROI.avgHourlyCost ?? 80);
    const [avgTicket, setAvgTicket] = useState(initialROI.avgTicket ?? 2000);
    const [conversionRate, setConvRate] = useState(initialROI.conversionRate ?? 5);
    const [isLoading, setIsLoading] = useState(false);
    const [saved, setSaved] = useState(false);

    const recalculate = async (save = false) => {
        setIsLoading(true);
        try {
            const res = await fetch(`${apiBasePath}/${assessmentId}/roi`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ avgHourlyCost, avgTicket, conversionRate }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setROI(data.roi);
            if (save) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const total = roi.operationalSavingsEstimate + roi.revenueIncreaseEstimate;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                    <SlidersHorizontal className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                    <h3 className="font-bold text-lg">Simulador de Impacto</h3>
                    <p className="text-sm text-muted-foreground">Ajuste os parâmetros para personalizar a projeção</p>
                </div>
                {roi.manualOverride && (
                    <span className="ml-auto text-xs text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2 py-1 rounded-full font-medium">
                        Ajustada
                    </span>
                )}
            </div>

            {/* Sliders */}
            <div className="glass-panel rounded-xl border border-border/50 p-6 space-y-5">
                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Parâmetros do Negócio</h4>

                {/* Custo hora */}
                <div>
                    <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium">Custo médio por hora da equipe</label>
                        <span className="text-sm font-bold text-primary">{formatBRL(avgHourlyCost)}/h</span>
                    </div>
                    <input
                        type="range" min={30} max={300} step={5}
                        value={avgHourlyCost}
                        onChange={e => setAvgHourlyCost(Number(e.target.value))}
                        className="w-full accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>R$ 30/h</span><span>R$ 300/h</span>
                    </div>
                </div>

                {/* Ticket médio */}
                <div>
                    <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium">Ticket médio por cliente</label>
                        <span className="text-sm font-bold text-primary">{formatBRL(avgTicket)}</span>
                    </div>
                    <input
                        type="range" min={200} max={50000} step={100}
                        value={avgTicket}
                        onChange={e => setAvgTicket(Number(e.target.value))}
                        className="w-full accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>R$ 200</span><span>R$ 50.000</span>
                    </div>
                </div>

                {/* Taxa Conversão */}
                <div>
                    <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium">Taxa de conversão estimada</label>
                        <span className="text-sm font-bold text-primary">{conversionRate}%</span>
                    </div>
                    <input
                        type="range" min={1} max={30} step={0.5}
                        value={conversionRate}
                        onChange={e => setConvRate(Number(e.target.value))}
                        className="w-full accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>1%</span><span>30%</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <button
                        onClick={() => recalculate(false)}
                        disabled={isLoading}
                        className="flex-1 btn-secondary flex items-center justify-center gap-2 text-sm"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Recalcular
                    </button>
                    <button
                        onClick={() => recalculate(true)}
                        disabled={isLoading}
                        className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm"
                    >
                        {saved ? "✓ Salvo!" : <><Save className="w-4 h-4" /> Salvar Versão</>}
                    </button>
                </div>
            </div>

            {/* Results */}
            <div className="grid grid-cols-2 gap-4">
                {[
                    {
                        icon: <DollarSign className="w-4 h-4 text-green-500" />,
                        label: "Economia Operacional",
                        value: formatBRL(roi.operationalSavingsEstimate),
                        bg: "from-green-500/10 to-transparent"
                    },
                    {
                        icon: <TrendingUp className="w-4 h-4 text-blue-400" />,
                        label: "Receita Incremental",
                        value: formatBRL(roi.revenueIncreaseEstimate),
                        bg: "from-blue-400/10 to-transparent"
                    },
                    {
                        icon: <Clock className="w-4 h-4 text-purple-400" />,
                        label: "Horas Recuperadas",
                        value: `${Math.round(roi.monthlyHoursRecovered)}h/mês`,
                        bg: "from-purple-400/10 to-transparent"
                    },
                    {
                        icon: <Zap className="w-4 h-4 text-yellow-500" />,
                        label: "Payback",
                        value: `${roi.estimatedPaybackMonths} meses`,
                        bg: "from-yellow-500/10 to-transparent"
                    },
                ].map(m => (
                    <div key={m.label} className={`glass-panel rounded-xl border border-border/50 p-4 bg-gradient-to-br ${m.bg}`}>
                        <div className="flex items-center gap-2 mb-2">
                            {m.icon}
                            <span className="text-xs text-muted-foreground">{m.label}</span>
                        </div>
                        <p className="text-xl font-black">{m.value}</p>
                    </div>
                ))}
            </div>

            <div className="text-center py-3 glass-panel rounded-xl border border-primary/20 bg-primary/5">
                <p className="text-xs text-muted-foreground">Benefício total mensal estimado</p>
                <p className="text-2xl font-black text-primary">{formatBRL(total)}</p>
            </div>
        </div>
    );
}
