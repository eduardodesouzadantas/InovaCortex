/**
 * lib/services/meeting-intelligence/briefing-engine.ts
 * V16.3-P2 / V17: Generates a pre-meeting briefing for the org owner.
 *
 * Modes:
 *  - STUB (default): deterministic, rules-based, no API calls
 *  - REAL (AI_MODE=real + OPENAI_API_KEY): richer, AI-augmented
 *
 * V17 addition: strategy playbook section — tone, urgency, recommended CTA,
 * proposal structure and 3 ready-to-use closing phrases per follow-up tone.
 *
 * Guardrails:
 *  - No impossible promises or absolute guarantees
 *  - No raw sensitive data exposition
 *  - Short, scannable sections
 *  - Every closing phrase must end with a clear next-action offer
 */

import { prisma } from "@/lib/prisma";
import type { StrategyOutput } from "@/lib/services/deal-optimization/strategy-engine";

export interface BriefingOutput {
    text: string;
    stub: boolean;
    tokensUsed?: number;
    costUsd?: number;
}

// ─── Strategy-aware closing phrases ──────────────────────────────────────────
// Rules: no agressividade, sem promessas absolutas, sempre ação clara
export const CLOSING_PHRASES_BY_TONE: Record<"direct" | "consultative" | "educational", string[]> = {
    direct: [
        "'Baseado no que conversamos, faz sentido eu preparar uma proposta ainda essa semana — posso enviar até quinta?'",
        "'Qual seria o próximo passo mais simples para vocês avançarem com isso agora?'",
        "'Se os números fizerem sentido pra você, conseguimos agendar a revisão da proposta ainda hoje?'",
    ],
    consultative: [
        "'Antes de eu sugerir uma solução, quero entender o que seria ideal pra vocês — posso fazer mais 2 perguntas?'",
        "'Depois dessa conversa, posso montar um esboço de proposta adaptado ao cenário de vocês — faria sentido?'",
        "'Quero garantir que estou entendendo certo — o principal objetivo de vocês agora é [X], correto?'",
    ],
    educational: [
        "'Posso te enviar um material breve sobre como outras empresas do seu segmento abordaram esse problema — ajudaria na avaliação?'",
        "'Vou preparar um resumo do que discutimos com alguns exemplos práticos — te envio ainda hoje?'",
        "'Sem pressa na decisão — o que posso fazer é dar mais clareza sobre o processo para você avaliar com calma?'",
    ],
};

// ─── CTA label map ────────────────────────────────────────────────────────────
const CTA_LABELS: Record<string, string> = {
    schedule: "Agendar próxima reunião",
    reply_yes: "Curta resposta sim/não para avançar",
    review_proposal: "Proposta enviada — pedir revisão e feedback",
    send_doc: "Enviar documento / material educativo",
    soft_nurture: "Nutrir com conteúdo — sem pressão de venda",
};

// ─── Proposal structure label map ────────────────────────────────────────────
const STRUCTURE_LABELS: Record<string, string> = {
    compact: "Compacta — proposta curta, foco em ROI e próximo passo",
    modular: "Modular — seções independentes, lead escolhe prioridade",
    aggressive: "Agressiva — full scope + ROI detalhado, ideal para hot+alto EV",
};

