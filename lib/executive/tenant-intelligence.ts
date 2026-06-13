import { prisma } from "@/lib/prisma";
import { computeRevenueOpportunities, type RevenueOpportunityResult } from "@/lib/analytics/revenue-brain";
import { scanRevenueLeaks, type LeakItem, type LeakResult } from "@/lib/analytics/leak-detector";
import { generateDailyActions, type ActionItem, type ActionResult } from "@/lib/analytics/action-engine";
import { computeOrgKPIs, type PerformanceMetrics } from "@/lib/performance/stats-engine";
import { buildTenantRevenueSignals, type TenantRevenueSignals } from "@/lib/commercial/revenue-engine";
import { loadExecutivePulseActionStates, type ExecutivePulseActionStatus, type ExecutivePulseLinkedEntityType } from "@/lib/executive/pulse-actions";
import { parseWorkspaceMetadata } from "../operator/crm-workspace";

type ExecutiveAlertSeverity = "critical" | "high" | "warning" | "info";
type ExecutiveTone = "neutral" | "positive" | "warning" | "critical";
type ExecutiveTrendDirection = "up" | "down" | "flat";
export type ExecutivePulseCategory =
    | "revenue_risk"
    | "stalled_deal"
    | "accelerating_loss"
    | "recovery"
    | "growth_above_average";
export type ExecutivePulseCta =
    | "investigate"
    | "demand_action"
    | "track_recovery"
    | "review_pipeline";

const EXECUTIVE_PULSE_CATEGORY_LABELS: Record<ExecutivePulseCategory, string> = {
    revenue_risk: "Risco de receita",
    stalled_deal: "Negocio travado",
    accelerating_loss: "Perda em aceleracao",
    recovery: "Retomada em curso",
    growth_above_average: "Crescimento acima da media",
};

const EXECUTIVE_PULSE_CTA_LABELS: Record<ExecutivePulseCta, string> = {
    investigate: "Triar risco",
    demand_action: "Cobrar execucao",
    track_recovery: "Acompanhar retomada",
    review_pipeline: "Rever carteira",
};

const EXECUTIVE_PULSE_CATEGORY_PRIORITY: Record<ExecutivePulseCategory, number> = {
    accelerating_loss: 5,
    revenue_risk: 4,
    stalled_deal: 4,
    recovery: 3,
    growth_above_average: 2,
};

export interface ExecutivePeriodSummary {
    revenueClosedCents: number;
    proposalsSent: number;
    acceptedProposals: number;
    meetingsBooked: number;
    completedMeetings: number;
    activities: number;
    criticalAlerts: number;
}

type PeriodSummary = ExecutivePeriodSummary;

export interface ExecutiveAlertItem {
    id: string;
    type: string;
    severity: ExecutiveAlertSeverity;
    message: string;
    createdAt: string;
}

export interface ExecutiveHeadlineMetric {
    id: string;
    label: string;
    value: string;
    tone: ExecutiveTone;
    detail: string;
}

export interface ExecutiveSummaryCard {
    id: string;
    title: string;
    value: string;
    detail: string;
    tone: ExecutiveTone;
}

export interface ExecutivePeriodComparisonItem {
    id: string;
    label: string;
    current: string;
    previous: string;
    delta: string;
    direction: ExecutiveTrendDirection;
    tone: ExecutiveTone;
    insight: string;
    hasBaseline: boolean;
}

export interface ExecutivePeriodComparison {
    currentLabel: string;
    previousLabel: string;
    items: ExecutivePeriodComparisonItem[];
}

export interface ExecutiveTimeSeriesPoint {
    id: string;
    label: string;
    shortLabel: string;
    revenueClosedCents: number;
    proposalsSent: number;
    acceptedProposals: number;
    activities: number;
    criticalAlerts: number;
}

export interface ExecutiveRecentSeries {
    label: string;
    insight: string;
    hasData: boolean;
    points: ExecutiveTimeSeriesPoint[];
}

export interface ExecutiveRevenueSignal {
    id: string;
    label: string;
    value: string;
    detail: string;
    tone: ExecutiveTone;
}

export interface ExecutiveWarRoomSnapshot {
    estimatedOpenRevenue: string;
    estimatedRevenueAtRisk: string;
    riskShare: string;
    momentumDirection: string;
    stagnantStage: string;
    topRiskStage: string;
    topRiskOwner: string;
    primaryFocus: string;
}

export interface ExecutiveImmediateFocusItem {
    id: string;
    label: string;
    count: number;
    value?: string;
    detail: string;
    suggestedAction: string;
    tone: ExecutiveTone;
}

export interface ExecutiveRevenueIntelligence {
    tone: ExecutiveTone;
    outlook: string;
    pipelineDirection: string;
    riskNarrative: string;
    focus: string;
    warRoomSnapshot: ExecutiveWarRoomSnapshot;
    immediateFocus: ExecutiveImmediateFocusItem[];
    signals: ExecutiveRevenueSignal[];
}

export interface ExecutiveGrowthOpportunity {
    company: string;
    estimatedValue: string;
    probability: number;
    recommendedAction: string;
}

export interface ExecutiveExpansionSignal {
    id: string;
    label: string;
    detail: string;
    tone: ExecutiveTone;
}

export interface ExecutiveGrowthExpansion {
    topUpsideOpportunities: ExecutiveGrowthOpportunity[];
    expansionSignals: ExecutiveExpansionSignal[];
    primaryGrowthFront: string;
    mainBottleneck: string;
    executiveAction: string;
}

export interface ExecutivePriorityAlert {
    id: string;
    pulseKey: string;
    title: string;
    severity: ExecutiveAlertSeverity;
    source: "system_event" | "profit_leak" | "action";
    impact: string;
    message: string;
    createdAt: string | null;
    whyNow: string;
    recommendedFocus: string;
    status: ExecutivePulseActionStatus;
    lastActionAt: string | null;
    lastActionBy: string | null;
    linkedEntityType: ExecutivePulseLinkedEntityType | null;
    linkedEntityId: string | null;
    category: ExecutivePulseCategory;
    categoryLabel: string;
    cta: ExecutivePulseCta;
    ctaLabel: string;
}

export interface ExecutiveDecisionNarrative {
    tone: ExecutiveTone;
    summary: string;
    stateOfPlay: string;
    biggestRisk: string;
    biggestOpportunity: string;
    focusNow: string[];
}
 
export interface ExecutiveLossItem {
    id: string;
    company: string;
    reason: string;
    stage: string;
    impactValue: string;
    isRecoverable: boolean;
    recoverySignal: string;
    suggestedAction: string;
}
 
export interface ExecutiveLossRecovery {
    totalLosses: number;
    recoverableLossesValue: string;
    dominantReason: string;
    topLossStage: string;
    items: ExecutiveLossItem[];
    tone: ExecutiveTone;
}

export interface ExecutiveDashboardModel {
    org: {
        id: string;
        slug: string;
        name: string;
        plan: string;
    };
    generatedAt: string;
    hasData: boolean;
    emptyReason: string | null;
    overview: {
        headline: string;
        subheadline: string;
    };
    headlineMetrics: ExecutiveHeadlineMetric[];
    summaryCards: ExecutiveSummaryCard[];
    recentSeries: ExecutiveRecentSeries;
    trendComparison: ExecutivePeriodComparison;
    revenueIntelligence: ExecutiveRevenueIntelligence;
    revenueSignals: TenantRevenueSignals;
    periodComparison: ExecutivePeriodComparison;
    prioritizedAlerts: ExecutivePriorityAlert[];
    decisionNarrative: ExecutiveDecisionNarrative;
    growthExpansion: ExecutiveGrowthExpansion;
    revenueBrain: RevenueOpportunityResult;
    leakDetector: LeakResult;
    actionEngine: ActionResult;
    kpis: PerformanceMetrics;
    pipeline: {
        openDeals: number;
        activeProposals: number;
        acceptedProposals: number;
        recentActivities: number;
    };
    operations: {
        pendingActions: number;
        openProfitLeaks: number;
        avgReplyTimeMinutes: number;
    };
    lossRecovery: ExecutiveLossRecovery;
    alerts: ExecutiveAlertItem[];
    warnings: string[];
}

function formatCurrencyFromCents(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
    }).format((value || 0) / 100);
}

