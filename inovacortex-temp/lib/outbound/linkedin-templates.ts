/**
 * lib/outbound/linkedin-templates.ts
 * V21: Deterministic LinkedIn outbound templates — 4 ICPs × 5 stages.
 *
 * ICPs: imobiliaria | clinica | consultoria | servicos_recorrentes
 * Stages: connect_note | dm1 | dm2 | dm3 | close
 *
 * Rules:
 *  - NO buzzwords ("IA revolucionária", "disruptivo", "game-changer")
 *  - Focus: reduzir tempo, aumentar conversão, automatizar atendimento
 *  - connect_note ≤ 250 chars (LinkedIn limit)
 *  - dm3 includes deal one-pager link if provided
 *  - dm2 includes 1 proof stat
 *
 * Pure, zero-dependency, zero-token module.
 */

export type ICP = "imobiliaria" | "clinica" | "consultoria" | "servicos_recorrentes";
export type Stage = "connect_note" | "dm1" | "dm2" | "dm3" | "close";

export interface MessageContext {
    firstName: string;
    company: string;
    title: string;
    proofStat?: string;         // e.g. "Payback médio de 5 meses"
    dealLink?: string;         // e.g. "https://..."
    calLink?: string;         // Calendly or booking link
}

export interface TemplateDefinition {
    key: string;            // e.g. "imobiliaria_dm1"
    stage: Stage;
    icp: ICP;
    render: (ctx: MessageContext) => string;
}

// ─── ICP detection ────────────────────────────────────────────────────────────

const ICP_KEYWORDS: Record<ICP, string[]> = {
    imobiliaria: ["imobili", "real estate", "corretor", "incorporadora", "loteamento", "construtora"],
    clinica: ["clínica", "clinica", "saúde", "saude", "médic", "medic", "odonto", "estética", "estetica"],
    consultoria: ["consultoria", "advisory", "consulting", "gestão", "gestao", "estratégia"],
    servicos_recorrentes: ["serviç", "servic", "manutençã", "segurança", "limpeza", "assinatura", "recorrente"],
};

export function detectICP(industry: string, title: string): ICP {
    const text = `${industry} ${title}`.toLowerCase();
    for (const [icp, kws] of Object.entries(ICP_KEYWORDS)) {
        if (kws.some(k => text.includes(k))) return icp as ICP;
    }
    return "servicos_recorrentes"; // default fallback
}