// ─── Build strategy playbook block (exported for unit tests) ─────────────────
export function buildStrategySection(strategy: {
    followUpTone: "direct" | "consultative" | "educational" | null;
    urgencyLevel: number | null;
    recommendedCTA: string | null;
    proposalStructure: string | null;
    rationale?: string[];
}): string {
    const tone = (strategy.followUpTone ?? "consultative") as "direct" | "consultative" | "educational";
    const urgency = strategy.urgencyLevel ?? 3;
    const cta = strategy.recommendedCTA ?? "schedule";
    const structure = strategy.proposalStructure ?? "compact";

    const urgencyBar = "🟥".repeat(urgency) + "⬜".repeat(5 - urgency);
    const phrases = CLOSING_PHRASES_BY_TONE[tone] ?? CLOSING_PHRASES_BY_TONE.consultative;

    const toneLabel: Record<string, string> = {
        direct: "Direto — vá para o fechamento",
        consultative: "Consultivo — valide antes de propor",
        educational: "Educativo — construa confiança primeiro",
    };

    const lines = [
        `💡 *Estratégia recomendada (baseado no pipeline):*`,
        ``,
        `🎙 *Tom do follow-up:* ${toneLabel[tone] ?? tone}`,
        `⚡ *Urgência:* ${urgencyBar} (${urgency}/5)`,
        `🎯 *CTA recomendado:* ${CTA_LABELS[cta] ?? cta}`,
        `📑 *Estrutura de proposta sugerida:* ${STRUCTURE_LABELS[structure] ?? structure}`,
        ``,
        `💬 *3 frases de fechamento prontas (tom: ${tone}):*`,
        ...phrases.map((p, i) => `${i + 1}. ${p}`),
    ];

    return lines.join("\n");
}

// ─── Strategic questions by priority tier ────────────────────────────────────
const QUESTIONS_BY_TIER: Record<string, string[]> = {
    hot: [
        "1. Qual o maior problema que trava a equipe hoje?",
        "2. Quem mais está envolvido na decisão de compra?",
        "3. Já tentaram resolver isso antes? O que não funcionou?",
        "4. Qual o impacto financeiro se o problema continuar?",
        "5. Existe orçamento aprovado ou em aprovação?",
        "6. Qual seria o sinal de sucesso para eles?",
        "7. Qual o prazo ideal para ter uma solução rodando?",
    ],
    warm: [
        "1. Por que decidiram buscar uma solução agora?",
        "2. Quais alternativas já avaliaram?",
        "3. Quem valida a proposta internamente?",
        "4. O que mais preocupa: custo, prazo ou complexidade?",
        "5. Como é o processo atual? Onde trava?",
        "6. Tem alguma meta ou deadline que direciona a urgência?",
        "7. O que os faria dizer 'não' a uma proposta?",
    ],
    cold: [
        "1. O que chamou atenção deles para marcar a reunião?",
        "2. Qual a maior dor declarada até agora?",
        "3. Estão no começo da pesquisa ou já decidiram comprar?",
        "4. Quem mais vai participar da conversa?",
        "5. Que resultado mínimo fariam valer o investimento?",
        "6. Qual o maior ceticismo provável deles?",
        "7. Como prefiro abrir a reunião: problema ou solução?",
    ],
};

const CLOSE_STRATEGY_BY_TIER: Record<string, string[]> = {
    hot: [
        "• Foco na dor financeira — conecte tudo ao custo de não agir.",
        "• Ofereça garantia de resultado parcial ou POC reduzida.",
        "• Proponha próximos passos com data já na reunião.",
    ],
    warm: [
        "• Valide o critério de sucesso deles antes de apresentar a solução.",
        "• Use prova social de segmento similar.",
        "• Finalize com uma pergunta de avanço: 'o que precisamos para avançar?'",
    ],
    cold: [
        "• Priorize escuta — não apresente solução antes de mapear a dor.",
        "• Calibre a urgência com perguntas de impacto.",
        "• Termine com follow-up de conteúdo, não de proposta.",
    ],
};

// ─── Main Builder ─────────────────────────────────────────────────────────────

