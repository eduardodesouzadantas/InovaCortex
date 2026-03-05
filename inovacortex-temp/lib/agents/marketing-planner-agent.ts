/**
 * lib/agents/marketing-planner-agent.ts
 * V20.1 Prompt 2/4: Deterministic 30-Day Marketing Calendar Generator.
 *
 * ZERO TOKENS — pure deterministic logic.
 * Reads org context from DB; generates calendar using template libraries.
 *
 * Export:  generateMarketingPlan(orgId) → MarketingPlanEntry[]
 *
 * Weekly schedule:
 *   Mon → authority     Tue → insight      Wed → case
 *   Thu → demonstration Fri → offer        Sat → insight (light)
 *   Sun → authority/reflection
 *
 * Platforms alternate: LinkedIn (B2B depth) / Instagram (reach).
 */

import { registerAgent } from "@/lib/agentops/registry";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PostType = "authority" | "case" | "insight" | "demonstration" | "offer" | "myth_break";
export type Platform = "linkedin" | "instagram";

export interface MarketingPlanEntry {
    day: number;
    platform: Platform;
    postType: PostType;
    topic: string;
    hook: string;
    cta: string;
    priority: number;
}

export interface OrgContext {
    niches: string[];       // e.g. ["imobiliária", "clínica", "consultoria"]
    pains: string[];        // frequent pain points from Assessment history
    offers: string[];       // active service offering names
    hasAuthorityAssets: boolean;
}

// ─── Priority Scores ──────────────────────────────────────────────────────────

const PRIORITY: Record<PostType, number> = {
    offer: 5,
    case: 4,
    demonstration: 4,
    authority: 3,
    insight: 2,
    myth_break: 2,
};

// ─── Weekly Day → PostType Map ────────────────────────────────────────────────
// 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat

const DOW_TO_POST_TYPE: Record<number, PostType> = {
    1: "authority",     // Mon
    2: "insight",       // Tue
    3: "case",          // Wed
    4: "demonstration", // Thu
    5: "offer",         // Fri
    6: "insight",       // Sat (light)
    0: "authority",     // Sun (reflection)
};

// ─── Platform rotation: LinkedIn odd days, Instagram even days ────────────────

function platformForDay(day: number): Platform {
    return day % 2 === 1 ? "linkedin" : "instagram";
}

// ─── Hook Templates ───────────────────────────────────────────────────────────

const HOOKS: Record<PostType, string[]> = {
    authority: [
        "Se você tem uma empresa e ainda não usa IA para {processo}, está perdendo dinheiro.",
        "A maior vantagem competitiva de 2025 não é o produto — é a automação dos processos certos.",
        "Enquanto seu concorrente ainda responde manualmente, empresas inteligentes já automatizaram isso.",
        "O que separa uma empresa de R$ 500k de uma de R$ 5M? Sistemas. Não esforço.",
    ],
    case: [
        "Implementamos automação de IA em uma {nicho} e o resultado foi surpreendente.",
        "Como uma {nicho} triplicou o número de atendimentos sem contratar mais funcionários.",
        "Essa empresa de {nicho} economizou {economia} por mês após implementar IA.",
        "O before/after de uma {nicho} que decidiu parar de fazer no braço.",
    ],
    insight: [
        "3 processos que qualquer {nicho} deveria automatizar hoje.",
        "{N} erros que empresas cometem ao tentar escalar sem tecnologia.",
        "A lista de tarefas que você pode (e deve) tirar do seu time imediatamente.",
        "O que aprendi analisando {N} empresas de {nicho} nos últimos 6 meses.",
    ],
    demonstration: [
        "Veja como um agente de IA responde clientes automaticamente — em tempo real.",
        "Demonstração: como o nosso sistema qualifica leads sem intervenção humana.",
        "Ao vivo: um bot de IA atendendo um cliente do zero até o agendamento.",
        "Você vai se surpreender com o que é possível automatizar hoje.",
    ],
    offer: [
        "Estou abrindo {N} vagas para empresas que querem implementar IA em {prazo}.",
        "Para {N} empresas selecionadas: implementação completa de IA com acompanhamento.",
        "Vagas limitadas: se você quer escalar sem contratar, esse post é para você.",
        "Última chamada: {N} empresas para esse ciclo de implementação.",
    ],
    myth_break: [
        "Mito: 'IA é só para grandes empresas.' Verdade: {verdade}.",
        "Pararam de me dizer que automação é muito caro — veja quanto custa não automatizar.",
        "'Minha empresa é diferente.' Entendo. Mas o problema que você enfrenta é universal.",
        "O motivo pelo qual você ainda não tem IA na sua empresa não é o que você pensa.",
    ],
};

// ─── CTA Templates ────────────────────────────────────────────────────────────

