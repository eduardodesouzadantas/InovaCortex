export interface AssessmentPayload {
    name: string;
    email: string;
    company: string;
    role: string;
    segment: string;
    teamSize: string;
    volumeDay: string;
    channels: string[];
    stack: string[];
    pains: string[];
    urgency: string;
    goal: string;
}

export interface ScoreResult {
    scoreTotal: number;
    scoreBreakdown: {
        A: number; // Volume/Impacto (0-25)
        B: number; // Maturidade Stack (0-25)
        C: number; // Clareza de Dor (0-20)
        D: number; // Urgência (0-15)
        E: number; // Potencial Automação (0-15)
    };
    classification: "Alta prioridade" | "Boa oportunidade" | "Exploratória";
    recommendedMissions: string[];
}

export function calculateScore(data: AssessmentPayload): ScoreResult {
    let scoreA = 0;
    let scoreB = 0;
    let scoreC = 0;
    let scoreD = 0;
    let scoreE = 0;
    const missions: Set<string> = new Set();

    // A) Volume/Impacto (0-25)
    // Baseado no volumeDay e quantidade de channels
    if (data.volumeDay === "Mais de 500" || data.volumeDay === "501-1000" || data.volumeDay === ">1000") scoreA += 15;
    else if (data.volumeDay === "100-500") scoreA += 10;
    else if (data.volumeDay === "Menos de 100") scoreA += 5;

    if (data.channels.length >= 3) scoreA += 10;
    else if (data.channels.length === 2) scoreA += 5;
    else if (data.channels.length === 1) scoreA += 2;

    // B) Maturidade Stack (0-25)
    // Baseado em ferramentas no stack
    const stackLower = data.stack.map(s => s.toLowerCase());
    const hasCRM = stackLower.some(s => s.includes("crm") || s.includes("hubspot") || s.includes("rd") || s.includes("pipedrive") || s.includes("salesforce"));
    const hasERP = stackLower.some(s => s.includes("erp") || s.includes("sap") || s.includes("totvs") || s.includes("bling") || s.includes("omie"));
    const hasAutomation = stackLower.some(s => s.includes("make") || s.includes("zapier") || s.includes("n8n"));
    const hasAPI = stackLower.some(s => s.includes("api"));

    if (hasCRM) scoreB += 7;
    if (hasERP) scoreB += 7;
    if (hasAutomation) scoreB += 6;
    if (hasAPI) scoreB += 5;

    // C) Clareza de Dor (0-20)
    // Quantidade de dores mapeadas
    if (data.pains.length >= 3) scoreC += 20;
    else if (data.pains.length === 2) scoreC += 15;
    else if (data.pains.length === 1) scoreC += 8;

    // D) Urgência (0-15)
    const urgencyLower = data.urgency.toLowerCase();
    if (urgencyLower.includes("alta") || urgencyLower.includes("imediato") || urgencyLower.includes("para ontem")) scoreD += 15;
    else if (urgencyLower.includes("média") || urgencyLower.includes("proximo trimestre") || urgencyLower.includes("médio")) scoreD += 8;
    else scoreD += 3;

    // E) Potencial Automação (0-15)
    // Relação objetivo + repetição (volume)
    const goalLower = data.goal.toLowerCase();
    if ((goalLower.includes("custo") || goalLower.includes("conversão") || goalLower.includes("vender mais")) && scoreA >= 10) scoreE += 15;
    else if ((goalLower.includes("padronizar") || goalLower.includes("tempo") || goalLower.includes("organizar"))) scoreE += 10;
    else scoreE += 5;

    // Garantindo caps das categorias
    scoreA = Math.min(scoreA, 25);
    scoreB = Math.min(scoreB, 25);
    scoreC = Math.min(scoreC, 20);
    scoreD = Math.min(scoreD, 15);
    scoreE = Math.min(scoreE, 15);

    const scoreTotal = scoreA + scoreB + scoreC + scoreD + scoreE;

    // Classification
    let classification: ScoreResult["classification"] = "Exploratória";
    if (scoreTotal >= 75) {
        classification = "Alta prioridade";
    } else if (scoreTotal >= 50) {
        classification = "Boa oportunidade";
    }

    // Recommended Missions Rules
    const hasWhatsAppOrInsta = data.channels.some(c => c.toLowerCase().includes("whatsapp") || c.toLowerCase().includes("instagram"));

    if (hasWhatsAppOrInsta && (goalLower.includes("conversão") || goalLower.includes("vender") || goalLower.includes("vendas"))) {
        missions.add("Vendas");
        missions.add("Suporte");
    }

    if ((hasCRM || hasERP) && scoreA >= 15) { // Alto volume = scoreA >= 15
        missions.add("Backoffice");
        missions.add("Dados");
    }

    const hasRetrabalhoPain = data.pains.some(p => p.toLowerCase().includes("retrabalho") || p.toLowerCase().includes("manual") || p.toLowerCase().includes("repetitivo"));
    if (goalLower.includes("padronizar") && hasRetrabalhoPain) {
        missions.add("Suporte");
        missions.add("Backoffice");
    }

    if (missions.size === 0) {
        missions.add("Automação Operacional Básica");
    }

    return {
        scoreTotal,
        scoreBreakdown: { A: scoreA, B: scoreB, C: scoreC, D: scoreD, E: scoreE },
        classification,
        recommendedMissions: Array.from(missions).slice(0, 3) // max 3
    };
}
