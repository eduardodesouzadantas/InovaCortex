/**
 * lib/authority-templates.ts
 * R4: Pure data module — narrative prompt templates for each authority asset type.
 * No Prisma dependency — safe for unit tests.
 */

export type AuthorityAssetType =
    | "case_study"
    | "linkedin_post"
    | "article"
    | "video_script"
    | "stat_card";

export type AnonLevel = "none" | "sector_only" | "size_only" | "full";

export interface ClientMetrics {
    // Raw numbers from platform
    operationalSavingsPerYear: number;
    revenueIncreasePerYear: number;
    monthlyHoursRecovered: number;
    paybackMonths: number;
    confidenceLevel: string;

    // Context
    moduleCount: number;
    taskCount: number;
    sector: string;
    companyName: string;   // will be anonymized by level
    teamSize: string;   // "15 pessoas", "40 pessoas"
    goLiveDays?: number;   // Days from workspace creation to go-live
}

export interface AnonymizedMetrics extends ClientMetrics {
    displayName: string;     // What to show publicly (anonymized company ref)
    anonLevel: AnonLevel;
}

// ─── Anonymization ────────────────────────────────────────────────────────────

const SECTOR_DESCRIPTORS: Record<string, string[]> = {
    "saúde": ["clínica médica", "consultório especializado", "centro de saúde"],
    "imobiliário": ["imobiliária regional", "incorporadora", "gestora de imóveis"],
    "jurídico": ["escritório de advocacia", "firma jurídica", "banca especializada"],
    "serviços": ["empresa de serviços B2B", "prestadora de serviços"],
    "varejo": ["loja com operação própria", "rede de varejo regional"],
    "educação": ["instituição de ensino", "escola particular"],
    "industria": ["indústria regional", "fabricante de pequeno porte"],
    "distribuição": ["distribuidora regional", "empresa de logística"],
};

export function anonymizeMetrics(
    metrics: ClientMetrics,
    level: AnonLevel = "full",
): AnonymizedMetrics {
    let displayName: string;

    switch (level) {
        case "none":
            displayName = metrics.companyName;
            break;
        case "sector_only": {
            const descriptors = SECTOR_DESCRIPTORS[metrics.sector.toLowerCase()];
            displayName = descriptors ? descriptors[0] : `empresa de ${metrics.sector}`;
            break;
        }
        case "size_only":
            displayName = `empresa com ${metrics.teamSize}`;
            break;
        case "full":
        default: {
            const descriptors = SECTOR_DESCRIPTORS[metrics.sector.toLowerCase()];
            const base = descriptors ? descriptors[0] : `empresa de ${metrics.sector}`;
            displayName = `${base} com ${metrics.teamSize}`;
            break;
        }
    }

    return { ...metrics, displayName, anonLevel: level };
}

// ─── Format Helpers ───────────────────────────────────────────────────────────

export function formatBRL(value: number): string {
    return Math.round(value).toLocaleString("pt-BR");
}

export function formatMetricsSummary(m: AnonymizedMetrics): string {
    const lines = [
        "CLIENTE: " + m.displayName,
        "SETOR: " + m.sector,
        "MODULOS IMPLANTADOS: " + m.moduleCount,
        "ECONOMIA OPERACIONAL: R$" + formatBRL(m.operationalSavingsPerYear) + "/ano",
        "AUMENTO DE RECEITA: R$" + formatBRL(m.revenueIncreasePerYear) + "/ano",
        "HORAS RECUPERADAS: " + m.monthlyHoursRecovered + "h/mes",
        "PAYBACK: " + m.paybackMonths + " meses",
        "NIVEL DE CONFIANCA: " + m.confidenceLevel,
    ];
    if (m.goLiveDays) lines.push("GO-LIVE EM: " + m.goLiveDays + " dias apos contratacao");
    return lines.join("\n");
}

// ─── Narrative Prompt Templates ───────────────────────────────────────────────

const BRAND_CONTEXT = "Voce e o redator de autoridade da InovaCortex, empresa brasileira de automacao e IA para negocios B2B. Tom: consultivo, direto, sem buzzwords (nunca use: revolucionario, incrivel, transformador, disruptivo). Use apenas os dados reais fornecidos. Foque em impacto financeiro mensuravel.";