const CTAS: Record<PostType, string[]> = {
    authority: [
        "Se quiser entender como aplicar isso no seu negócio, me envie 'IA'.",
        "Comente 'QUERO' e eu te mando um diagnóstico gratuito.",
        "Me envie uma mensagem se quiser ver como isso se aplica à sua realidade.",
    ],
    case: [
        "Se quiser implementar isso na sua empresa, me chame no inbox.",
        "Quer um case como esse? Me manda uma mensagem com o nome da sua empresa.",
        "Salve esse post e me envie 'EU QUERO' para conversarmos.",
    ],
    insight: [
        "Quer a lista completa? Comente 'AUTOMAÇÃO'.",
        "Compartilhe com quem precisa ouvir isso.",
        "Salve para não perder — e me marca quando implementar o primeiro.",
    ],
    demonstration: [
        "Se quiser ver esse sistema funcionando na sua empresa, me envie uma mensagem.",
        "Quer uma demo personalizada? Me manda 'DEMO' aqui.",
        "Comente 'QUERO VER' e eu te envio o vídeo completo.",
    ],
    offer: [
        "Estou selecionando {N} empresas para implementar isso. Me envie 'TENHO INTERESSE'.",
        "Vagas limitadas — preencha o formulário no primeiro comentário.",
        "Se você é {perfil}, esse projeto foi feito para você. Me chame.",
    ],
    myth_break: [
        "Discorda? Me conta nos comentários.",
        "Compartilhe com quem ainda acredita nesse mito.",
        "Quer ver como isso funciona na prática? Me manda uma mensagem.",
    ],
};

// ─── Topic Templates ──────────────────────────────────────────────────────────

function topicTemplates(postType: PostType, ctx: OrgContext): string[] {
    const niche = ctx.niches[0] ?? "empresas";
    const pain = ctx.pains[0] ?? "processos manuais";
    const offer = ctx.offers[0] ?? "implementação de IA";

    const templates: Record<PostType, string[]> = {
        authority: [
            `Por que toda ${niche} precisa de processos automatizados`,
            `O custo invisível de não usar IA para ${pain}`,
            `Autoridade e escala: o que ${niche} de alta performance fazem diferente`,
            `A transformação que ${niche} estão passando com inteligência artificial`,
        ],
        case: [
            `Como resolvemos ${pain} em uma ${niche}`,
            `Resultado de 30 dias: ${niche} após implementar nossa solução`,
            `O antes e depois de uma ${niche} que automatizou ${pain}`,
            `Case real: ${offer} em uma ${niche} com menos de 60 dias`,
        ],
        insight: [
            `3 formas de resolver ${pain} sem contratar mais pessoas`,
            `O que ${niche} de sucesso fazem que você ainda não faz`,
            `Por que ${pain} custa mais do que você imagina`,
            `5 automações que qualquer ${niche} pode implementar esta semana`,
        ],
        demonstration: [
            `Demonstração: como ${offer} funciona em tempo real`,
            `Veja um agente de IA resolvendo ${pain} automaticamente`,
            `Ao vivo: o processo que ${niche} usam para escalar sem equipe grande`,
            `Como funciona nossa tecnologia de automação para ${niche}`,
        ],
        offer: [
            `Implementação de ${offer} para ${niche}`,
            `Vagas abertas: ${offer} com acompanhamento completo`,
            `Proposta especial para ${niche} que querem sair de ${pain}`,
            `Programa de implementação: ${offer} do zero ao resultado`,
        ],
        myth_break: [
            `"${pain} não pode ser automatizado" — mito ou verdade?`,
            `Por que muitas ${niche} ainda não usam IA (e estão erradas)`,
            `O mito mais perigoso sobre automação para ${niche}`,
            `Desmistificando: IA não é cara, não é complexa, não é para só gigantes`,
        ],
    };
    return templates[postType];
}

// ─── Pick helpers (deterministic by day/index) ────────────────────────────────

function pick<T>(arr: T[], seed: number): T {
    return arr[seed % arr.length];
}

function fillTemplate(template: string, ctx: OrgContext, day: number): string {
    const niche = ctx.niches[day % ctx.niches.length] ?? "empresas";
    const pain = ctx.pains[day % ctx.pains.length] ?? "processos manuais";
    const N = [2, 3, 4, 5][day % 4];
    const prazo = ["30 dias", "45 dias", "60 dias"][day % 3];
    const economia = ["R$ 8.000", "R$ 15.000", "R$ 22.000"][day % 3];
    const processo = pain;
    const perfil = `dono(a) de ${niche}`;
    const verdade = `pequenas empresas são as que mais se beneficiam`;

    return template
        .replace(/{nicho}/g, niche)
        .replace(/{processo}/g, processo)
        .replace(/{N}/g, String(N))
        .replace(/{prazo}/g, prazo)
        .replace(/{economia}/g, economia)
        .replace(/{perfil}/g, perfil)
        .replace(/{verdade}/g, verdade);
}

