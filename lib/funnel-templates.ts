/**
 * lib/funnel-templates.ts
 * R3: Consultive WhatsApp message templates for the high-ticket funnel.
 *
 * Key rules:
 * - Never use buzzwords ("revolucionário", "incrível", etc.)
 * - Use lead data to personalize (company, score, pain points)
 * - CTA is always concrete and low-friction
 * - Tone: C-level executive peer, not salesperson
 * - Cooldown: minimum 24h between messages
 *
 * NOTE: Template bodies use regular strings (NOT backtick literals) to avoid
 * JS template literal interpretation of {{var}} placeholders.
 */

export type ScoreTier = "hot" | "warm" | "cold";
export type FunnelStage =
    | "post_click"
    | "post_dossier"
    | "whatsapp_initial"
    | "schedule_pending"
    | "proposal_sent"
    | "follow_up_1"
    | "follow_up_2"
    | "urgency";

export interface MessageTemplate {
    key: string;
    stage: FunnelStage;
    scoreTier: ScoreTier | "all";
    subject: string;
    body: string;  // Uses {{var}} placeholders replaced by renderTemplate()
    cooldownHours: number;
}

// ─── Template Library ─────────────────────────────────────────────────────────
// All body strings use regular string concatenation to avoid template literal
// interpretation of {{placeholders}} as JS expressions.

export const FUNNEL_TEMPLATES: MessageTemplate[] = [

    // ── Stage 1: First WhatsApp touch after assessment ───────────────────────

    {
        key: "initial_hot",
        stage: "whatsapp_initial",
        scoreTier: "hot",
        subject: "Primeiro contato — lead quente (80+)",
        cooldownHours: 0,
        body:
            "Ola, {{firstName}}! Sou {{closer}} da InovaCortex.\n\n" +
            "Vi que a {{company}} concluiu o diagnostico de automacao ha pouco. " +
            "Com pontuacao {{score}}/100, identificamos que voces tem espaco para recuperar " +
            "em torno de R${{savings}}/mes so eliminando operacoes manuais repetitivas.\n\n" +
            "Seria util conversar 20 minutos para eu te mostrar exatamente onde estao esses ganhos?\n\n" +
            "Tenho horario disponivel amanha as 10h ou 15h. Qual prefere?",
    },

    {
        key: "initial_warm",
        stage: "whatsapp_initial",
        scoreTier: "warm",
        subject: "Primeiro contato — lead morno (50-79)",
        cooldownHours: 0,
        body:
            "Ola, {{firstName}}! Sou {{closer}} da InovaCortex.\n\n" +
            "A {{company}} fez o diagnostico conosco e chegou a {{score}}/100 em maturidade operacional. " +
            "Isso significa que ha processos que hoje consomem tempo de equipe e que poderiam ser " +
            "automatizados com retorno rapido.\n\n" +
            "Posso te enviar o relatorio completo com os pontos de melhoria identificados?\n\n" +
            "Leva 30 segundos para voce ter a visao completa da sua operacao.",
    },

    {
        key: "initial_cold",
        stage: "whatsapp_initial",
        scoreTier: "cold",
        subject: "Primeiro contato — lead frio (<50)",
        cooldownHours: 0,
        body:
            "Ola, {{firstName}}! Aqui e {{closer}} da InovaCortex.\n\n" +
            "A {{company}} concluiu nosso diagnostico operacional. Com base nas respostas, " +
            "preparamos um relatorio personalizado com 3 pontos prioritarios para reduzir " +
            "trabalho manual no time de voces.\n\n" +
            "O relatorio esta disponivel aqui: {{dossierLink}}\n\n" +
            "Qualquer duvida, e so responder. Estou a disposicao.",
    },

    // ── Stage 2: After dossier viewed, no schedule yet ───────────────────────

    {
        key: "post_dossier_hot",
        stage: "post_dossier",
        scoreTier: "hot",
        subject: "Pos-dossie — lead quente sem agendamento",
        cooldownHours: 48,
        body:
            "{{firstName}}, vi que voce acessou o diagnostico da {{company}}.\n\n" +
            "O numero que mais chama atencao no caso de voces: {{hours}}h/mes que a equipe " +
            "gasta em tarefas que um agente de IA pode executar — sem erro e sem custo por hora.\n\n" +
            "Antes de voce decidir qualquer coisa: podemos conversar 20 minutos? " +
            "Nao tem compromisso de contratacao. So quero entender se faz sentido pra realidade da {{company}}.\n\n" +
            "Responda \"sim\" e eu envio o link de agendamento agora.",
    },

    {
        key: "post_dossier_warm",
        stage: "post_dossier",
        scoreTier: "warm",
        subject: "Pos-dossie — lead morno sem agendamento",
        cooldownHours: 72,
        body:
            "{{firstName}}, voce viu o diagnostico que preparamos para a {{company}}?\n\n" +
            "Separei um trecho especifico sobre a area que voces mais mencionaram como gargalo. " +
            "Vale a leitura de 2 minutos:\n\n" +
            "{{dossierLink}}\n\n" +
            "Se surgir alguma pergunta, pode me chamar aqui diretamente.",
    },

    // ── Stage 3: Proposal sent ────────────────────────────────────────────────

    {
        key: "proposal_sent",
        stage: "proposal_sent",
        scoreTier: "all",
        subject: "Proposta enviada — confirmacao",
        cooldownHours: 0,
        body:
            "{{firstName}}, a proposta para {{company}} esta disponivel aqui:\n\n" +
            "{{proposalLink}}\n\n" +
            "Ela inclui o ROI projetado com base nos dados que voces forneceram, " +
            "os modulos recomendados e o cronograma de 30 dias.\n\n" +
            "Le com calma e me diz se ficou alguma duvida. Estou aqui.\n\n" +
            "— {{closer}}",
    },

    // ── Stage 4: Follow-ups ───────────────────────────────────────────────────

    {
        key: "follow_up_1_hot",
        stage: "follow_up_1",
        scoreTier: "hot",
        subject: "Follow-up 1 — hot, 3 dias apos proposta",
        cooldownHours: 72,
        body:
            "{{firstName}}, somente para fechar o loop sobre a proposta de automacao para {{company}}.\n\n" +
            "Com base no que mapeamos, o investimento se paga em ate {{payback}} meses. " +
            "O retorno comeca a aparecer no 1 mes de operacao.\n\n" +
            "Tem algum ponto da proposta que precisaria de ajuste ou esclarecimento?\n\n" +
            "Se preferir, podemos conversar 15 minutos hoje ou amanha.",
    },

    {
        key: "follow_up_1_warm",
        stage: "follow_up_1",
        scoreTier: "warm",
        subject: "Follow-up 1 — warm, 5 dias apos proposta",
        cooldownHours: 120,
        body:
            "{{firstName}}, sei que o dia a dia de gestor e corrido. " +
            "So queria saber se voce teve chance de ver a proposta que enviamos para {{company}}.\n\n" +
            "Caso nao tenha caido, o link e: {{proposalLink}}\n\n" +
            "Qualquer duvida ou ajuste necessario, e so avisar.\n\n" +
            "— {{closer}}",
    },

    {
        key: "follow_up_2",
        stage: "follow_up_2",
        scoreTier: "all",
        subject: "Follow-up 2 — ultima tentativa (todos os tiers)",
        cooldownHours: 168,
        body:
            "{{firstName}}, vou deixar essa como ultima mensagem sobre a automacao da {{company}} por enquanto.\n\n" +
            "Se o momento nao for agora — sem problema. Quando fizer sentido revisitar, e so me chamar. " +
            "O diagnostico de voces fica disponivel em:\n\n" +
            "{{dossierLink}}\n\n" +
            "Sucesso nos projetos!\n\n" +
            "— {{closer}}, InovaCortex",
    },

    // ── Stage 5: Score-based urgency message ─────────────────────────────────

    {
        key: "urgency_hot",
        stage: "urgency",
        scoreTier: "hot",
        subject: "Urgencia — mes virando / vagas de implantacao",
        cooldownHours: 120,
        body:
            "{{firstName}}, uma informacao que pode ser relevante para voces:\n\n" +
            "Fechamos as vagas de implantacao deste mes. Temos {{slotsLeft}} vaga(s) " +
            "disponivel(is) para inicio no proximo mes — o que significa que o retorno " +
            "comeca a aparecer ainda neste trimestre.\n\n" +
            "Caso a {{company}} queira seguir, preciso confirmar ate sexta-feira para garantir o slot.\n\n" +
            "Quer que eu reserve?",
    },

];