export async function buildBriefing(meetingSessionId: string): Promise<BriefingOutput> {
    const session = await (prisma as any).meetingSession.findUnique({
        where: { id: meetingSessionId }
    });

    if (!session) {
        return { text: "⚠️ Sessão de reunião não encontrada.", stub: true };
    }

    // Fetch related data
    const assessment = session.assessmentId
        ? await (prisma as any).assessment.findUnique({ where: { id: session.assessmentId } })
        : null;

    const roi = assessment
        ? await (prisma as any).roiProjection.findFirst({ where: { assessmentId: assessment.id } })
        : null;

    const proposal = assessment
        ? await (prisma as any).proposal.findFirst({
            where: { assessmentId: assessment.id },
            orderBy: { createdAt: "desc" }
        })
        : null;

    // V17: pull strategy fields persisted by brainCycle
    const strategy = {
        followUpTone: session.followUpTone ?? null,
        urgencyLevel: session.urgencyLevel ?? null,
        recommendedCTA: session.recommendedCTA ?? null,
        proposalStructure: session.proposalStructure ?? null,
    };

    const isRealMode = process.env.AI_MODE === "real" && !!process.env.OPENAI_API_KEY;

    if (isRealMode) {
        return buildBriefingWithAI(session, assessment, roi, proposal, strategy);
    }

    return buildBriefingStub(session, assessment, roi, proposal, strategy);
}

// ─── STUB Mode ────────────────────────────────────────────────────────────────

function buildBriefingStub(
    session: any,
    assessment: any,
    roi: any,
    proposal: any,
    strategy: {
        followUpTone: string | null;
        urgencyLevel: number | null;
        recommendedCTA: string | null;
        proposalStructure: string | null;
    },
): BriefingOutput {
    const tier = (session.priorityTier || "cold") as string;
    const company = assessment?.company || "Empresa não identificada";
    const leadName = assessment?.name || session.leadEmail;
    const email = session.leadEmail;
    const closePct = Math.round((session.closeProbability || 0) * 100);
    const revenue = session.revenueScore ? `R$${session.revenueScore.toFixed(0)}` : "—";

    const startTime = new Date(session.startAt).toLocaleString("pt-BR", {
        timeZone: session.timezone || "America/Sao_Paulo",
        hour: "2-digit", minute: "2-digit",
        day: "2-digit", month: "short",
    });

    const meetLink = session.meetingUrl ? `\n🔗 ${session.meetingUrl}` : "";

    const roiBlock = roi
        ? `📊 *ROI Estimado*\n• Economia anual: R$${(roi.calculatedSavings || 0).toFixed(0)}\n• Payback: ${roi.paybackMonths || "?"}m\n• ROI anual: R$${(roi.annualROI || 0).toFixed(0)}`
        : "📊 *ROI:* Nenhuma estimativa gerada ainda.";

    const proposalBlock = proposal
        ? `📄 *Proposta:* ${proposal.status} (v${proposal.version || 1})`
        : "📄 *Proposta:* Nenhuma gerada ainda.";

    const pains = assessment?.painPoints
        ? `😣 *Dores declaradas:*\n${(Array.isArray(assessment.painPoints) ? assessment.painPoints : [assessment.painPoints]).map((p: string) => `• ${p}`).join("\n")}`
        : "😣 *Dores:* Não mapeadas no Assessment.";

    const questions = (QUESTIONS_BY_TIER[tier] || QUESTIONS_BY_TIER.cold).join("\n");
    const tierCloseStrategy = (CLOSE_STRATEGY_BY_TIER[tier] || CLOSE_STRATEGY_BY_TIER.cold).join("\n");

    const tierEmoji = tier === "hot" ? "🔥" : tier === "warm" ? "🌡" : "❄️";

    // V17: Strategy Playbook section (present only if brainCycle has run)
    const strategySection = buildStrategySection({
        followUpTone: (strategy.followUpTone as any) ?? "consultative",
        urgencyLevel: strategy.urgencyLevel ?? 3,
        recommendedCTA: strategy.recommendedCTA ?? "schedule",
        proposalStructure: strategy.proposalStructure ?? "compact",
    });

    const text = [
        `🧠 *BRIEFING — ${startTime}*${meetLink}`,
        ``,
        `👤 *Lead:* ${leadName} (${email})`,
        `🏢 *Empresa:* ${company}`,
        `${tierEmoji} *Tier:* ${tier.toUpperCase()} | Prob. fechamento: ${closePct}% | Receita pot.: ${revenue}`,
        ``,
        roiBlock,
        ``,
        proposalBlock,
        ``,
        pains,
        ``,
        `❓ *7 Perguntas Estratégicas:*`,
        questions,
        ``,
        `🎯 *Estratégia de Fechamento (${tier}):*`,
        tierCloseStrategy,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        strategySection,
        ``,
        `---`,
        `_Briefing gerado automaticamente pela InovaCortex. Modo: STUB._`,
    ].join("\n");

    return { text, stub: true };
}