// ─── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES: TemplateDefinition[] = [

    // ── IMOBILIÁRIA ──────────────────────────────────────────────────────────

    {
        key: "imobiliaria_connect", stage: "connect_note", icp: "imobiliaria",
        render: ({ firstName }) =>
            `Olá ${firstName}, acompanho o seu trabalho no mercado imobiliário. Trabalho com automação de atendimento para imobiliárias que querem aumentar conversão sem aumentar equipe. Posso conectar?`,
    },
    {
        key: "imobiliaria_dm1", stage: "dm1", icp: "imobiliaria",
        render: ({ firstName, company }) =>
            `Olá ${firstName}! Obrigado pela conexão.

Trabalho com imobiliárias como a ${company} que buscam reduzir o tempo de resposta a leads e qualificar mais oportunidades sem precisar contratar.

Qual é o maior gargalo no processo de atendimento hoje? WhatsApp, CRM ou qualificação inicial?`,
    },
    {
        key: "imobiliaria_dm2", stage: "dm2", icp: "imobiliaria",
        render: ({ firstName, proofStat }) =>
            `${firstName}, uma coisa que percebemos em imobiliárias: 60-70% dos leads qualificados perdem interesse por demora no primeiro contato.

Automatizamos esse fluxo — da captura ao primeiro contato personalizado em menos de 2 minutos.

${proofStat ? `Resultado típico dos nossos clientes: ${proofStat}.` : "Os resultados chegam rápido — na maioria dos casos em menos de 30 dias."}

Faz sentido explorar isso para a ${"{company}"}?`,
    },
    {
        key: "imobiliaria_dm3", stage: "dm3", icp: "imobiliaria",
        render: ({ firstName, dealLink }) =>
            `${firstName}, preparamos uma análise rápida com o potencial estimado de automação para o seu perfil.

${dealLink ? `Você pode ver aqui: ${dealLink}` : "Posso te enviar a análise completa por aqui mesmo."}

Nenhum compromisso — é só para você ter uma referência concreta antes de decidir conversar.`,
    },
    {
        key: "imobiliaria_close", stage: "close", icp: "imobiliaria",
        render: ({ firstName, calLink }) =>
            `${firstName}, para fechar: você teria 20 minutos essa semana para uma conversa rápida?

${calLink ? `Pode agendar aqui no horário que preferir: ${calLink}` : "Me diz um horário que funciona para você e eu confirmo."}

Se não for o momento certo, tudo bem também — pode me avisar.`,
    },

    // ── CLÍNICA ──────────────────────────────────────────────────────────────

    {
        key: "clinica_connect", stage: "connect_note", icp: "clinica",
        render: ({ firstName }) =>
            `Olá ${firstName}, trabalho com automação de atendimento para clínicas que querem reduzir tempo de agendamento e melhorar retenção de pacientes. Gostaria de conectar.`,
    },
    {
        key: "clinica_dm1", stage: "dm1", icp: "clinica",
        render: ({ firstName, company }) =>
            `Olá ${firstName}! Obrigado pela conexão.

Tenho trabalhado com clínicas semelhantes à ${company} para reduzir a carga de atendimento manual — especialmente em confirmação de consultas, retornos e captação de novos pacientes.

Como está o processo de agendamento e confirmação hoje? Ainda é muito manual?`,
    },
    {
        key: "clinica_dm2", stage: "dm2", icp: "clinica",
        render: ({ firstName, proofStat }) =>
            `${firstName}, um dado que costuma chamar atenção: clínicas que automatizam confirmação de consultas reduzem faltas em até 30%.

Além disso, a equipe consegue focar no atendimento em vez de ficar no telefone.

${proofStat ? `Na média dos nossos clientes: ${proofStat}.` : "O resultado aparece já nas primeiras semanas."}

Isso seria relevante para a realidade da sua clínica?`,
    },
    {
        key: "clinica_dm3", stage: "dm3", icp: "clinica",
        render: ({ firstName, dealLink }) =>
            `${firstName}, preparei uma análise com os números estimados para uma operação como a sua.

${dealLink ? `Aqui está: ${dealLink}` : "Posso compartilhar a análise aqui mesmo."}

É bem objetivo — quanto tempo pode ser recuperado e qual é o impacto em novas consultas por mês.`,
    },
    {
        key: "clinica_close", stage: "close", icp: "clinica",
        render: ({ firstName, calLink }) =>
            `${firstName}, que tal uma conversa de 20 minutos para ver se faz sentido?

${calLink ? `Você escolhe o horário aqui: ${calLink}` : "Me diz quando tem um tempinho essa semana."}

Se não for o momento, pode me avisar também — sem problema.`,
    },

    // ── CONSULTORIA ──────────────────────────────────────────────────────────

    {
        key: "consultoria_connect", stage: "connect_note", icp: "consultoria",
        render: ({ firstName }) =>
            `Olá ${firstName}, trabalho com automação de processos para consultorias que querem aumentar a capacidade de entrega sem aumentar headcount. Gostaria de trocar uma ideia.`,
    },
    {
        key: "consultoria_dm1", stage: "dm1", icp: "consultoria",
        render: ({ firstName, company }) =>
            `Olá ${firstName}! Obrigado pela conexão.

Tenho trabalhado com consultorias como a ${company} em automação de processos internos — especialmente relatórios, onboarding de clientes e follow-up comercial.

Qual área da operação mais consome tempo do time hoje?`,
    },
    {
        key: "consultoria_dm2", stage: "dm2", icp: "consultoria",
        render: ({ firstName, proofStat }) =>
            `${firstName}, o que mais vejo em consultorias é tempo do sócio sendo consumido por tarefas que poderiam ser automatizadas — relatórios, cobranças, atualizações de clientes.

${proofStat ? `Nossos clientes relatam: ${proofStat}.` : "A maioria recupera entre 15 e 30 horas por mês já nas primeiras semanas."}

Você enfrenta algo parecido?`,
    },
    {
        key: "consultoria_dm3", stage: "dm3", icp: "consultoria",
        render: ({ firstName, dealLink }) =>
            `${firstName}, fiz uma análise rápida com o potencial para uma operação no seu perfil.

${dealLink ? `Veja aqui: ${dealLink}` : "Posso compartilhar os números por aqui."}

É uma estimativa conservadora — sem inventar números, com base em casos reais.`,
    },
    {
        key: "consultoria_close", stage: "close", icp: "consultoria",
        render: ({ firstName, calLink }) =>
            `${firstName}, para fechar o raciocínio: você toparia 20 minutos para ver se faz sentido para a sua consultoria?

${calLink ? `Agenda aqui: ${calLink}` : "Só me falar um horário que te sirva essa semana."}`,
    },

    // ── SERVIÇOS RECORRENTES ─────────────────────────────────────────────────

    {
        key: "servicos_connect", stage: "connect_note", icp: "servicos_recorrentes",
        render: ({ firstName }) =>
            `Olá ${firstName}, ajudo empresas de serviços recorrentes a automatizar atendimento e cobrança, reduzindo cancelamentos e aumentando a capacidade sem mais headcount. Posso conectar?`,
    },
    {
        key: "servicos_dm1", stage: "dm1", icp: "servicos_recorrentes",
        render: ({ firstName, company }) =>
            `Olá ${firstName}! Obrigado pela conexão.

Tenho trabalhado com empresas de serviços como a ${company} em dois pontos-chave: reduzir churn por falta de comunicação e automatizar renovações e cobranças.

Como está a taxa de retenção hoje? Isso é monitorado ativamente?`,
    },
    {
        key: "servicos_dm2", stage: "dm2", icp: "servicos_recorrentes",
        render: ({ firstName, proofStat }) =>
            `${firstName}, um dado que sempre aparece: empresas de serviços recorrentes perdem entre 5-10% dos clientes por falha de comunicação — não por insatisfação com o serviço.

Automatizar os touchpoints de renovação e pós-venda resolve boa parte disso.

${proofStat ? `Resultado médio dos nossos clientes: ${proofStat}.` : "O retorno costuma aparecer no primeiro mês."}

Isso ressoa com o que você vê na operação?`,
    },
    {
        key: "servicos_dm3", stage: "dm3", icp: "servicos_recorrentes",
        render: ({ firstName, dealLink }) =>
            `${firstName}, fiz uma análise do potencial para uma empresa no seu perfil.

${dealLink ? `Aqui: ${dealLink}` : "Posso compartilhar a estimativa por aqui."}

Números conservadores, sem exagero — baseado em casos reais do setor.`,
    },
    {
        key: "servicos_close", stage: "close", icp: "servicos_recorrentes",
        render: ({ firstName, calLink }) =>
            `${firstName}, toparia 20 minutos essa semana para fechar a ideia?

${calLink ? `Escolhe o horário aqui: ${calLink}` : "É só me dar um horário que prefere."}

Se não for o momento certo, sem problema — basta me dizer.`,
    },
];