// ─── Template Selector ────────────────────────────────────────────────────────

export function selectTemplate(
    stage: FunnelStage,
    scoreTier: ScoreTier,
): MessageTemplate {
    const exact = FUNNEL_TEMPLATES.find(t => t.stage === stage && t.scoreTier === scoreTier);
    if (exact) return exact;

    const fallback = FUNNEL_TEMPLATES.find(t => t.stage === stage && t.scoreTier === "all");
    if (fallback) return fallback;

    return FUNNEL_TEMPLATES.find(t => t.key === "follow_up_2")!;
}

// ─── Score → Tier ────────────────────────────────────────────────────────────

export function computeScoreTier(scoreTotal: number): ScoreTier {
    if (scoreTotal >= 80) return "hot";
    if (scoreTotal >= 50) return "warm";
    return "cold";
}

// ─── Stage Progression ───────────────────────────────────────────────────────

export const STAGE_ORDER: FunnelStage[] = [
    "post_click",
    "whatsapp_initial",
    "post_dossier",
    "schedule_pending",
    "proposal_sent",
    "follow_up_1",
    "follow_up_2",
];

export function nextStage(current: FunnelStage): FunnelStage | null {
    const idx = STAGE_ORDER.indexOf(current);
    if (idx === -1 || idx >= STAGE_ORDER.length - 1) return null;
    return STAGE_ORDER[idx + 1];
}

// ─── Template Renderer ────────────────────────────────────────────────────────

export interface TemplateVars {
    firstName?: string;
    company?: string;
    score?: number;
    savings?: string;
    hours?: number;
    payback?: number;
    closer?: string;
    dossierLink?: string;
    proposalLink?: string;
    slotsLeft?: number;
}

export function renderTemplate(template: MessageTemplate, vars: TemplateVars): string {
    let body = template.body;
    const replacements: Record<string, string> = {
        firstName: vars.firstName ?? "Gestor(a)",
        company: vars.company ?? "sua empresa",
        score: String(vars.score ?? ""),
        savings: vars.savings ?? "0",
        hours: String(vars.hours ?? ""),
        payback: String(vars.payback ?? ""),
        closer: vars.closer ?? "Equipe InovaCortex",
        dossierLink: vars.dossierLink ?? "https://inovacortex.com.br",
        proposalLink: vars.proposalLink ?? "https://inovacortex.com.br",
        slotsLeft: String(vars.slotsLeft ?? 2),
    };
    for (const [key, value] of Object.entries(replacements)) {
        body = body.replaceAll("{{" + key + "}}", value);
    }
    return body;
}
