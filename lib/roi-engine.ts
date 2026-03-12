/**
 * lib/roi-engine.ts
 * Deterministic ROI calculator — no LLM, pure math.
 *
 * Converts assessment data into financial impact estimates for the dossier,
 * admin simulator, and PDF appendix.
 *
 * Examples:
 *   Small e-commerce, 50pts score → ~R$12k savings, 40h/month recovered, 3-month payback
 *   Large enterprise, 90pts score → ~R$85k savings, 180h/month recovered, 1.5-month payback
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ROIInput {
    teamSize: string;         // "1-10", "11-50", "51-200", "200+"
    volumeDay?: string;       // customer volume string
    monthlyRevenue?: string;  // revenue band string
    hoursLost?: string;       // hours lost string
    scoreTotal: number;       // 0-100
    classification: string;   // "Alta prioridade" | "Boa oportunidade" | "Exploratória"
    pains: string[];          // ["Atendimento lento", "Sem CRM", ...]
    // Optional overrides (from admin simulator)
    avgHourlyCost?: number;   // BRL/hour, default: 80
    avgTicket?: number;       // BRL, default: 2000
    conversionRate?: number;  // 0-100%, default: 5
}

export interface ROIResult {
    operationalSavingsEstimate: number;   // BRL/month
    revenueIncreaseEstimate: number;      // BRL/month
    monthlyHoursRecovered: number;        // hours/month
    estimatedPaybackMonths: number;       // months until ROI positive
    confidenceLevel: "Baixa" | "Média" | "Alta";
    // Human-readable ranges for display
    savingsRange: string;                 // "R$ 8.000 – R$ 15.000"
    revenueRange: string;                 // "R$ 5.000 – R$ 12.000"
    hoursRange: string;                   // "30 – 50 horas"
}

// ─── Lookup Tables ────────────────────────────────────────────────────────────

/** Estimated number of manual hours wasted per person per month */
const HOURS_PER_PERSON_MONTH: Record<string, number> = {
    "1-10": 40,
    "11-50": 60,
    "51-200": 80,
    "200+": 100,
};

/** Approximate headcount midpoint for calculations */
const TEAM_MIDPOINT: Record<string, number> = {
    "1-10": 5,
    "11-50": 30,
    "51-200": 120,
    "200+": 250,
};

/** Daily volume multiplier on revenue upside */
const VOLUME_REVENUE_FACTOR: Record<string, number> = {
    "< 50": 1.0,
    "50-200": 1.5,
    "200-1000": 2.5,
    "1000+": 4.0,
};

/** Pain areas that add efficiency multiplier */
const PAIN_MULTIPLIERS: Record<string, number> = {
    "Atendimento lento": 1.15,
    "Perda de leads": 1.20,
    "Retrabalho manual": 1.25,
    "Falta de follow-up": 1.10,
    "Sem CRM": 1.15,
    "Relatórios manuais": 1.10,
    "Escalabilidade": 1.20,
    "Equipe sobrecarregada": 1.15,
};

/** Assumed InovaCortex implementation investment (BRL) by classification */
const IMPLEMENTATION_COST: Record<string, number> = {
    "Alta prioridade": 15000,
    "Boa oportunidade": 10000,
    "Exploratória": 6000,
};

// ─── Main Calculator ──────────────────────────────────────────────────────────