export const ASSET_PROMPTS: Record<AuthorityAssetType, (m: AnonymizedMetrics) => string> = {

    case_study: (m) =>
        BRAND_CONTEXT + "\n\n" +
        "METRICAS DO CASO:\n" + formatMetricsSummary(m) + "\n\n" +
        "Gere um case study estruturado. Retorne JSON:\n" +
        '{\n' +
        '  "title": "Titulo do case (ex: Como [descricao] reduziu R$X/mes em operacao manual)",\n' +
        '  "headline": "1 frase de impacto com o principal resultado",\n' +
        '  "body": "Texto completo em markdown com: ## Contexto ## Desafio ## Solução Implementada ## Resultados (use os numeros reais) ## Licao",\n' +
        '  "keyMetricsSummary": "3-4 bullets com os numeros mais impactantes"\n' +
        '}',

    linkedin_post: (m) =>
        BRAND_CONTEXT + "\n\n" +
        "METRICAS DO CASO:\n" + formatMetricsSummary(m) + "\n\n" +
        "Gere um post LinkedIn baseado neste caso real. Retorne JSON:\n" +
        '{\n' +
        '  "title": "titulo interno",\n' +
        '  "headline": "primeira linha impactante (max 15 palavras)",\n' +
        '  "body": "post completo 500-900 chars com hook + dado + licao + CTA para diagnostico",\n' +
        '  "hashtags": ["5 a 8 hashtags sem #"]\n' +
        '}',

    article: (m) =>
        BRAND_CONTEXT + "\n\n" +
        "METRICAS DO CASO:\n" + formatMetricsSummary(m) + "\n\n" +
        "Gere um artigo completo (600-900 palavras) para blog/newsletter. Retorne JSON:\n" +
        '{\n' +
        '  "title": "titulo SEO-friendly",\n' +
        '  "headline": "subtitulo / lead sentence",\n' +
        '  "body": "artigo completo em markdown com introducao, desenvolvimento, dados, conclusao e CTA"\n' +
        '}',

    video_script: (m) =>
        BRAND_CONTEXT + "\n\n" +
        "METRICAS DO CASO:\n" + formatMetricsSummary(m) + "\n\n" +
        "Gere um roteiro de video (2-3 min) baseado neste case. Retorne JSON:\n" +
        '{\n' +
        '  "title": "titulo do video",\n' +
        '  "headline": "frase de abertura (primeiros 5 segundos)",\n' +
        '  "body": "roteiro completo com [0:00] timecodes, [FALA], [TEXTO NA TELA] e [B-ROLL]",\n' +
        '  "hashtags": ["5 hashtags para descricao"]\n' +
        '}',

    stat_card: (m) =>
        BRAND_CONTEXT + "\n\n" +
        "METRICAS DO CASO:\n" + formatMetricsSummary(m) + "\n\n" +
        "Extraia as 3 estatisticas mais impactantes para usar em proposals e posts. Retorne JSON:\n" +
        '{\n' +
        '  "title": "Estatisticas de impacto - ' + m.sector + '",\n' +
        '  "headline": "frase de contexto (ex: Media de resultados em ' + m.sector + ')",\n' +
        '  "body": "3 a 5 stats formatados para uso em proposta ou post",\n' +
        '  "stats": [{"label": "...", "value": "...", "unit": "..."}]\n' +
        '}',
};

// ─── Company size categorizer ─────────────────────────────────────────────────

export function categorizeCompanySize(teamSize: number): string {
    if (teamSize <= 10) return "micro empresa (ate 10 pessoas)";
    if (teamSize <= 20) return "pequena empresa (10-20 pessoas)";
    if (teamSize <= 50) return "empresa media (20-50 pessoas)";
    if (teamSize <= 100) return "empresa de porte medio (50-100 pessoas)";
    return "grande empresa (mais de 100 pessoas)";
}

// ─── Proof stats aggregation ──────────────────────────────────────────────────

export function aggregateStatistics(cases: ClientMetrics[]): {
    avgPaybackMonths: number;
    avgSavingsPerYear: number;
    avgHoursRecovered: number;
    avgRevenueIncrease: number;
    totalCases: number;
} {
    if (cases.length === 0) return {
        avgPaybackMonths: 0, avgSavingsPerYear: 0,
        avgHoursRecovered: 0, avgRevenueIncrease: 0, totalCases: 0,
    };

    const sum = (key: keyof ClientMetrics) =>
        cases.reduce((acc, c) => acc + (Number(c[key]) || 0), 0);

    return {
        avgPaybackMonths: Math.round((sum("paybackMonths") / cases.length) * 10) / 10,
        avgSavingsPerYear: Math.round(sum("operationalSavingsPerYear") / cases.length),
        avgHoursRecovered: Math.round(sum("monthlyHoursRecovered") / cases.length),
        avgRevenueIncrease: Math.round(sum("revenueIncreasePerYear") / cases.length),
        totalCases: cases.length,
    };
}
