export interface AssessmentPayload {
    name: string;
    email: string;
    company: string;
    role: string;
    segment: string;
    city?: string;
    monthlyRevenue?: string;
    teamSize: string;
    customerVolume?: string; // Replace volumeDay handling
    volumeDay?: string; // Keep for legacy payload support
    channels: string[];
    monthlyLeads?: string;
    conversionRate?: string;
    responseTime?: string;
    manualTasks?: string;
    hoursLost?: string;
    crmUsage?: string;
    automationLevel?: string;
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

    // Helper to evaluate text safely
    const val = (s?: string) => (s || "").toLowerCase();

    // A) Volume/Impacto (0-25)
    const vol = val(data.customerVolume || data.volumeDay);
    if (vol.includes("1000") || vol.includes("mais de 500")) scoreA += 10;
    else if (vol.includes("200") || vol.includes("500")) scoreA += 10;
    else if (vol.includes("50") || vol.includes("100")) scoreA += 7;
    else scoreA += 4;

    const leads = val(data.monthlyLeads);
    if (leads.includes("2000")) scoreA += 3;
    else if (leads.includes("500 a")) scoreA += 2;
    else if (leads.includes("100 a")) scoreA += 1;
    else scoreA += 0;

    if (data.channels.length >= 3) scoreA += 7;
    else if (data.channels.length === 2) scoreA += 5;
    else if (data.channels.length === 1) scoreA += 2;

    // B) Maturidade Stack e Operacional (0-25)
    const stackLower = data.stack.map(s => s.toLowerCase());
    const hasCRM = stackLower.some(s => s.includes("crm") || s.includes("hubspot") || s.includes("rd") || s.includes("pipedrive") || s.includes("salesforce"));
    const hasERP = stackLower.some(s => s.includes("erp") || s.includes("sap") || s.includes("totvs") || s.includes("bling") || s.includes("omie"));
    const hasAutomation = stackLower.some(s => s.includes("make") || s.includes("zapier") || s.includes("n8n"));
    const hasAPI = stackLower.some(s => s.includes("api"));

    if (hasCRM) scoreB += 5;
    if (hasERP) scoreB += 3;
    if (hasAPI) scoreB += 3;
    if (hasAutomation) scoreB += 8;

    const autoLevel = val(data.automationLevel);
    if (autoLevel.includes("avançada")) scoreB += 8;
    else if (autoLevel.includes("moderada")) scoreB += 5;
    else if (autoLevel.includes("básica")) scoreB += 2;

    const crm = val(data.crmUsage);
    if (crm.includes("avançado")) scoreB += 5;
    else if (crm.includes("estruturado")) scoreB += 3;
    else if (crm.includes("básico")) scoreB += 1;

    // C) Nível de Dor e Perdas (0-20)
    const hl = val(data.hoursLost);
    if (hl.includes("mais de 5h")) scoreC += 8;
    else if (hl.includes("não sei")) scoreC += 6;
    else if (hl.includes("3 a 5h")) scoreC += 5;
    else scoreC += 4;

    const rt = val(data.responseTime);
    if (rt.includes("mais de 24h")) scoreC += 5;
    else if (rt.includes("até 24h")) scoreC += 4;
    else if (rt.includes("algumas horas")) scoreC += 3;
    else scoreC += 3;

    if (data.pains.length >= 3) scoreC += 8;
    else if (data.pains.length === 2) scoreC += 8;
    else if (data.pains.length === 1) scoreC += 4;

    // D) Urgência e Comprometimento (0-15)
    const urgencyLower = val(data.urgency);
    if (urgencyLower.includes("alta") || urgencyLower.includes("imediato") || urgencyLower.includes("ontem")) scoreD += 15;
    else if (urgencyLower.includes("média") || urgencyLower.includes("trimestre") || urgencyLower.includes("médio")) scoreD += 8;
    else scoreD += 3;

    // E) Potencial Automação (0-15)
    const goalLower = val(data.goal);
    if (goalLower.includes("custo") || goalLower.includes("conversão") || goalLower.includes("vender")) scoreE += 8;
    else if (goalLower.includes("padronizar") || goalLower.includes("tempo") || goalLower.includes("organizar")) scoreE += 6;
    else scoreE += 4;

    const cr = val(data.conversionRate);
    if (cr.includes("abaixo de 2%") || cr.includes("desconhecida")) scoreE += 7;
    else if (cr.includes("2% a")) scoreE += 4;
    else scoreE += 2;

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

    if (hasWhatsAppOrInsta && (val(data.goal).includes("conversão") || val(data.goal).includes("vender") || val(data.conversionRate).includes("desconhecida"))) {
        missions.add("Agent de Qualificação (Vendas)");
        missions.add("Suporte e Triagem L1");
        missions.add("Suporte");
        missions.add("Vendas");
    }

    if (scoreB >= 15 && (val(data.crmUsage).includes("estruturado") || val(data.stack.join()).includes("crm"))) {
        missions.add("Integração CRM e Roteamento");
        missions.add("Orquestração de Dados Multicanal");
    }

    const lost = val(data.hoursLost);
    if (lost.includes("mais de 5h") || lost.includes("não sei") || val(data.manualTasks).length > 10) {
        missions.add("RPA & Automação de Backoffice");
        missions.add("Padronização de Processos Chave");
    }

    if (missions.size === 0) {
        missions.add("Automação Operacional Básica");
    }

    return {
        scoreTotal,
        scoreBreakdown: { A: scoreA, B: scoreB, C: scoreC, D: scoreD, E: scoreE },
        classification,
        recommendedMissions: Array.from(missions).slice(0, 4) // include additional mission labels for detection
    };
}