function formatPercent(value: number): string {
    return `${value.toFixed(1)}%`;
}

function formatRatio(value: number): string {
    if (!Number.isFinite(value)) {
        return "n/a";
    }

    return `${value.toFixed(1).replace(".", ",")}x`;
}

function formatMinutes(value: number): string {
    if (value < 60) return `${value} min`;
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
}

function formatSignedNumber(value: number): string {
    if (value === 0) return "0";
    return `${value > 0 ? "+" : ""}${value}`;
}

function formatSignedCurrency(value: number): string {
    const formatted = formatCurrencyFromCents(Math.abs(value));
    if (value === 0) return formatted;
    return `${value > 0 ? "+" : "-"}${formatted}`;
}

function formatSignedPercentPoints(value: number): string {
    if (value === 0) return "0,0 pp";
    return `${value > 0 ? "+" : ""}${value.toFixed(1).replace(".", ",")} pp`;
}

function formatShortDate(value: Date): string {
    return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
    }).format(value).replace(".", "");
}

function formatSeriesLabel(start: Date, end: Date): string {
    const inclusiveEnd = new Date(end.getTime() - 1);
    return `${formatShortDate(start)}-${formatShortDate(inclusiveEnd)}`;
}

function normalizeAlertText(value: string): string {
    return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function hasAnyKeyword(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
}

function canonicalPulseTopic(input: {
    source: ExecutivePriorityAlert["source"];
    severity: ExecutiveAlertSeverity;
    title: string;
    message: string;
    impact: string;
}): string {
    const text = normalizeAlertText([input.title, input.message, input.impact].join(" "));

    if (hasAnyKeyword(text, ["recover", "recovery", "recuper", "reativ", "reativacao", "reativacao", "retom", "retomada", "win back", "reengaj", "resgate", "voltar a responder"])) {
        return "recovery";
    }

    if (hasAnyKeyword(text, ["growth", "upside", "expansion", "expand", "escala", "upsell", "cross sell", "cross-sell", "hot", "quente", "crescimento"])) {
        return "growth";
    }

    if (input.source === "profit_leak" || hasAnyKeyword(text, ["vazamento", "perda", "loss", "leak", "desperdicio", "desperdício", "sangr", "fuga", "burn"])) {
        return "loss-pressure";
    }

    if (hasAnyKeyword(text, [
        "proposal stale",
        "stale",
        "stalled",
        "travado",
        "parado",
        "sem resposta",
        "sem retorno",
        "without response",
        "no response",
        "follow-up",
        "followup",
        "aguardando retorno",
        "viewed",
        "visualizado",
    ])) {
        return "stalled-deal";
    }

    if (hasAnyKeyword(text, ["momentum", "pipeline", "risk", "risco", "pressure", "pressao", "pressão", "alert", "open revenue"])) {
        return "revenue-risk";
    }

    return normalizeAlertText(input.title) || "generic";
}

function pulseCategoryLabel(category: ExecutivePulseCategory): string {
    return EXECUTIVE_PULSE_CATEGORY_LABELS[category];
}

function pulseCtaLabel(cta: ExecutivePulseCta): string {
    return EXECUTIVE_PULSE_CTA_LABELS[cta];
}

function inferPulseCategory(input: {
    source: ExecutivePriorityAlert["source"];
    severity: ExecutiveAlertSeverity;
    title: string;
    message: string;
    impact: string;
}): ExecutivePulseCategory {
    const text = normalizeAlertText([input.title, input.message, input.impact].join(" "));

    if (hasAnyKeyword(text, ["recover", "recovery", "recuper", "reativ", "reativacao", "retom", "retomada", "win back", "reengaj", "resgate", "voltar a responder"])) {
        return "recovery";
    }

    if (hasAnyKeyword(text, ["growth", "upside", "expansion", "expand", "escala", "upsell", "cross sell", "cross-sell", "hot", "quente", "crescimento"])) {
        return "growth_above_average";
    }

    if (input.source === "profit_leak" || hasAnyKeyword(text, ["vazamento", "perda", "loss", "leak", "desperdicio", "desperdício", "sangr", "fuga", "burn"])) {
        return input.severity === "critical" || input.source === "profit_leak"
            ? "accelerating_loss"
            : "revenue_risk";
    }

    if (hasAnyKeyword(text, [
        "proposal stale",
        "stale",
        "stalled",
        "travado",
        "parado",
        "sem resposta",
        "sem retorno",
        "without response",
        "no response",
        "follow-up",
        "followup",
        "aguardando retorno",
        "viewed",
        "visualizado",
    ])) {
        return "stalled_deal";
    }

    if (hasAnyKeyword(text, ["momentum", "pipeline", "risk", "risco", "pressure", "pressao", "pressão", "alert", "open revenue"])) {
        return "revenue_risk";
    }

    return "revenue_risk";
}

function inferPulseCta(category: ExecutivePulseCategory): ExecutivePulseCta {
    switch (category) {
        case "recovery":
            return "track_recovery";
        case "growth_above_average":
            return "review_pipeline";
        case "stalled_deal":
            return "demand_action";
        case "accelerating_loss":
            return "investigate";
        default:
            return "investigate";
    }
}

function buildPriorityWhyNow(category: ExecutivePulseCategory, severity: ExecutiveAlertSeverity, impact: string): string {
    switch (category) {
        case "accelerating_loss":
            return `A perda esta acelerando e ja pressiona ${impact.toLowerCase()}.`;
        case "stalled_deal":
            return severity === "critical"
                ? "O negocio travou em estado critico e pode esfriar rapidamente."
                : "O negocio travou ou ficou sem resposta recente e precisa de cobranca curta.";
        case "recovery":
            return "Ha sinal concreto de retomada e vale acompanhar de perto.";
        case "growth_above_average":
            return "Existe upside acima da media com potencial real de expansao no curto prazo.";
        default:
            return severity === "critical"
                ? "Sinal critico recente com impacto direto na fila executiva."
                : "Sinal relevante que entrou recentemente na fila executiva.";
    }
}

function buildPriorityRecommendedFocus(category: ExecutivePulseCategory): string {
    switch (category) {
        case "accelerating_loss":
            return "Cobrar execucao e conter a perda antes de ampliar nova frente.";
        case "stalled_deal":
            return "Cobrar dono e prazo curto para destravar o negocio.";
        case "recovery":
            return "Acompanhar retomada com follow-up e validacao de timing.";
        case "growth_above_average":
            return "Rever carteira e priorizar o upside com maior probabilidade.";
        default:
            return "Triar a origem do risco e remover a friccao mais perto do fechamento.";
    }
}

function normalizeSeverity(value: string): ExecutiveAlertSeverity {
    const normalized = value.toLowerCase();
    if (normalized === "critical" || normalized === "high" || normalized === "warning") {
        return normalized;
    }
    if (normalized === "error") {
        return "critical";
    }
    return "info";
}

function safeMessage(value: string | null | undefined, fallback: string): string {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function severityWeight(severity: ExecutiveAlertSeverity): number {
    switch (severity) {
        case "critical":
            return 4;
        case "high":
            return 3;
        case "warning":
            return 2;
        default:
            return 1;
    }
}

function toneFromDirection(direction: ExecutiveTrendDirection, inverse = false): ExecutiveTone {
    if (direction === "flat") {
        return "neutral";
    }

    if (inverse) {
        return direction === "down" ? "positive" : "critical";
    }

    return direction === "up" ? "positive" : "warning";
}

function resolveDirection(current: number, previous: number): ExecutiveTrendDirection {
    if (current === previous) {
        return "flat";
    }

    return current > previous ? "up" : "down";
}

function compareMetric(input: {
    id: string;
    label: string;
    currentValue: number;
    previousValue: number;
    currentFormatted: string;
    previousFormatted: string;
    deltaFormatted: string;
    inverse?: boolean;
    insightWhenMissing: string;
    insightTemplate: (direction: ExecutiveTrendDirection) => string;
}): ExecutivePeriodComparisonItem {
    const hasBaseline = input.currentValue > 0 || input.previousValue > 0;
    const direction = hasBaseline
        ? resolveDirection(input.currentValue, input.previousValue)
        : "flat";

    return {
        id: input.id,
        label: input.label,
        current: input.currentFormatted,
        previous: hasBaseline ? input.previousFormatted : "Sem base",
        delta: hasBaseline ? input.deltaFormatted : "Sem comparativo",
        direction,
        tone: hasBaseline ? toneFromDirection(direction, input.inverse) : "neutral",
        insight: hasBaseline ? input.insightTemplate(direction) : input.insightWhenMissing,
        hasBaseline,
    };
}

function calculateAcceptanceRate(summary: PeriodSummary): number {
    if (summary.proposalsSent <= 0) {
        return 0;
    }

    return (summary.acceptedProposals / summary.proposalsSent) * 100;
}

function sumPeriodSummaries(summaries: PeriodSummary[]): PeriodSummary {
    return summaries.reduce<PeriodSummary>((accumulator, summary) => ({
        revenueClosedCents: accumulator.revenueClosedCents + summary.revenueClosedCents,
        proposalsSent: accumulator.proposalsSent + summary.proposalsSent,
        acceptedProposals: accumulator.acceptedProposals + summary.acceptedProposals,
        meetingsBooked: accumulator.meetingsBooked + summary.meetingsBooked,
        completedMeetings: accumulator.completedMeetings + summary.completedMeetings,
        activities: accumulator.activities + summary.activities,
        criticalAlerts: accumulator.criticalAlerts + summary.criticalAlerts,
    }), {
        revenueClosedCents: 0,
        proposalsSent: 0,
        acceptedProposals: 0,
        meetingsBooked: 0,
        completedMeetings: 0,
        activities: 0,
        criticalAlerts: 0,
    });
}

function buildPeriodComparison(input: {
    current: PeriodSummary;
    previous: PeriodSummary;
}): ExecutivePeriodComparison {
    const currentAcceptanceRate = input.current.proposalsSent > 0
        ? (input.current.acceptedProposals / input.current.proposalsSent) * 100
        : 0;
    const previousAcceptanceRate = input.previous.proposalsSent > 0
        ? (input.previous.acceptedProposals / input.previous.proposalsSent) * 100
        : 0;

    const currentShowRate = input.current.meetingsBooked > 0
        ? (input.current.completedMeetings / input.current.meetingsBooked) * 100
        : 0;
    const previousShowRate = input.previous.meetingsBooked > 0
        ? (input.previous.completedMeetings / input.previous.meetingsBooked) * 100
        : 0;

    return {
        currentLabel: "Ultimos 30 dias",
        previousLabel: "30 dias anteriores",
        items: [
            compareMetric({
                id: "revenue-closed",
                label: "Receita fechada",
                currentValue: input.current.revenueClosedCents,
                previousValue: input.previous.revenueClosedCents,
                currentFormatted: formatCurrencyFromCents(input.current.revenueClosedCents),
                previousFormatted: formatCurrencyFromCents(input.previous.revenueClosedCents),
                deltaFormatted: formatSignedCurrency(input.current.revenueClosedCents - input.previous.revenueClosedCents),
                insightWhenMissing: "Ainda nao ha base suficiente para comparar receita fechada entre periodos.",
                insightTemplate: (direction) => direction === "up"
                    ? "A receita fechada acelerou versus o periodo anterior."
                    : direction === "down"
                        ? "A receita fechada desacelerou e merece revisao executiva."
                        : "A receita fechada ficou estavel entre os periodos.",
            }),
            compareMetric({
                id: "proposal-conversion",
                label: "Conversao de propostas",
                currentValue: currentAcceptanceRate,
                previousValue: previousAcceptanceRate,
                currentFormatted: formatPercent(currentAcceptanceRate),
                previousFormatted: formatPercent(previousAcceptanceRate),
                deltaFormatted: formatSignedPercentPoints(currentAcceptanceRate - previousAcceptanceRate),
                insightWhenMissing: "Ainda nao ha volume suficiente para comparar conversao de propostas.",
                insightTemplate: (direction) => direction === "up"
                    ? "A taxa de conversao de propostas melhorou no periodo mais recente."
                    : direction === "down"
                        ? "A conversao caiu e sugere friccao no fechamento."
                        : "A conversao de propostas permaneceu estavel.",
            }),
            compareMetric({
                id: "show-rate",
                label: "Show rate",
                currentValue: currentShowRate,
                previousValue: previousShowRate,
                currentFormatted: formatPercent(currentShowRate),
                previousFormatted: formatPercent(previousShowRate),
                deltaFormatted: formatSignedPercentPoints(currentShowRate - previousShowRate),
                insightWhenMissing: "Ainda nao ha reunioes suficientes para comparar show rate.",
                insightTemplate: (direction) => direction === "up"
                    ? "O comparecimento as reunioes melhorou no periodo mais recente."
                    : direction === "down"
                        ? "O show rate piorou e pode estar alimentando perda de receita."
                        : "O show rate permaneceu no mesmo patamar.",
            }),
            compareMetric({
                id: "activities",
                label: "Atividades operacionais",
                currentValue: input.current.activities,
                previousValue: input.previous.activities,
                currentFormatted: String(input.current.activities),
                previousFormatted: String(input.previous.activities),
                deltaFormatted: formatSignedNumber(input.current.activities - input.previous.activities),
                insightWhenMissing: "Ainda nao ha trilha operacional suficiente para comparar atividade.",
                insightTemplate: (direction) => direction === "up"
                    ? "A cadencia operacional aumentou versus o periodo anterior."
                    : direction === "down"
                        ? "A operacao perdeu ritmo e pode exigir intervencao."
                        : "O volume operacional ficou estavel.",
            }),
            compareMetric({
                id: "critical-alerts",
                label: "Alertas criticos",
                currentValue: input.current.criticalAlerts,
                previousValue: input.previous.criticalAlerts,
                currentFormatted: String(input.current.criticalAlerts),
                previousFormatted: String(input.previous.criticalAlerts),
                deltaFormatted: formatSignedNumber(input.current.criticalAlerts - input.previous.criticalAlerts),
                inverse: true,
                insightWhenMissing: "Sem base historica suficiente para comparar sinais de risco critico.",
                insightTemplate: (direction) => direction === "down"
                    ? "A pressao de risco reduziu versus o periodo anterior."
                    : direction === "up"
                        ? "Os sinais criticos aumentaram e pedem triagem executiva."
                        : "O volume de alertas criticos ficou estavel.",
            }),
        ],
    };
}

export function buildTrendComparison(input: {
    current: PeriodSummary;
    previous: PeriodSummary;
    currentLabel?: string;
    previousLabel?: string;
}): ExecutivePeriodComparison {
    const currentAcceptanceRate = calculateAcceptanceRate(input.current);
    const previousAcceptanceRate = calculateAcceptanceRate(input.previous);

    return {
        currentLabel: input.currentLabel ?? "Ultimos 14 dias",
        previousLabel: input.previousLabel ?? "14 dias anteriores",
        items: [
            compareMetric({
                id: "revenue-velocity",
                label: "Receita fechada",
                currentValue: input.current.revenueClosedCents,
                previousValue: input.previous.revenueClosedCents,
                currentFormatted: formatCurrencyFromCents(input.current.revenueClosedCents),
                previousFormatted: formatCurrencyFromCents(input.previous.revenueClosedCents),
                deltaFormatted: formatSignedCurrency(input.current.revenueClosedCents - input.previous.revenueClosedCents),
                insightWhenMissing: "Ainda nao ha massa recente suficiente para ler velocidade de receita.",
                insightTemplate: (direction) => direction === "up"
                    ? "A receita recente ganhou tracao na janela curta."
                    : direction === "down"
                        ? "A receita recente perdeu tracao e amplia o risco de curto prazo."
                        : "A receita recente permaneceu no mesmo patamar.",
            }),
            compareMetric({
                id: "pipeline-direction",
                label: "Entrada de propostas",
                currentValue: input.current.proposalsSent,
                previousValue: input.previous.proposalsSent,
                currentFormatted: String(input.current.proposalsSent),
                previousFormatted: String(input.previous.proposalsSent),
                deltaFormatted: formatSignedNumber(input.current.proposalsSent - input.previous.proposalsSent),
                insightWhenMissing: "Ainda nao ha volume suficiente para ler direcao recente do pipeline.",
                insightTemplate: (direction) => direction === "up"
                    ? "O pipeline recente recebeu mais propostas e sugere aceleracao comercial."
                    : direction === "down"
                        ? "A entrada de propostas desacelerou e pode pressionar a receita futura."
                        : "A entrada de propostas permaneceu estavel no curto prazo.",
            }),
            compareMetric({
                id: "conversion-trend",
                label: "Conversao recente",
                currentValue: currentAcceptanceRate,
                previousValue: previousAcceptanceRate,
                currentFormatted: formatPercent(currentAcceptanceRate),
                previousFormatted: formatPercent(previousAcceptanceRate),
                deltaFormatted: formatSignedPercentPoints(currentAcceptanceRate - previousAcceptanceRate),
                insightWhenMissing: "Ainda nao ha base suficiente para ler a conversao recente.",
                insightTemplate: (direction) => direction === "up"
                    ? "A conversao recente melhorou e reforca a qualidade do pipeline."
                    : direction === "down"
                        ? "A conversao recente caiu e enfraquece a projecao de fechamento."
                        : "A conversao recente permaneceu estavel.",
            }),
            compareMetric({
                id: "risk-pressure",
                label: "Pressao de alertas",
                currentValue: input.current.criticalAlerts,
                previousValue: input.previous.criticalAlerts,
                currentFormatted: String(input.current.criticalAlerts),
                previousFormatted: String(input.previous.criticalAlerts),
                deltaFormatted: formatSignedNumber(input.current.criticalAlerts - input.previous.criticalAlerts),
                inverse: true,
                insightWhenMissing: "Ainda nao ha historico recente para ler pressao de risco.",
                insightTemplate: (direction) => direction === "down"
                    ? "A pressao de risco reduziu na janela recente."
                    : direction === "up"
                        ? "Os alertas cresceram e tornam o curto prazo mais fragil."
                        : "A pressao de risco permaneceu estavel no curto prazo.",
            }),
        ],
    };
}

export function buildRecentSeries(input: Array<{
    id: string;
    label: string;
    shortLabel: string;
    summary: PeriodSummary;
}>): ExecutiveRecentSeries {
    const points = input.map((item) => ({
        id: item.id,
        label: item.label,
        shortLabel: item.shortLabel,
        revenueClosedCents: item.summary.revenueClosedCents,
        proposalsSent: item.summary.proposalsSent,
        acceptedProposals: item.summary.acceptedProposals,
        activities: item.summary.activities,
        criticalAlerts: item.summary.criticalAlerts,
    }));

    const hasData = points.some((point) =>
        point.revenueClosedCents > 0
        || point.proposalsSent > 0
        || point.acceptedProposals > 0
        || point.activities > 0
        || point.criticalAlerts > 0,
    );

    if (!hasData) {
        return {
            label: "Ultimas 4 semanas",
            insight: "Ainda nao ha historico suficiente para montar uma serie executiva confiavel.",
            hasData: false,
            points,
        };
    }

    const half = Math.max(1, Math.floor(points.length / 2));
    const early = sumPeriodSummaries(input.slice(0, half).map((item) => item.summary));
    const late = sumPeriodSummaries(input.slice(half).map((item) => item.summary));

    const revenueDirection = resolveDirection(late.revenueClosedCents, early.revenueClosedCents);
    const pipelineDirection = resolveDirection(late.proposalsSent, early.proposalsSent);
    const riskDirection = resolveDirection(late.criticalAlerts, early.criticalAlerts);

    const insight = revenueDirection === "up" && pipelineDirection !== "down" && riskDirection !== "up"
        ? "A serie curta sugere aceleracao recente com risco sob controle."
        : revenueDirection === "down" || pipelineDirection === "down"
            ? "A serie curta sugere perda de ritmo recente e pede leitura executiva mais proxima."
            : riskDirection === "up"
                ? "A serie curta preserva tracao, mas com aumento de pressao em alertas."
                : "A serie curta mostra estabilidade, sem ruptura clara de tendencia.";

    return {
        label: "Ultimas 4 semanas",
        insight,
        hasData: true,
        points,
    };
}

export function buildPrioritizedAlerts(input: {
    systemAlerts: ExecutiveAlertItem[];
    leakItems: LeakItem[];
    actions: ActionItem[];
    revenueSignals?: TenantRevenueSignals;
}): ExecutivePriorityAlert[] {
    const buildScoredAlert = (inputAlert: {
        id: string;
        title: string;
        severity: ExecutiveAlertSeverity;
        source: ExecutivePriorityAlert["source"];
        impact: string;
        message: string;
        createdAt: string | null;
        scoreHint: number;
        linkedEntityType?: ExecutivePulseLinkedEntityType | null;
        linkedEntityId?: string | null;
    }) => {
        const category = inferPulseCategory(inputAlert);
        const cta = inferPulseCta(category);
        const pulseKey = `${category}::${canonicalPulseTopic(inputAlert)}`;

        return {
            ...inputAlert,
            pulseKey,
            category,
            categoryLabel: pulseCategoryLabel(category),
            cta,
            ctaLabel: pulseCtaLabel(cta),
            score:
                EXECUTIVE_PULSE_CATEGORY_PRIORITY[category] * 1000
                + severityWeight(inputAlert.severity) * 100
                + inputAlert.scoreHint,
        };
    };

    const candidates = [
        ...input.systemAlerts.map((alert) => buildScoredAlert({
            id: `event-${alert.id}`,
            title: alert.type.replaceAll("_", " "),
            severity: alert.severity,
            source: "system_event",
            impact: alert.severity === "critical" ? "Risco imediato" : "Sinal operacional",
            message: alert.message,
            createdAt: alert.createdAt,
            scoreHint: alert.severity === "critical" ? 60 : 0,
        })),
        ...input.leakItems.map((leak, index) => {
            let severity: ExecutiveAlertSeverity = "warning";
            if (leak.potentialLoss >= 1_000_000) {
                severity = "critical";
            } else if (leak.potentialLoss >= 500_000) {
                severity = "high";
            }

            return buildScoredAlert({
                id: `leak-${index}`,
                title: leak.label,
                severity,
                source: "profit_leak",
                impact: leak.value,
                message: leak.description,
                createdAt: null,
                scoreHint: Math.round(leak.potentialLoss / 10_000),
            });
        }),
        ...input.actions.map((action, index) => {
            const severity: ExecutiveAlertSeverity = action.priority === "high"
                ? "high"
                : action.priority === "medium"
                    ? "warning"
                    : "info";

            return buildScoredAlert({
                id: `action-${index}`,
                title: action.label,
                severity,
                source: "action",
                impact: action.impact,
                message: action.description,
                createdAt: null,
                scoreHint: Math.round((action.impactValue ?? 0) / 10_000),
            });
        }),
        ...(input.revenueSignals?.topAtRiskOpportunities ?? []).map((item, index) => {
            const severity: ExecutiveAlertSeverity = item.riskScore >= 10
                ? "critical"
                : item.riskScore >= 7
                    ? "high"
                    : "warning";

            return buildScoredAlert({
                id: `revenue-${index}-${item.assessmentId}`,
                title: item.company,
                severity,
                source: "action",
                impact: formatCurrencyFromCents(item.estimatedValueCents),
                message: item.reason,
                createdAt: item.lastTouchAt,
                scoreHint: Math.round(item.estimatedValueCents / 10_000),
                linkedEntityType: item.dealId ? "deal" : null,
                linkedEntityId: item.dealId ?? null,
            });
        }),
    ];

    const deduped = new Map<string, ReturnType<typeof buildScoredAlert>>();
    candidates.forEach((alert) => {
        const key = alert.pulseKey;
        const existing = deduped.get(key);

        if (!existing || alert.score > existing.score) {
            deduped.set(key, alert);
        }
    });

    return Array.from(deduped.values())
        .sort((left, right) => {
            if (right.score !== left.score) {
                return right.score - left.score;
            }

            const leftDate = left.createdAt ? new Date(left.createdAt).getTime() : 0;
            const rightDate = right.createdAt ? new Date(right.createdAt).getTime() : 0;
            return rightDate - leftDate;
        })
        .slice(0, 5)
        .map((alert) => ({
            id: alert.id,
            pulseKey: alert.pulseKey,
            title: alert.title,
            severity: alert.severity,
            source: alert.source,
            impact: alert.impact,
            message: alert.message,
            createdAt: alert.createdAt,
            whyNow: buildPriorityWhyNow(alert.category, alert.severity, alert.impact),
            recommendedFocus: buildPriorityRecommendedFocus(alert.category),
            status: "open",
            lastActionAt: null,
            lastActionBy: null,
            linkedEntityType: alert.linkedEntityType ?? null,
            linkedEntityId: alert.linkedEntityId ?? null,
            category: alert.category,
            categoryLabel: alert.categoryLabel,
            cta: alert.cta,
            ctaLabel: alert.ctaLabel,
        }));
}

export function buildExecutiveNarrative(input: {
    orgName: string;
    hasData: boolean;
    comparison: ExecutivePeriodComparison;
    revenueIntelligence: ExecutiveRevenueIntelligence;
    revenueSignals: TenantRevenueSignals;
    prioritizedAlerts: ExecutivePriorityAlert[];
    revenueBrain: RevenueOpportunityResult;
    leakDetector: LeakResult;
    actionEngine: ActionResult;
    pipeline: ExecutiveDashboardModel["pipeline"];
}): ExecutiveDecisionNarrative {
    if (!input.hasData) {
        return {
            tone: "neutral",
            summary: `A superficie executiva de ${input.orgName} ja esta conectada, mas ainda sem massa operacional suficiente para uma leitura comparativa confiavel.`,
            stateOfPlay: "Sem base historica consistente para narrativa executiva nesta fase.",
            biggestRisk: "O principal risco atual e tomar decisao com volume insuficiente de dados.",
            biggestOpportunity: "Consolidar mais atividade no tenant para habilitar comparativos executivos reais.",
            focusNow: [
                "Aumentar o volume operacional do tenant",
                "Gerar mais historico de propostas e atividades",
                "Voltar ao cockpit operacional para capturar tracao real",
            ],
        };
    }

    const worseningCount = input.comparison.items.filter((item) => item.tone === "critical" || item.tone === "warning").length;
    const improvingCount = input.comparison.items.filter((item) => item.tone === "positive").length;
    const topAlert = input.prioritizedAlerts[0];
    const topOpportunity = input.revenueBrain.highProbabilityDeals[0];
    const biggestLeak = input.leakDetector.leakItems[0];
    const topRevenueRisk = input.revenueSignals.topAtRiskOpportunities[0];

    const tone: ExecutiveTone = topAlert?.severity === "critical"
        ? "critical"
        : worseningCount > improvingCount
            ? "warning"
            : improvingCount > worseningCount
                ? "positive"
                : "neutral";

    const summary = topAlert?.severity === "critical"
        ? `${input.orgName} exige atencao executiva imediata: ${topAlert.title.toLowerCase()} lidera a fila de risco.`
        : topOpportunity
            ? `${input.orgName} tem oportunidade concreta de acelerar receita agora, com ${input.revenueBrain.highProbabilityDeals.length} deals quentes no radar.`
            : input.revenueIntelligence.outlook;

    const stateOfPlay = `Nos ultimos 30 dias, o tenant fechou ${input.pipeline.acceptedProposals} propostas, manteve ${input.pipeline.openDeals} deals abertos e gerou ${input.pipeline.recentActivities} atividades relevantes.`;
    const biggestRisk = topAlert
        ? `${topAlert.title}: ${topAlert.message}`
        : topRevenueRisk
            ? `${topRevenueRisk.company}: ${topRevenueRisk.reason}`
        : biggestLeak
            ? `${biggestLeak.label}: ${biggestLeak.description}`
            : input.revenueIntelligence.riskNarrative;
    const biggestOpportunity = topOpportunity
        ? `${topOpportunity.email} concentra ${formatCurrencyFromCents(Math.round(topOpportunity.value))} em oportunidade de curto prazo.`
        : topRevenueRisk
            ? `${topRevenueRisk.company} ainda preserva ${formatCurrencyFromCents(topRevenueRisk.estimatedValueCents)} se houver intervencao operacional agora.`
        : input.actionEngine.actions[0]
            ? `${input.actionEngine.actions[0].label}: ${input.actionEngine.actions[0].impact}.`
            : input.revenueIntelligence.focus;

    const focusNow = [
        topAlert?.title ?? "Revisar a fila priorizada de alertas executivos",
        input.actionEngine.actions[0]?.label ?? "Ativar uma prioridade operacional com dono claro",
        topOpportunity
            ? `Destravar follow-up de ${topOpportunity.email}`
            : topRevenueRisk
                ? `${topRevenueRisk.company}: ${topRevenueRisk.recommendedAction}`
            : input.revenueIntelligence.focus,
    ].filter((item, index, array) => array.indexOf(item) === index);

    return {
        tone,
        summary,
        stateOfPlay,
        biggestRisk,
        biggestOpportunity,
        focusNow,
    };
}

export function buildRevenueIntelligence(input: {
    recent: PeriodSummary;
    previous: PeriodSummary;
    revenueBrain: RevenueOpportunityResult;
    leakDetector: LeakResult;
    kpis: PerformanceMetrics;
    pipeline: ExecutiveDashboardModel["pipeline"];
    revenueSignals: TenantRevenueSignals;
}): ExecutiveRevenueIntelligence {
    const recentAcceptance = calculateAcceptanceRate(input.recent);
    const previousAcceptance = calculateAcceptanceRate(input.previous);
    const revenueDeltaCents = input.recent.revenueClosedCents - input.previous.revenueClosedCents;
    const proposalDelta = input.recent.proposalsSent - input.previous.proposalsSent;
    const criticalDelta = input.recent.criticalAlerts - input.previous.criticalAlerts;
    const acceptanceDelta = recentAcceptance - previousAcceptance;
    const coverageRatio = input.leakDetector.totalLeakValue > 0
        ? input.revenueBrain.totalOpportunity / input.leakDetector.totalLeakValue
        : Number.POSITIVE_INFINITY;
    const estimatedRevenueAtRiskCents = Math.max(
        input.revenueSignals.estimatedRevenueAtRiskCents,
        input.leakDetector.totalLeakValue + Math.max(0, -revenueDeltaCents),
    );

    const negativeSignals = [
        revenueDeltaCents < 0,
        proposalDelta < 0,
        acceptanceDelta < -5,
        criticalDelta > 0,
    ].filter(Boolean).length;
    const positiveSignals = [
        revenueDeltaCents > 0,
        proposalDelta > 0,
        acceptanceDelta > 5,
        criticalDelta < 0,
    ].filter(Boolean).length;

    const tone: ExecutiveTone = input.revenueSignals.summary.tone === "critical"
        ? "critical"
        : input.revenueSignals.summary.tone === "warning"
            ? "warning"
            : !Number.isFinite(coverageRatio)
        ? positiveSignals >= 2
            ? "positive"
            : negativeSignals >= 2
                ? "warning"
                : "neutral"
        : coverageRatio < 0.8 || negativeSignals >= 3
            ? "critical"
            : coverageRatio < 1.15 || negativeSignals > positiveSignals
                ? "warning"
                : positiveSignals >= 2
                    ? "positive"
                    : "neutral";

    const hasHistoricalBase = input.recent.revenueClosedCents > 0
        || input.previous.revenueClosedCents > 0
        || input.recent.proposalsSent > 0
        || input.previous.proposalsSent > 0;

    const outlook = !hasHistoricalBase && input.revenueBrain.totalOpportunity === 0 && input.leakDetector.totalLeakValue === 0
        ? "Ainda nao ha historico suficiente para uma leitura forte de revenue intelligence."
        : tone === "critical"
            ? "A pressao de receita ja supera a tracao recente e exige intervencao executiva agora."
            : tone === "warning"
                ? "A leitura de receita segue fragil: existe tracao, mas o curto prazo perdeu consistencia."
                : tone === "positive"
                    ? "A leitura de receita mostra tracao recente com cobertura suficiente sobre o risco aberto."
                    : "A leitura de receita esta equilibrada, mas ainda sem uma assimetria forte de alta.";

    const pipelineDirection = `${input.revenueSignals.momentum.label}. ${input.revenueSignals.momentum.detail}`;

    const riskNarrative = estimatedRevenueAtRiskCents > 0
        ? `${formatCurrencyFromCents(estimatedRevenueAtRiskCents)} ja aparece sob pressao entre vazamentos, deals sem avanço e inacao conversacional.`
        : "Ainda nao ha pressao material de receita aberta no curto prazo.";

    const focus = input.revenueSignals.summary.focus || (input.revenueBrain.highProbabilityDeals.length > 0
        ? `Concentrar a lideranca nos ${input.revenueBrain.highProbabilityDeals.length} deals quentes antes de abrir nova frente.`
        : input.leakDetector.leakItems[0]
            ? `Fechar o vazamento em ${input.leakDetector.leakItems[0].label.toLowerCase()} antes de ampliar volume.`
            : "Aumentar o volume de pipeline com disciplina de follow-up para fortalecer a leitura executiva.");

    const riskShare = input.revenueSignals.estimatedOpenRevenueCents > 0
        ? input.revenueSignals.estimatedRevenueAtRiskCents / input.revenueSignals.estimatedOpenRevenueCents
        : 0;

    const warRoomSnapshot: ExecutiveWarRoomSnapshot = {
        estimatedOpenRevenue: formatCurrencyFromCents(input.revenueSignals.estimatedOpenRevenueCents),
        estimatedRevenueAtRisk: formatCurrencyFromCents(estimatedRevenueAtRiskCents),
        riskShare: Number.isFinite(riskShare) ? `${(riskShare * 100).toFixed(1).replace('.', ',')}%` : "n/a",
        momentumDirection: input.revenueSignals.momentum.label,
        stagnantStage: input.revenueSignals.mostStagnantStage?.stageLabel ?? "Sem concentracao",
        topRiskStage: input.revenueSignals.riskByStage?.[0]?.stageLabel ?? "Sem concentracao",
        topRiskOwner: input.revenueSignals.riskByOwner?.[0]?.ownerLabel ?? "Sem responsavel",
        primaryFocus: focus,
    };

    const immediateFocus: ExecutiveImmediateFocusItem[] = [
        {
            id: "proposals-without-response",
            label: "Propostas sem resposta",
            count: input.revenueSignals.proposalsWithoutResponse.count,
            value: "",
            detail: `Threshold: ${input.revenueSignals.proposalsWithoutResponse.thresholdDays} dias`,
            suggestedAction: "Reengajar propostas sem resposta com sequencia de follow-up imediata.",
            tone: (input.revenueSignals.proposalsWithoutResponse.count > 0 ? "warning" : "positive") as ExecutiveTone,
        },
        {
            id: "stalled-proposals",
            label: "Propostas travadas",
            count: input.revenueSignals.stalledProposals.count,
            value: formatCurrencyFromCents(input.revenueSignals.stalledProposals.valueCents),
            detail: `Estagnacao em ${input.revenueSignals.stalledProposals.thresholdDays} dias`,
            suggestedAction: "Priorizar validacao de proposta e definicao de proximo passo com cliente.",
            tone: (input.revenueSignals.stalledProposals.count > 0 ? "critical" : "positive") as ExecutiveTone,
        },
        {
            id: "inactive-deals",
            label: "Deals sem avanço",
            count: input.revenueSignals.inactiveDeals.count,
            value: formatCurrencyFromCents(input.revenueSignals.inactiveDeals.valueCents),
            detail: `Inativo por ${input.revenueSignals.inactiveDeals.thresholdDays} dias ou mais`,
            suggestedAction: "Revisar deals sem proximo passo e atribuir responsavel para reativacao.",
            tone: (input.revenueSignals.inactiveDeals.count > 0 ? "warning" : "positive") as ExecutiveTone,
        },
        {
            id: "quiet-critical-conversations",
            label: "Conversas criticas sem toque",
            count: input.revenueSignals.quietCriticalConversations.count,
            value: "",
            detail: `Janelas acima de ${input.revenueSignals.quietCriticalConversations.thresholdHours}h`,
            suggestedAction: "Engajar os contatos e reduzir SLA de resposta em conversas criticas.",
            tone: (input.revenueSignals.quietCriticalConversations.count > 0 ? "warning" : "positive") as ExecutiveTone,
        },
    ].filter((item) => item.count > 0);

    return {
        tone,
        outlook,
        pipelineDirection,
        riskNarrative,
        focus,
        warRoomSnapshot,
        immediateFocus,
        signals: [
            {
                id: "revenue-delta",
                label: "Delta de receita",
                value: formatSignedCurrency(revenueDeltaCents),
                detail: "Ultimos 14 dias versus 14 dias anteriores.",
                tone: toneFromDirection(resolveDirection(input.recent.revenueClosedCents, input.previous.revenueClosedCents)),
            },
            {
                id: "coverage",
                label: "Cobertura sobre risco",
                value: Number.isFinite(coverageRatio) ? formatRatio(coverageRatio) : "Sem leak aberto",
                detail: "Oportunidade quente dividida pela perda estimada aberta.",
                tone: Number.isFinite(coverageRatio)
                    ? coverageRatio >= 1.15
                        ? "positive"
                        : coverageRatio >= 0.8
                            ? "warning"
                            : "critical"
                    : input.revenueBrain.totalOpportunity > 0
                        ? "positive"
                        : "neutral",
            },
            {
                id: "open-revenue",
                label: "Receita em aberto",
                value: formatCurrencyFromCents(input.revenueSignals.estimatedOpenRevenueCents),
                detail: `${input.pipeline.openDeals} deals abertos e ${input.pipeline.activeProposals} propostas ativas no radar canonico.`,
                tone: input.revenueSignals.estimatedOpenRevenueCents > 0 ? "neutral" : "warning",
            },
            {
                id: "revenue-at-risk",
                label: "Receita em risco",
                value: formatCurrencyFromCents(estimatedRevenueAtRiskCents),
                detail: `${input.revenueSignals.stalledProposals.count} propostas paradas e ${input.revenueSignals.inactiveDeals.count} deals sem avanço.`,
                tone: estimatedRevenueAtRiskCents === 0
                    ? "positive"
                    : estimatedRevenueAtRiskCents <= Math.max(input.revenueBrain.totalOpportunity, 1)
                        ? "warning"
                        : "critical",
            },
            {
                id: "stagnant-stage",
                label: "Stage mais travado",
                value: input.revenueSignals.mostStagnantStage?.stageLabel ?? "Sem concentracao",
                detail: input.revenueSignals.mostStagnantStage
                    ? `${input.revenueSignals.mostStagnantStage.stalledCount} oportunidades somando ${formatCurrencyFromCents(input.revenueSignals.mostStagnantStage.estimatedValueCents)}.`
                    : hasHistoricalBase
                        ? `${formatSignedPercentPoints(acceptanceDelta)} versus a janela anterior na conversao recente.`
                        : "Sem concentracao de estagnacao material no momento.",
                tone: input.revenueSignals.mostStagnantStage ? "warning" : toneFromDirection(resolveDirection(recentAcceptance, previousAcceptance)),
            },
        ],
    };
}

export function buildExecutiveGrowthExpansion(input: {
    revenueBrain: RevenueOpportunityResult;
    revenueSignals: TenantRevenueSignals;
    leakDetector: LeakResult;
    actionEngine: ActionResult;
    pipeline: ExecutiveDashboardModel["pipeline"];
    kpis: PerformanceMetrics;
}): ExecutiveGrowthExpansion {
    const topDeals = input.revenueBrain.highProbabilityDeals.slice(0, 3);

    const topUpsideOpportunities = topDeals.length > 0
        ? topDeals.map((deal) => ({
            company: deal.email || "deal sem empresa",
            estimatedValue: formatCurrencyFromCents(Math.round(deal.value)),
            probability: deal.probability,
            recommendedAction: "Priorizar fechamento com time senior e sincronizacao de executivo.",
        }))
        : [{
            company: "Nenhuma oportunidade de upside mapeada",
            estimatedValue: "R$ 0",
            probability: 0,
            recommendedAction: "Aumentar cobertura do pipeline e gerar oportunidades quentes.",
        }];

    const expansionSignals: ExecutiveExpansionSignal[] = [
        {
            id: "momentum",
            label: input.revenueSignals.momentum.label,
            detail: input.revenueSignals.momentum.detail,
            tone: input.revenueSignals.momentum.tone,
        },
        {
            id: "stagnant-stage",
            label: "Stage de maior estagnacao",
            detail: input.revenueSignals.mostStagnantStage
                ? `${input.revenueSignals.mostStagnantStage.stageLabel} com ${input.revenueSignals.mostStagnantStage.stalledCount} oportunidades e ${formatCurrencyFromCents(input.revenueSignals.mostStagnantStage.estimatedValueCents)}.`
                : "Sem estagnacao de stage critica detectada.",
            tone: input.revenueSignals.mostStagnantStage ? "warning" : "neutral",
        },
        {
            id: "recovery-signals",
            label: "Recuperacao e Upside",
            detail: input.leakDetector.leakItems.length > 0
                ? `Detectado ${input.leakDetector.leakItems.length} vazamento(s) que podem ser convertidos em receita: ${formatCurrencyFromCents(input.leakDetector.totalLeakValue)}.`
                : "Sem vazamentos de receita identificados.",
            tone: input.leakDetector.leakItems.length > 0 ? "warning" : "positive",
        },
    ];

    const primaryGrowthFront = topDeals.length > 0
        ? `Upside concentrado em ${topDeals.length} deals quentes` 
        : "Aprimorar pipeline para gerar oportunidades de expansion.";

    const mainBottleneck = input.revenueSignals.mostStagnantStage
        ? `Gargalo: stage ${input.revenueSignals.mostStagnantStage.stageLabel}`
        : input.leakDetector.leakItems[0]
            ? `Gargalo: ${input.leakDetector.leakItems[0].label}`
            : "Gargalo ainda nao detectado; requer investigacao operacional.";

    const executiveAction = topDeals.length > 0
        ? `Estabelecer comite de fechamento para ${topDeals[0].email || "deal chave"}.`
        : "Atuar na aceleracao de propostas e conversas para gerar tracao de growth.";

    return {
        topUpsideOpportunities,
        expansionSignals,
        primaryGrowthFront,
        mainBottleneck,
        executiveAction,
    };
}

function buildPeriodRangeSummary(orgId: string, start: Date, end: Date): Promise<PeriodSummary> {
    return Promise.all([
        prisma.meetingPerformance.aggregate({
            where: {
                organizationId: orgId,
                outcome: "won",
                session: {
                    startAt: {
                        gte: start,
                        lt: end,
                    },
                },
            },
            _sum: {
                closedValue: true,
            },
        }),
        prisma.proposal.count({
            where: {
                organizationId: orgId,
                createdAt: {
                    gte: start,
                    lt: end,
                },
            },
        }),
        prisma.proposal.count({
            where: {
                organizationId: orgId,
                createdAt: {
                    gte: start,
                    lt: end,
                },
                status: "accepted",
            },
        }),
        prisma.meetingSession.count({
            where: {
                organizationId: orgId,
                startAt: {
                    gte: start,
                    lt: end,
                },
            },
        }),
        prisma.meetingSession.count({
            where: {
                organizationId: orgId,
                startAt: {
                    gte: start,
                    lt: end,
                },
                status: "completed",
            },
        }),
        prisma.activity.count({
            where: {
                organizationId: orgId,
                createdAt: {
                    gte: start,
                    lt: end,
                },
            },
        }),
        prisma.systemEvent.count({
            where: {
                organizationId: orgId,
                createdAt: {
                    gte: start,
                    lt: end,
                },
                severity: {
                    in: ["critical", "high", "error"],
                },
            },
        }),
    ]).then(([closedRevenue, proposalsSent, acceptedProposals, meetingsBooked, completedMeetings, activities, criticalAlerts]) => ({
        revenueClosedCents: Math.round(closedRevenue._sum.closedValue ?? 0),
        proposalsSent,
        acceptedProposals,
        meetingsBooked,
        completedMeetings,
        activities,
        criticalAlerts,
    }));
}

function buildRecentSeriesRanges(now: Date, windowDays: number, periods: number) {
    const ranges: Array<{
        id: string;
        start: Date;
        end: Date;
        label: string;
        shortLabel: string;
    }> = [];

    for (let index = periods - 1; index >= 0; index -= 1) {
        const end = new Date(now.getTime() - index * windowDays * 24 * 60 * 60 * 1000);
        const start = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000);
        ranges.push({
            id: `window-${periods - index}`,
            start,
            end,
            label: formatSeriesLabel(start, end),
            shortLabel: `S${periods - index}`,
        });
    }

    return ranges;
}

function buildExecutiveLossRecovery(lostAssessments: any[]): ExecutiveLossRecovery {
    const totalLosses = lostAssessments.length;

    const reasonCounts: Record<string, number> = {};
    const stageCounts: Record<string, number> = {};

    lostAssessments.forEach((a) => {
        const meta = parseWorkspaceMetadata(a.internalNotes);
        const reason = meta.lostReason || "desconhecido";
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;

        const stage = a.status || "Sem estágio";
        stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    });

    let dominantReason = "-";
    let maxReasonCount = 0;
    for (const [reason, count] of Object.entries(reasonCounts)) {
        if (count > maxReasonCount) {
            maxReasonCount = count;
            dominantReason = reason;
        }
    }

    let topLossStage = "-";
    let maxStageCount = 0;
    for (const [stage, count] of Object.entries(stageCounts)) {
        if (count > maxStageCount) {
            maxStageCount = count;
            topLossStage = stage;
        }
    }

    const items: ExecutiveLossItem[] = lostAssessments.slice(0, 5).map((a) => {
        const meta = parseWorkspaceMetadata(a.internalNotes);
        const isRecoverable = meta.lostReason === "no-response" || meta.lostReason === "timing" || !meta.lostReason;

        return {
            id: a.id,
            company: a.company || "Lead sem empresa",
            reason: meta.lostReason || "Não informado",
            stage: a.status,
            impactValue: "Sob análise",
            isRecoverable,
            recoverySignal: isRecoverable ? "Sinal de silêncio ou timing" : "Perda definitiva",
            suggestedAction: isRecoverable
                ? "Reativar com nova proposta ou follow-up de valor."
                : "Revisar motivo para ajuste de playbook.",
        };
    });

    return {
        totalLosses,
        recoverableLossesValue: totalLosses > 0 ? "Leitura em curso" : "Sem perdas recentes",
        dominantReason: dominantReason.toUpperCase(),
        topLossStage: topLossStage.toUpperCase(),
        items,
        tone: totalLosses > 5 ? "warning" : "neutral",
    };
}

export async function buildTenantExecutiveDashboard(orgSlug: string): Promise<ExecutiveDashboardModel | null> {
    const org = await prisma.organization.findUnique({
        where: { slug: orgSlug },
        select: {
            id: true,
            slug: true,
            name: true,
            plan: true,
        },
    });

    if (!org) {
        return null;
    }

    const now = new Date();
    const currentPeriodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const previousPeriodStart = new Date(currentPeriodStart.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentSeriesRanges = buildRecentSeriesRanges(now, 7, 4);

    const [
        revenueSignals,
        revenueBrain,
        leakDetector,
        actionEngine,
        kpis,
        openDeals,
        activeProposals,
        acceptedProposals,
        recentActivities,
        pendingActions,
        openProfitLeaks,
        alerts,
        currentPeriodSummary,
        previousPeriodSummary,
        lostAssessments,
        ...recentSeriesSummaries
    ] = await Promise.all([
        buildTenantRevenueSignals(org.id),
        computeRevenueOpportunities(org.id),
        scanRevenueLeaks(org.id),
        generateDailyActions(org.id),
        computeOrgKPIs(org.id, "30d"),
        prisma.assessment.count({
            where: { organizationId: org.id, status: { not: "fechado" } }
        }),
        prisma.proposal.count({
            where: { organizationId: org.id, status: "sent" }
        }),
        prisma.proposal.count({
            where: {
                organizationId: org.id,
                status: "accepted",
            },
        }),
        prisma.activity.count({
            where: {
                organizationId: org.id,
                createdAt: {
                    gte: currentPeriodStart,
                },
            },
        }),
        prisma.actionQueue.count({
            where: {
                organizationId: org.id,
                status: "pending",
            },
        }),
        prisma.profitLeak.count({
            where: {
                orgId: org.id,
                status: "open",
            },
        }),
        (prisma as any).systemEvent.findMany({
            where: {
                organizationId: org.id,
                severity: { in: ["warning", "high", "critical", "error"] },
            },
            orderBy: { createdAt: "desc" },
            take: 20,
            select: { id: true, type: true, severity: true, message: true, createdAt: true },
        }),
        buildPeriodRangeSummary(org.id, currentPeriodStart, now),
        buildPeriodRangeSummary(org.id, previousPeriodStart, currentPeriodStart),
        prisma.assessment.findMany({
            where: {
                organizationId: org.id,
                status: { in: ["Perdido", "Lost", "perdido", "lost", "rejeitado", "rejected"] },
                createdAt: { gte: currentPeriodStart },
            },
            orderBy: { createdAt: "desc" },
            take: 15,
            select: {
                id: true,
                company: true,
                status: true,
                internalNotes: true,
                createdAt: true,
            },
        }).catch(() => []),
        ...recentSeriesRanges.map((range) => buildPeriodRangeSummary(org.id, range.start, range.end)),
    ]);

    const normalizedAlerts: ExecutiveAlertItem[] = (recentSeriesSummaries as any).alertItems ? [] : alerts.map((alert: any) => ({
        id: alert.id,
        type: alert.type,
        severity: normalizeSeverity(alert.severity),
        message: safeMessage(alert.message, alert.type.replaceAll("_", " ")),
        createdAt: alert.createdAt.toISOString(),
    }));

    const prioritizedAlerts = buildPrioritizedAlerts({
        systemAlerts: normalizedAlerts,
        leakItems: leakDetector.leakItems,
        actions: actionEngine.actions,
        revenueSignals,
    });
    const pulseActionStates = await loadExecutivePulseActionStates(
        org.id,
        prioritizedAlerts.map((alert) => alert.pulseKey),
    );
    const prioritizedAlertsWithActions = prioritizedAlerts.map((alert) => {
        const actionState = pulseActionStates.get(alert.pulseKey);

        if (!actionState) {
            return alert;
        }

        return {
            ...alert,
            status: actionState.status,
            lastActionAt: actionState.lastActionAt,
            lastActionBy: actionState.lastActionBy,
            linkedEntityType: actionState.linkedEntityType,
            linkedEntityId: actionState.linkedEntityId,
        };
    });

    const warnings: string[] = [];
    if (revenueBrain.highProbabilityDeals.length === 0) {
        warnings.push("Ainda nao ha deals quentes suficientes para destacar oportunidades de fechamento.");
    }
    if (leakDetector.leakItems.length === 0) {
        warnings.push("Nenhum vazamento relevante foi detectado no momento.");
    }
    if (actionEngine.actions.length === 0) {
        warnings.push("O motor de acoes ainda nao encontrou prioridades executivas para hoje.");
    }

    const hasData = openDeals > 0
        || activeProposals > 0
        || acceptedProposals > 0
        || recentActivities > 0
        || revenueBrain.highProbabilityDeals.length > 0
        || leakDetector.leakItems.length > 0
        || actionEngine.actions.length > 0;

    const emptyReason = hasData
        ? null
        : "Os dados executivos ainda sao insuficientes neste tenant. O painel ja esta conectado, mas ainda nao ha volume operacional para leitura executiva confiavel.";

    const periodComparison = buildPeriodComparison({
        current: currentPeriodSummary,
        previous: previousPeriodSummary,
    });

    const recentSeries = buildRecentSeries(recentSeriesRanges.map((range, index) => ({
        id: range.id,
        label: range.label,
        shortLabel: range.shortLabel,
        summary: recentSeriesSummaries[index],
    })));
    const recentTrendCurrentSummary = sumPeriodSummaries(recentSeriesSummaries.slice(2));
    const recentTrendPreviousSummary = sumPeriodSummaries(recentSeriesSummaries.slice(0, 2));
    const trendComparison = buildTrendComparison({
        current: recentTrendCurrentSummary,
        previous: recentTrendPreviousSummary,
    });

    const pipeline = {
        openDeals,
        activeProposals,
        acceptedProposals,
        recentActivities,
    };

    const revenueIntelligence = buildRevenueIntelligence({
        recent: recentTrendCurrentSummary,
        previous: recentTrendPreviousSummary,
        revenueBrain,
        leakDetector,
        kpis,
        pipeline,
        revenueSignals,
    });

    const growthExpansion = buildExecutiveGrowthExpansion({
        revenueBrain,
        revenueSignals,
        leakDetector,
        actionEngine,
        pipeline,
        kpis,
    });

    const decisionNarrative = buildExecutiveNarrative({
        orgName: org.name,
        hasData,
        comparison: periodComparison,
        revenueIntelligence,
        revenueSignals,
        prioritizedAlerts: prioritizedAlertsWithActions,
        revenueBrain,
        leakDetector,
        actionEngine,
        pipeline,
    });

    return {
        org,
        generatedAt: new Date().toISOString(),
        hasData,
        emptyReason,
        overview: {
            headline: hasData
                ? `Leitura executiva de ${org.name} com foco em risco, comparativo e decisao.`
                : `Superficie executiva pronta para ${org.name}, aguardando mais volume operacional real.`,
            subheadline: "Baseado em dados reais de pipeline, propostas, reunioes, activities, action queue e eventos operacionais.",
        },
        headlineMetrics: [
            {
                id: "revenue-opportunity",
                label: "Oportunidade de Receita",
                value: formatCurrencyFromCents(Math.round(revenueBrain.totalOpportunity)),
                tone: revenueBrain.totalOpportunity > 0 ? "positive" : "neutral",
                detail: `${revenueBrain.highProbabilityDeals.length} deals com alta probabilidade`,
            },
            {
                id: "pipeline-open",
                label: "Pipeline Aberto",
                value: String(openDeals),
                tone: openDeals > 0 ? "neutral" : "warning",
                detail: `${activeProposals} propostas ativas no ciclo`,
            },
            {
                id: "conversion",
                label: "Conversao de Propostas",
                value: formatPercent(kpis.proposalAcceptanceRate),
                tone: kpis.proposalAcceptanceRate >= 40 ? "positive" : kpis.proposalAcceptanceRate >= 20 ? "warning" : "critical",
                detail: `${acceptedProposals} propostas aceitas`,
            },
            {
                id: "estimated-leak",
                label: "Perda Estimada",
                value: formatCurrencyFromCents(leakDetector.totalLeakValue),
                tone: leakDetector.totalLeakValue > 0 ? "critical" : "positive",
                detail: `${openProfitLeaks} vazamentos abertos`,
            },
        ],
        summaryCards: [
            {
                id: "show-rate",
                title: "Show Rate",
                value: formatPercent(kpis.meetingShowRate),
                detail: `${kpis.meetingsBooked} reunioes no periodo`,
                tone: kpis.meetingShowRate >= 75 ? "positive" : kpis.meetingShowRate >= 55 ? "warning" : "critical",
            },
            {
                id: "reply-time",
                title: "Tempo Medio de Resposta",
                value: formatMinutes(kpis.avgReplyTimeMinutes),
                detail: "Sinal operacional derivado de conversas reais",
                tone: kpis.avgReplyTimeMinutes <= 30 ? "positive" : kpis.avgReplyTimeMinutes <= 90 ? "warning" : "critical",
            },
            {
                id: "pending-actions",
                title: "Fila Operacional",
                value: String(pendingActions),
                detail: "Itens pendentes na action queue",
                tone: pendingActions <= 5 ? "positive" : pendingActions <= 15 ? "warning" : "critical",
            },
            {
                id: "pipeline-value",
                title: "Valor de Pipeline",
                value: formatCurrencyFromCents(kpis.pipelineCents),
                detail: "Proxy real baseado em propostas abertas",
                tone: kpis.pipelineCents > 0 ? "neutral" : "warning",
            },
        ],
        lossRecovery: buildExecutiveLossRecovery(lostAssessments),
        recentSeries,
        trendComparison,
        revenueIntelligence,
        growthExpansion,
        revenueSignals,
        periodComparison,
        prioritizedAlerts: prioritizedAlertsWithActions,
        decisionNarrative,
        revenueBrain,
        leakDetector,
        actionEngine,
        kpis,
        pipeline,
        operations: {
            pendingActions,
            openProfitLeaks,
            avgReplyTimeMinutes: kpis.avgReplyTimeMinutes,
        },
        alerts: normalizedAlerts,
        warnings,
    };
}
