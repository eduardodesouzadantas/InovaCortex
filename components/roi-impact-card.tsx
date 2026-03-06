/**
 * components/roi-impact-card.tsx
 * Server-safe display card for ROI projections.
 * Used both in /diagnostico/[slug] and /admin/[id]
 */

import { TrendingUp, Clock, DollarSign, Zap, BadgeCheck } from "lucide-react";

interface ROICardProps {
    operationalSavingsEstimate: number;
    revenueIncreaseEstimate: number;
    monthlyHoursRecovered: number;
    estimatedPaybackMonths: number;
    confidenceLevel: string;
    savingsRange: string;
    revenueRange: string;
    hoursRange: string;
    showDisclaimer?: boolean;
}

const CONFIDENCE_COLORS = {
    Alta: "text-green-500 bg-green-500/10 border-green-500/20",
    Média: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
    Baixa: "text-orange-500 bg-orange-500/10 border-orange-500/20",
};

function formatBRL(n: number) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
    }).format(n);
}

function ImpactMetric({
    icon, label, value, sub, color = "primary"
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    sub: string;
    color?: string;
}) {
    return (
        <div className="relative overflow-hidden glass-panel rounded-2xl border border-border/50 p-6 group hover:border-primary/30 transition-colors">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-colors" />
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                        {icon}
                    </div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
                </div>
                <p className="text-3xl font-black text-foreground mb-1">{value}</p>
                <p className="text-sm text-muted-foreground">{sub}</p>
            </div>
        </div>
    );
}

export function ROIImpactCard({
    operationalSavingsEstimate,
    revenueIncreaseEstimate,
    monthlyHoursRecovered,
    estimatedPaybackMonths,
    confidenceLevel,
    savingsRange,
    revenueRange,
    hoursRange,
    showDisclaimer = false,
}: ROICardProps) {
    const total = operationalSavingsEstimate + revenueIncreaseEstimate;
    const confColor = CONFIDENCE_COLORS[confidenceLevel as keyof typeof CONFIDENCE_COLORS] ?? CONFIDENCE_COLORS.Média;
    const maxValue = Math.max(operationalSavingsEstimate, revenueIncreaseEstimate, monthlyHoursRecovered * 100);

    return (
        <div className="space-y-6">
            {/* Section header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">💰 Projeção de Impacto Financeiro</h2>
                        <p className="text-sm text-muted-foreground">Estimativa baseada nos dados fornecidos e modelos InovaCortex</p>
                    </div>
                </div>
                <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${confColor}`}>
                    <BadgeCheck className="w-3.5 h-3.5" />
                    Confiança {confidenceLevel}
                </span>
            </div>

            {/* 4 metric cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <ImpactMetric
                    icon={<DollarSign className="w-4 h-4 text-green-500" />}
                    label="Economia Operacional"
                    value={formatBRL(operationalSavingsEstimate)}
                    sub={`Faixa: ${savingsRange}`}
                />
                <ImpactMetric
                    icon={<TrendingUp className="w-4 h-4 text-blue-400" />}
                    label="Receita Incremental"
                    value={formatBRL(revenueIncreaseEstimate)}
                    sub={`Faixa: ${revenueRange}`}
                />
                <ImpactMetric
                    icon={<Clock className="w-4 h-4 text-purple-400" />}
                    label="Horas Recuperadas"
                    value={`${monthlyHoursRecovered}h`}
                    sub={`Faixa: ${hoursRange}`}
                />
                <ImpactMetric
                    icon={<Zap className="w-4 h-4 text-yellow-500" />}
                    label="Payback Estimado"
                    value={`${estimatedPaybackMonths} meses`}
                    sub={`Benefício total: ${formatBRL(total)}/mês`}
                />
            </div>

            {/* Progress bars */}
            <div className="glass-panel rounded-2xl border border-border/50 p-6 space-y-4">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Distribuição do Impacto</h3>
                {[
                    { label: "Economia Operacional", value: operationalSavingsEstimate, color: "bg-green-500" },
                    { label: "Receita Incremental", value: revenueIncreaseEstimate, color: "bg-blue-400" },
                ].map(bar => (
                    <div key={bar.label}>
                        <div className="flex justify-between text-sm mb-2">
                            <span className="font-medium">{bar.label}</span>
                            <span className="text-muted-foreground">{formatBRL(bar.value)}</span>
                        </div>
                        <div className="w-full bg-muted/40 rounded-full h-2.5">
                            <div
                                className={`h-2.5 rounded-full ${bar.color} transition-all`}
                                style={{ width: `${Math.min(100, (bar.value / total) * 100)}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* Disclaimer */}
            {showDisclaimer && (
                <p className="text-xs text-muted-foreground/70 italic border-t border-border/30 pt-4">
                    * Projeções baseadas em estimativas fornecidas pelo cliente e modelos internos da InovaCortex.
                    Os valores reais dependem de fatores específicos de implementação e mercado.
                </p>
            )}
        </div>
    );
}