export function calculateROI(input: ROIInput): ROIResult {
    const {
        teamSize = "11-50",
        volumeDay = "50 a 200",
        monthlyRevenue = "",
        hoursLost = "",
        scoreTotal = 50,
        classification = "Boa oportunidade",
        pains = [],
        avgHourlyCost = 65,   // BRL/h Conservador
    } = input;

    // 1. Base automation rate (% of work automatable) from score
    const automationRate = Math.min(0.60, (scoreTotal / 100) * 0.75); // Max 60% automation

    // 2. Hours recovered per month
    let hoursPerPersonMonth = HOURS_PER_PERSON_MONTH[teamSize] ?? 60;
    const hl = hoursLost.toLowerCase();
    if (hl.includes("até 2h")) hoursPerPersonMonth = 30;
    else if (hl.includes("3 a 5h")) hoursPerPersonMonth = 80;
    else if (hl.includes("mais de 5h")) hoursPerPersonMonth = 120;

    const teamCount = TEAM_MIDPOINT[teamSize] ?? 12;
    const rawHoursRecovered = hoursPerPersonMonth * teamCount * automationRate;
    const monthlyHoursRecovered = Math.round(rawHoursRecovered);

    // 3. Operational savings
    const painMultiplier = pains.reduce((acc, pain) => {
        return acc * (PAIN_MULTIPLIERS[pain] ?? 1.0);
    }, 1.0);
    // Cap multiplier at 1.5x for safety
    const cappedMultiplier = Math.min(painMultiplier, 1.5);
    const operationalSavingsEstimate = Math.round(
        monthlyHoursRecovered * avgHourlyCost * cappedMultiplier
    );

    // 4. Revenue increase estimate based on reported revenue brackets
    let revEstimate = 50000;
    const revLower = monthlyRevenue.toLowerCase();
    if (revLower.includes("50k a 200k")) revEstimate = 120000;
    else if (revLower.includes("200k a 500k")) revEstimate = 320000;
    else if (revLower.includes("acima") || revLower.includes("+")) revEstimate = 750000;

    // We project a conservative 3-12% revenue bump depending on the automation rate
    const revenueBumpPercent = Math.min(0.15, automationRate * 0.25);
    const revenueIncreaseEstimate = Math.round(revEstimate * revenueBumpPercent);

    // 5. Payback period
    const implementationCost = IMPLEMENTATION_COST[classification] ?? 10000;
    const totalMonthlyBenefit = operationalSavingsEstimate + revenueIncreaseEstimate;
    const estimatedPaybackMonths = totalMonthlyBenefit > 0
        ? Math.round((implementationCost / totalMonthlyBenefit) * 10) / 10
        : 99;

    // 6. Confidence level based on data quality (score + team size)
    let confidenceLevel: "Baixa" | "Média" | "Alta" = "Baixa";
    if (scoreTotal >= 70 && teamCount >= 6) confidenceLevel = "Alta";
    else if (scoreTotal >= 45) confidenceLevel = "Média";

    // 7. Display ranges (±15% band for conservatism)
    const formatBRL = (n: number) =>
        `R$ ${Math.round(n / 1000)}k`;
    const savingsRange = `${formatBRL(operationalSavingsEstimate * 0.85)} – ${formatBRL(operationalSavingsEstimate * 1.15)}`;
    const revenueRange = `${formatBRL(revenueIncreaseEstimate * 0.85)} – ${formatBRL(revenueIncreaseEstimate * 1.15)}`;
    const hoursRange = `${Math.round(monthlyHoursRecovered * 0.85)} – ${Math.round(monthlyHoursRecovered * 1.15)} horas`;

    return {
        operationalSavingsEstimate,
        revenueIncreaseEstimate,
        monthlyHoursRecovered,
        estimatedPaybackMonths,
        confidenceLevel,
        savingsRange,
        revenueRange,
        hoursRange,
    };
}

// ─── Formatting Helpers ───────────────────────────────────────────────────────

export function formatROIForDisplay(roi: ROIResult) {
    const fmt = (n: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);

    return {
        ...roi,
        operationalSavingsFormatted: fmt(roi.operationalSavingsEstimate),
        revenueIncreaseFormatted: fmt(roi.revenueIncreaseEstimate),
        totalMonthlyBenefit: fmt(roi.operationalSavingsEstimate + roi.revenueIncreaseEstimate),
        totalMonthlyBenefitRaw: roi.operationalSavingsEstimate + roi.revenueIncreaseEstimate,
    };
}