// ─── Core Generator ───────────────────────────────────────────────────────────

export function buildCalendar(ctx: OrgContext): MarketingPlanEntry[] {
    const calendar: MarketingPlanEntry[] = [];
    // Day 1 = Monday (so dow for day d = ((d-1) % 7) + 1, wrapping Sun=0)
    const startDow = 1; // Monday

    for (let day = 1; day <= 30; day++) {
        const dow = day % 7; // day 1→1(Mon), 6→6(Sat), 7→0(Sun)
        const postType = DOW_TO_POST_TYPE[dow];
        const platform = platformForDay(day);

        const hookTemplates = HOOKS[postType];
        const ctaTemplates = CTAS[postType];
        const topics = topicTemplates(postType, ctx);

        const hook = fillTemplate(pick(hookTemplates, day), ctx, day);
        const cta = fillTemplate(pick(ctaTemplates, day), ctx, day);
        const topic = pick(topics, day);

        calendar.push({
            day,
            platform,
            postType,
            topic,
            hook,
            cta,
            priority: PRIORITY[postType],
        });
    }

    return calendar;
}

// ─── DB-aware generator ───────────────────────────────────────────────────────

export async function generateMarketingPlan(orgId: string): Promise<MarketingPlanEntry[]> {
    const { prisma } = await import("@/lib/prisma");

    // Load org context from DB
    const [org, assessments, authorityAssets, proposals] = await Promise.all([
        (prisma as any).organization.findUnique({ where: { id: orgId }, select: { name: true } }).catch(() => null),
        (prisma as any).assessment.findMany({
            where: { organizationId: orgId },
            select: { challenges: true, currentSolution: true, nicho: true },
            orderBy: { createdAt: "desc" },
            take: 20,
        }).catch(() => []),
        (prisma as any).authorityAsset?.findMany({
            where: { organizationId: orgId },
            select: { type: true },
            take: 10,
        }).catch(() => []) ?? [],
        (prisma as any).proposal.findMany({
            where: { assessment: { organizationId: orgId } },
            select: { modulesEnabled: true },
            orderBy: { createdAt: "desc" },
            take: 5,
        }).catch(() => []),
    ]);

    // Extract niches
    const nichoSet = new Set<string>();
    for (const a of assessments) {
        if (a.nicho) nichoSet.add(a.nicho);
    }
    const niches = nichoSet.size > 0 ? Array.from(nichoSet) : ["empresas", "clínicas", "consultorias"];

    // Extract frequent pains from challenges field
    const painSet = new Set<string>();
    for (const a of assessments) {
        if (a.challenges) {
            const raw = typeof a.challenges === "string" ? a.challenges : JSON.stringify(a.challenges);
            raw.split(/[,.;\n]/).map((p: string) => p.trim()).filter((p: string) => p.length > 10 && p.length < 80)
                .slice(0, 3).forEach((p: string) => painSet.add(p));
        }
    }
    const pains = painSet.size > 0
        ? Array.from(painSet).slice(0, 8)
        : ["processos manuais", "atendimento lento", "leads não respondidos", "falta de automação"];

    // Extract offer names from module names
    const offers = new Set<string>();
    for (const p of proposals) {
        try {
            const mods = JSON.parse(p.modulesEnabled ?? "[]");
            for (const m of mods) offers.add(typeof m === "string" ? m : (m.name ?? m.id));
        } catch { /* skip */ }
    }
    const offerList = offers.size > 0 ? Array.from(offers) : ["implementação de IA", "automação de atendimento", "agente de vendas"];

    const ctx: OrgContext = {
        niches,
        pains,
        offers: offerList,
        hasAuthorityAssets: (authorityAssets as any[]).length > 0,
    };

    const calendar = buildCalendar(ctx);

    // Persist to DB (upsert by orgId+day to be idempotent)
    await Promise.all(calendar.map(entry =>
        (prisma as any).marketingPlan.upsert({
            where: { orgId_day: { orgId, day: entry.day } },
            create: { orgId, ...entry },
            update: { ...entry },
        }).catch(() => null)
    ));

    return calendar;
}

// ─── Agent Registration ───────────────────────────────────────────────────────

registerAgent(
    "marketing_planner",
    async (input: { orgId: string }) => generateMarketingPlan(input.orgId),
    {
        model: "none",           // zero tokens
        maxTokens: 0,
        cacheEnabled: false,     // always regenerate fresh from DB context
        fallbackToTemplate: true,
    },
);