// ─── REAL Mode (OpenAI) ───────────────────────────────────────────────────────

async function buildBriefingWithAI(
    session: any,
    assessment: any,
    roi: any,
    proposal: any,
    strategy: {
        followUpTone: string | null;
        urgencyLevel: number | null;
        recommendedCTA: string | null;
        proposalStructure: string | null;
    },
): Promise<BriefingOutput> {
    // Summarize inputs for prompt (no raw tokens/passwords)
    const context = {
        company: assessment?.company ?? "não informado",
        leadName: assessment?.name ?? session.leadEmail,
        tier: session.priorityTier ?? "cold",
        closeProbability: Math.round((session.closeProbability ?? 0) * 100),
        adjustedProbability: Math.round((session.adjustedProbability ?? 0) * 100),
        revenueScore: session.revenueScore ?? 0,
        painPoints: assessment?.painPoints ?? [],
        roiSavings: roi?.operationalSavingsEstimate ?? 0,
        roiPayback: roi?.estimatedPaybackMonths ?? null,
        proposalStatus: proposal?.status ?? null,
        startAt: new Date(session.startAt).toISOString(),
        // V17 strategy output
        strategyTone: strategy.followUpTone ?? "consultative",
        urgencyLevel: strategy.urgencyLevel ?? 3,
        recommendedCTA: strategy.recommendedCTA ?? "schedule",
        proposalStructure: strategy.proposalStructure ?? "compact",
    };

    const prompt = [
        "Você é um coach de vendas consultivas para SaaS B2B.",
        "Gere um briefing CURTO (máx 500 palavras) para o consultor antes da reunião.",
        "Inclua: resumo do lead, dores, ROI estimado, 7 perguntas estratégicas, 3 bullets de estratégia de fechamento.",
        "Inclua também uma seção '💡 Estratégia recomendada' com: tom do follow-up, nível de urgência (1-5), CTA recomendado, estrutura de proposta sugerida e 3 frases curtas de fechamento no tom indicado.",
        "NUNCA prometa resultados impossíveis. NUNCA faça pressão agressiva. Cada frase de fechamento deve oferecer uma próxima ação clara.",
        "NUNCA exponha dados sensíveis.",
        "Responda em português BR. Formato compatível com WhatsApp (use emojis e *negrito*).",
        "",
        "Contexto:",
        JSON.stringify(context, null, 2),
    ].join("\n");

    try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 700,
                temperature: 0.5,
            }),
        });

        const data = await res.json() as any;
        if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`);

        const text = data.choices?.[0]?.message?.content ?? "";
        const tokensIn = data.usage?.prompt_tokens ?? 0;
        const tokensOut = data.usage?.completion_tokens ?? 0;
        const costUsd = (tokensIn * 0.00000015) + (tokensOut * 0.0000006); // gpt-4o-mini pricing

        return { text, stub: false, tokensUsed: tokensIn + tokensOut, costUsd };

    } catch (err: any) {
        // Graceful fallback to stub if AI fails
        const stub = buildBriefingStub(session, assessment, roi, proposal, strategy);
        stub.text = `⚠️ AI indisponível — briefing automático:\n\n${stub.text}`;
        return stub;
    }
}