// ─── Lookup ───────────────────────────────────────────────────────────────────

const TEMPLATE_MAP = new Map<string, TemplateDefinition>(
    TEMPLATES.map(t => [t.key, t]),
);

/** Build stage key from ICP + stage */
export function buildTemplateKey(icp: ICP, stage: Stage): string {
    const prefix = icp === "imobiliaria" ? "imobiliaria"
        : icp === "clinica" ? "clinica"
            : icp === "consultoria" ? "consultoria"
                : "servicos";
    // map stage to key suffix
    const suffix = stage === "connect_note" ? "connect" : stage;
    return `${prefix}_${suffix}`;
}

/** Render a message from ICP + stage + context */
export function renderTemplate(icp: ICP, stage: Stage, ctx: MessageContext): { key: string; body: string } {
    const key = buildTemplateKey(icp, stage);
    const tpl = TEMPLATE_MAP.get(key);
    if (!tpl) {
        // Fallback generic
        return {
            key: `generic_${stage}`,
            body: `Olá ${ctx.firstName}, espero que esteja bem! Quero conectar para explorar uma oportunidade de colaboração.`,
        };
    }
    // Replace lazy {company} placeholder in templates
    const raw = tpl.render(ctx);
    const body = raw.replace(/\{company\}/g, ctx.company);
    return { key, body };
}

/** Return all template keys for a given stage (for metrics grouping) */
export function getTemplateKeys(stage: Stage): string[] {
    return TEMPLATES
        .filter(t => t.stage === stage || (stage === "connect_note" && t.stage === "connect_note"))
        .map(t => t.key);
}

// Cooldowns per stage transition (ms)
export const STAGE_COOLDOWNS: Record<string, number> = {
    connect_note: 24 * 60 * 60 * 1000,   // → dm1 in 24h
    dm1: 72 * 60 * 60 * 1000,   // → dm2 in 72h
    dm2: 96 * 60 * 60 * 1000,   // → dm3 in 96h
    dm3: 72 * 60 * 60 * 1000,   // → close in 72h
    close: 0,                      // terminal stage
};

export const STAGE_ORDER: Stage[] = ["connect_note", "dm1", "dm2", "dm3", "close"];

export function nextStage(current: Stage): Stage | "done" {
    const idx = STAGE_ORDER.indexOf(current);
    if (idx === -1 || idx >= STAGE_ORDER.length - 1) return "done";
    return STAGE_ORDER[idx + 1];
}
