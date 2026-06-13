import { prisma } from "@/lib/prisma";
import { buildTenantRevenueSignals, type TenantRevenueSignals } from "@/lib/commercial/revenue-engine";
import { parseWorkspaceMetadata } from "./crm-workspace";

type OperatorTone = "neutral" | "positive" | "warning" | "critical";

export interface OperatorSurfaceMetric {
    id: string;
    label: string;
    value: string;
    detail: string;
    tone: OperatorTone;
}

export interface OperatorSurfaceWorkItem {
    id: string;
    title: string;
    detail: string;
    eyebrow: string;
    href: string;
    tone: OperatorTone;
}

export interface OperatorSurfaceSection {
    title: string;
    description: string;
    focus: string;
    metrics: OperatorSurfaceMetric[];
    items: OperatorSurfaceWorkItem[];
}

export interface OperatorSurfaceModel {
    generatedAt: string;
    overview: {
        headline: string;
        subheadline: string;
        tone: OperatorTone;
        summary: string;
        focusNow: string[];
    };
    operationalDay: OperatorSurfaceSection;
    agenda: OperatorSurfaceSection;
    close: OperatorSurfaceSection;
    revenue: OperatorSurfaceSection;
    proposals: OperatorSurfaceSection;
    followUps: OperatorSurfaceSection;
    loss: OperatorSurfaceSection;
    queue: OperatorSurfaceSection;
    warnings: string[];
}

export interface OperatorSurfaceOverviewInput {
    orgSlug: string;
    orgName: string;
    openLeads: number;
    hotLeads: number;
    staleProposals: number;
    overdueTasks: number;
    dueTodayTasks: number;
    pendingActions: number;
    unreadConversations: number;
    upcomingMeetings: number;
    openWorkspaces: number;
    activeOutboundSequences: number;
    todayContentItems: number;
    hotLeadItems: Array<{
        id: string;
        company: string;
        scoreTotal: number;
        status: string;
    }>;
    staleProposalItems: Array<{
        id: string;
        assessmentId: string | null;
        company: string;
        updatedAt: string;
    }>;
    closeItems: Array<{
        id: string;
        assessmentId: string;
        company: string;
        blocker: string;
        valueCents: number;
        updatedAt: string;
    }>;
    agendaItems: Array<{
        id: string;
        leadLabel: string;
        startAt: string;
        status: string;
        assessmentId: string | null;
        isPrepared: boolean;
        isMissingFollowUp: boolean;
    }>;
    overdueTaskItems: Array<{
        id: string;
        title: string;
        dueAt: string | null;
        workspaceId: string;
    }>;
    queueItems: Array<{
        id: string;
        title: string;
        detail: string;
        eyebrow: string;
        href: string;
        tone: OperatorTone;
    }>;
    lossItems: Array<{
        id: string;
        assessmentId: string;
        company: string;
        reason: string | null;
        stage: string;
        updatedAt: string;
        isRecoverable: boolean;
        valueCents: number;
    }>;
    revenueSignals?: TenantRevenueSignals;
}

function formatDate(value: string): string {
    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
    }).format(new Date(value));
}

function formatDateTime(value: string): string {
    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(new Date(value));
}

function buildFocusNow(input: OperatorSurfaceOverviewInput): string[] {
    const items: string[] = [];

    if (input.staleProposals > 0) {
        items.push(`Atacar ${input.staleProposals} proposta${input.staleProposals === 1 ? "" : "s"} parada${input.staleProposals === 1 ? "" : "s"} antes de abrir nova frente.`);
    }

    if ((input.revenueSignals?.estimatedRevenueAtRiskCents ?? 0) > 0) {
        items.push(`Proteger ${new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
            maximumFractionDigits: 0,
        }).format((input.revenueSignals?.estimatedRevenueAtRiskCents ?? 0) / 100)} em receita com follow-up curto e dono claro.`);
    }

    if (input.overdueTasks > 0) {
        items.push(`Desbloquear ${input.overdueTasks} tarefa${input.overdueTasks === 1 ? "" : "s"} atrasada${input.overdueTasks === 1 ? "" : "s"} na fila operacional.`);
    }

    if (input.unreadConversations > 0 || input.pendingActions > 0) {
        items.push(`Responder inbox e action queue: ${input.unreadConversations} conversa${input.unreadConversations === 1 ? "" : "s"} pendente${input.unreadConversations === 1 ? "" : "s"} e ${input.pendingActions} acao${input.pendingActions === 1 ? "" : "es"} aberta${input.pendingActions === 1 ? "" : "s"}.`);
    }

    if (input.upcomingMeetings > 0) {
        items.push(`Proteger ${input.upcomingMeetings} reuniao${input.upcomingMeetings === 1 ? "" : "es"} do curto prazo para manter ritmo do dia.`);
    }

    if (items.length === 0) {
        items.push("A operacao esta calma, com baixa pressao imediata e sem sinais fortes de atraso.");
    }

    return items.slice(0, 4);
}

function resolveOverviewTone(input: OperatorSurfaceOverviewInput): OperatorTone {
    if (input.overdueTasks >= 4 || input.staleProposals >= 3 || (input.unreadConversations + input.pendingActions) >= 10) {
        return "critical";
    }

    if (input.overdueTasks > 0 || input.staleProposals > 0 || input.unreadConversations > 0 || input.pendingActions > 0) {
        return "warning";
    }

    if (input.upcomingMeetings > 0 || input.hotLeads > 0 || input.openLeads > 0) {
        return "positive";
    }

    return "neutral";
}

function buildRevenueQueueItems(orgSlug: string, revenueSignals?: TenantRevenueSignals): OperatorSurfaceWorkItem[] {
    if (!revenueSignals) return [];

    const urgentItems: OperatorSurfaceWorkItem[] = [];

    for (const opportunity of revenueSignals.topAtRiskOpportunities.slice(0, 3)) {
        urgentItems.push({
            id: `revenue-risk-${opportunity.assessmentId}`,
            title: `${opportunity.company} (Risco: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(opportunity.estimatedValueCents / 100)})`,
            detail: `${opportunity.reason} ${opportunity.recommendedAction}`,
            eyebrow: "receita em risco",
            href: opportunity.conversationId
                ? `/org/${orgSlug}/admin/whatsapp?conversationId=${opportunity.conversationId}`
                : `/org/${orgSlug}/admin/crm?assessmentId=${opportunity.assessmentId}`,
            tone: "critical",
        });
    }

    if (revenueSignals.proposalsWithoutResponse.count > 0) {
        urgentItems.push({
            id: "revenue-risk-proposals-without-response",
            title: `${revenueSignals.proposalsWithoutResponse.count} proposta(s) sem resposta`,
            detail: `Reengajar em até ${revenueSignals.proposalsWithoutResponse.thresholdDays} dias.`,
            eyebrow: "proposta sem resposta",
            href: `/org/${orgSlug}/admin/crm?view=stalled-proposals`,
            tone: "warning",
        });
    }

    if (revenueSignals.stalledProposals.count > 0) {
        urgentItems.push({
            id: "revenue-risk-stalled-proposals",
            title: `${revenueSignals.stalledProposals.count} proposta(s) travadas`,
            detail: `Valor: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(revenueSignals.stalledProposals.valueCents / 100)}`,
            eyebrow: "proposta travada",
            href: `/org/${orgSlug}/admin/crm?view=stalled-proposals`,
            tone: "critical",
        });
    }

    if (revenueSignals.mostStagnantStage) {
        urgentItems.push({
            id: "revenue-risk-stagnant-stage",
            title: `Estagnacao na etapa ${revenueSignals.mostStagnantStage.stageLabel}`,
            detail: `${revenueSignals.mostStagnantStage.stalledCount} deal(s) parados`,
            eyebrow: "estagio estagnado",
            href: `/org/${orgSlug}/admin/crm?view=pipeline`,
            tone: "warning",
        });
    }

    if (revenueSignals.riskByOwner.length > 0) {
        const topOwner = revenueSignals.riskByOwner[0];
        urgentItems.push({
            id: "revenue-risk-top-owner",
            title: `${topOwner.ownerLabel} concentra ${Math.round(topOwner.riskShare * 100)}% do risco`,
            detail: `${topOwner.count} oportunid. · ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(topOwner.valueCents / 100)}`,
            eyebrow: "concentracao por responsavel",
            href: `/org/${orgSlug}/admin/crm?view=follow-up&owner=${encodeURIComponent(topOwner.ownerLabel)}`,
            tone: "warning",
        });
    }

    if (revenueSignals.riskByStage.length > 0) {
        const topStage = revenueSignals.riskByStage[0];
        urgentItems.push({
            id: "revenue-risk-top-stage",
            title: `${topStage.stageLabel} concentra ${Math.round(topStage.riskShare * 100)}% do risco`,
            detail: `${topStage.count} oportunid. · ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(topStage.valueCents / 100)}`,
            eyebrow: "concentracao por etapa",
            href: `/org/${orgSlug}/admin/crm?view=pipeline&stage=${encodeURIComponent(topStage.stageLabel)}`,
            tone: "warning",
        });
    }

    return urgentItems.slice(0, 6);
}

function buildLossMetrics(input: OperatorSurfaceOverviewInput): OperatorSurfaceMetric[] {
    const totalLost = input.lossItems?.length || 0;
    const recoverableItems = input.lossItems?.filter((i) => i.isRecoverable) || [];
    const recoverableCount = recoverableItems.length;

    const reasonCounts: Record<string, number> = {};
    input.lossItems?.forEach((item) => {
        const reason = item.reason || "desconhecido";
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });

    let dominantReason = "-";
    let maxCount = 0;
    for (const [reason, count] of Object.entries(reasonCounts)) {
        if (count > maxCount) {
            maxCount = count;
            dominantReason = reason;
        }
    }

    const metrics: OperatorSurfaceMetric[] = [
        {
            id: "lost-total",
            label: "Perdas recentes",
            value: String(totalLost),
            detail: `${recoverableCount} com sinal de recuperacao`,
            tone: recoverableCount > 0 ? "warning" : "neutral",
        },
    ];

    if (totalLost > 0) {
        metrics.push({
            id: "dominant-reason",
            label: "Motivo dominante",
            value: dominantReason.toUpperCase(),
            detail: `${maxCount} ocorrências registradas`,
            tone: "neutral",
        });
    }

    return metrics;
}

function buildLossQueueWorkItems(input: OperatorSurfaceOverviewInput): OperatorSurfaceWorkItem[] {
    return (input.lossItems || []).slice(0, 6).map((item) => ({
        id: `loss-${item.id}`,
        title: item.company,
        detail: item.isRecoverable
            ? `Recuperacao plausível: ${item.reason || "S/ motivo"} em ${item.stage}.`
            : `Perda: ${item.reason || "S/ motivo"} em ${item.stage}.`,
        eyebrow: item.isRecoverable ? "recuperar" : "perda registrada",
        href: `/org/${input.orgSlug}/admin/crm?assessmentId=${item.assessmentId}`,
        tone: (item.isRecoverable ? "warning" : "neutral") as OperatorTone,
    }));
}

export function buildOperatorSurfaceModel(input: OperatorSurfaceOverviewInput): OperatorSurfaceModel {
    const tone = resolveOverviewTone(input);
    const warnings: string[] = [];

    if (input.hotLeadItems.length === 0 && input.staleProposalItems.length === 0) {
        warnings.push("Ainda nao ha follow-ups fortes o suficiente para destacar prioridades comerciais mais densas.");
    }
    if ((input.revenueSignals?.estimatedOpenRevenueCents ?? 0) <= 0) {
        warnings.push("A leitura de revenue ainda esta rasa no tenant porque o pipeline aberto nao carrega valor estimado suficiente.");
    }

    if (input.overdueTaskItems.length === 0 && input.agendaItems.length === 0 && input.queueItems.length === 0) {
        warnings.push("A trilha operacional imediata ainda esta rasa, entao a home mostra apenas sinais honestos do que existe.");
    }

    return {
        generatedAt: new Date().toISOString(),
        overview: {
            headline: `Cockpit operacional de ${input.orgName}`,
            subheadline: "A home do Operator existe para executar o dia: follow-up, agenda, fila, inbox e pendencias. Nao e uma leitura de BI executivo nem um admin da plataforma.",
            tone,
            summary: tone === "critical"
                ? "A operacao do dia esta pressionada por atrasos, follow-ups parados ou fila acumulada. O foco e agir, nao analisar."
                : tone === "warning"
                    ? "Ha pendencias concretas exigindo toque operacional agora. A pagina prioriza o que precisa sair do estado de espera."
                    : tone === "positive"
                        ? "A operacao tem tracao e proximo passo claro, com fila controlada e agenda util para hoje."
                        : "A operacao esta conectada, mas ainda sem massa suficiente para um cockpit mais carregado.",
            focusNow: buildFocusNow(input),
        },
        operationalDay: {
            title: "Resumo operacional do dia",
            description: "Leitura curta do que esta aberto, vencendo e vindo na agenda imediata.",
            focus: input.upcomingMeetings > 0
                ? "Comecar pela agenda curta e preservar resposta rapida para nao perder ritmo."
                : input.overdueTasks > 0
                    ? "Limpar atraso operacional antes de puxar trabalho novo."
                    : "A rotina esta sob controle e permite concentrar energia nos proximos follow-ups.",
            metrics: [
                {
                    id: "open-leads",
                    label: "Leads em operacao",
                    value: String(input.openLeads),
                    detail: `${input.hotLeads} com calor comercial imediato`,
                    tone: input.hotLeads > 0 ? "positive" : input.openLeads > 0 ? "neutral" : "warning",
                },
                {
                    id: "agenda",
                    label: "Agenda imediata",
                    value: String(input.upcomingMeetings),
                    detail: `${input.dueTodayTasks} tarefa${input.dueTodayTasks === 1 ? "" : "s"} vencendo hoje`,
                    tone: input.upcomingMeetings > 0 || input.dueTodayTasks > 0 ? "positive" : "neutral",
                },
                {
                    id: "followup-risk",
                    label: "Follow-up em risco",
                    value: String(input.staleProposals),
                    detail: "propostas sem toque recente",
                    tone: input.staleProposals > 0 ? "warning" : "positive",
                },
                {
                    id: "backlog",
                    label: "Fila operacional",
                    value: String(input.overdueTasks + input.pendingActions + input.unreadConversations),
                    detail: `${input.overdueTasks} atrasadas + ${input.pendingActions} acoes + ${input.unreadConversations} inbox`,
                    tone: input.overdueTasks > 0 ? "critical" : (input.pendingActions + input.unreadConversations) > 0 ? "warning" : "positive",
                },
            ],
            items: [
                ...input.overdueTaskItems.map((task) => ({
                    id: `task-${task.id}`,
                    title: task.title,
                    detail: task.dueAt
                        ? `Tarefa vencida desde ${formatDate(task.dueAt)}.`
                        : "Tarefa sem due date, mas ainda presa na fila.",
                    eyebrow: "atraso operacional",
                    href: task.workspaceId ? `/org/${input.orgSlug}/admin/workspaces/${task.workspaceId}` : `/org/${input.orgSlug}/admin/workspaces`,
                    tone: "critical" as OperatorTone,
                })),
                ...input.agendaItems.slice(0, 3).map((meeting) => ({
                    id: `meeting-${meeting.id}`,
                    title: meeting.leadLabel,
                    detail: meeting.status === "scheduled" && !meeting.isPrepared
                        ? "Falta preparacao antes da agenda."
                        : `Reuniao marcada para ${formatDateTime(meeting.startAt)}.`,
                    eyebrow: "agenda",
                    href: meeting.assessmentId ? `/org/${input.orgSlug}/admin/crm?assessmentId=${meeting.assessmentId}` : "#agenda",
                    tone: (!meeting.isPrepared && meeting.status === "scheduled") ? "warning" : "positive" as OperatorTone,
                })),
            ].slice(0, 6),
        },
        agenda: {
            title: "Meetings & Agenda",
            description: "Fila de agendas, cobranca de preparacao e registros pos-reuniao.",
            focus: input.agendaItems.some((m) => m.isMissingFollowUp)
                ? "Registrar resultado e mandar follow-up das reunioes concluidas para nao perder o timing."
                : input.agendaItems.some((m) => !m.isPrepared && m.status === "scheduled")
                    ? "Alinhar material e roteiro das proximas agendas confirmadas."
                    : "Manter ritmo nas conversas abertas; agenda esta controlada.",
            metrics: [
                {
                    id: "meetings-today",
                    label: "Agendas vivas",
                    value: String(input.agendaItems.filter((m) => m.status === "scheduled").length),
                    detail: "reunioes abertas na fila",
                    tone: input.agendaItems.some((m) => !m.isPrepared && m.status === "scheduled") ? "warning" : "positive",
                },
                {
                    id: "meetings-missing-prep",
                    label: "Sem preparo",
                    value: String(input.agendaItems.filter((m) => !m.isPrepared && m.status === "scheduled").length),
                    detail: "agendas esperando preparacao",
                    tone: input.agendaItems.filter((m) => !m.isPrepared && m.status === "scheduled").length > 0 ? "warning" : "positive",
                },
                {
                    id: "meetings-missing-followup",
                    label: "Sem follow-up",
                    value: String(input.agendaItems.filter((m) => m.isMissingFollowUp).length),
                    detail: "passaram da hora sem registro",
                    tone: input.agendaItems.filter((m) => m.isMissingFollowUp).length > 0 ? "critical" : "positive",
                },
            ],
            items: input.agendaItems.map((meeting) => ({
                id: `agenda-${meeting.id}`,
                title: meeting.leadLabel,
                detail: meeting.isMissingFollowUp
                    ? `Ocorreu as ${formatDateTime(meeting.startAt)}. Falta registrar resultado.`
                    : !meeting.isPrepared
                        ? `Marcada para as ${formatDateTime(meeting.startAt)}. Exige pauta/preparacao.`
                        : `Marcada as ${formatDateTime(meeting.startAt)}. Confirmar presenca.`,
                eyebrow: meeting.isMissingFollowUp ? "sem follow-up" : !meeting.isPrepared ? "sem preparacao" : "reuniao proxima",
                href: meeting.assessmentId
                    ? `/org/${input.orgSlug}/admin/crm?assessmentId=${meeting.assessmentId}`
                    : `/org/${input.orgSlug}/admin`,
                tone: (meeting.isMissingFollowUp ? "critical" : !meeting.isPrepared ? "warning" : "neutral") as OperatorTone,
            })),
        },
        close: {
            title: "Sales & Close Queue",
            description: "Oportunidades em fase final exigindo quebra de objeção, nova reunião ou decisão definitiva.",
            focus: input.closeItems.length > 0
                ? "Cobrar resposta e propor fechamento nas oportunidades paradas antes de perder timing."
                : "Funil de fechamento vazio. Trabalhar o proposal queue para encher o topo.",
            metrics: [
                {
                    id: "close-queue-total",
                    label: "Oportunidades quentes",
                    value: String(input.closeItems.length),
                    detail: "em vias de decisão",
                    tone: input.closeItems.length > 0 ? "warning" : "neutral",
                },
                {
                    id: "close-queue-value",
                    label: "Receita na mesa",
                    value: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(
                        input.closeItems.reduce((acc, item) => acc + item.valueCents, 0) / 100
                    ),
                    detail: "dependendo de follow-up final",
                    tone: input.closeItems.length > 0 ? "warning" : "positive",
                },
            ],
            items: input.closeItems.slice(0, 6).map((item) => ({
                id: `close-${item.id}`,
                title: `${item.company}`,
                detail: `Bloqueio: ${item.blocker} — ${item.valueCents > 0 ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(item.valueCents / 100) : "TBD"}`,
                eyebrow: "acao de fechamento",
                href: `/org/${input.orgSlug}/admin/crm?assessmentId=${item.assessmentId}`,
                tone: "critical" as OperatorTone,
            })),
        },
        loss: {
            title: "Loss Intelligence",
            description: "Análise operacional de perdas e shortlist de recuperação comercial.",
            focus: input.lossItems?.some((item) => item.isRecoverable)
                ? "Atacar shortlist de recuperação nas perdas com alto potencial de volta."
                : "Rever motivos de perda dominantes para ajustar playbook da próxima etapa.",
            metrics: buildLossMetrics(input),
            items: buildLossQueueWorkItems(input),
        },
        revenue: {
            title: "Revenue Queue",
            description: "Oportunidades em risco e paralisias de pipeline comercial que precisam de desbloqueio.",
            focus: (input.revenueSignals?.estimatedRevenueAtRiskCents ?? 0) > 0
                ? "Atacar os deals de alto valor que estao alertando risco antes de tentar gerar nova demanda."
                : "Sem pressao imediata no pipeline aberto. Manter cadencia de execucao.",
            metrics: [
                {
                    id: "revenue-at-risk",
                    label: "Receita em risco",
                    value: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format((input.revenueSignals?.estimatedRevenueAtRiskCents ?? 0) / 100),
                    detail: "valor estimado parado",
                    tone: (input.revenueSignals?.estimatedRevenueAtRiskCents ?? 0) > 0 ? "warning" : "positive",
                },
                {
                    id: "inactive-deals",
                    label: "Deals inativos",
                    value: String(input.revenueSignals?.inactiveDeals.count ?? 0),
                    detail: "sem conversacao recente",
                    tone: (input.revenueSignals?.inactiveDeals.count ?? 0) > 0 ? "warning" : "positive",
                },
            ],
            items: (input.revenueSignals?.topAtRiskOpportunities ?? []).slice(0, 4).map((opp) => ({
                id: `revenue-risk-${opp.assessmentId}`,
                title: `${opp.company} (Risco: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(opp.estimatedValueCents / 100)})`,
                detail: `${opp.reason} ${opp.recommendedAction}`,
                eyebrow: "receita em risco",
                href: opp.conversationId
                    ? `/org/${input.orgSlug}/admin/whatsapp?conversationId=${opp.conversationId}`
                    : `/org/${input.orgSlug}/admin/crm?assessmentId=${opp.assessmentId}`,
                tone: "critical" as OperatorTone,
            })),
        },
        proposals: {
            title: "Proposal Queue",
            description: "Propostas enviadas ou visualizadas que exigem cobranca para evitar estagnacao.",
            focus: input.staleProposals > 0
                ? "Focar nas propostas paradas para evitar perda silenciosa. Mandar mensagem de follow-up."
                : "Nenhuma pressao imediata nas propostas enviadas. Usar o tempo em deals abertos.",
            metrics: [
                {
                    id: "stalled-proposals",
                    label: "Propostas travadas",
                    value: String(input.revenueSignals?.stalledProposals.count ?? 0),
                    detail: "em status passivo longo",
                    tone: (input.revenueSignals?.stalledProposals.count ?? 0) > 0 ? "critical" : "positive",
                },
                {
                    id: "no-response-proposals",
                    label: "Sem resposta",
                    value: String(input.revenueSignals?.proposalsWithoutResponse.count ?? 0),
                    detail: "fora da SLA ideal",
                    tone: (input.revenueSignals?.proposalsWithoutResponse.count ?? 0) > 0 ? "warning" : "positive",
                },
            ],
            items: input.staleProposalItems.map((proposal) => ({
                id: `proposal-${proposal.id}`,
                title: proposal.company,
                detail: `Sem follow-up desde ${formatDate(proposal.updatedAt)}.`,
                eyebrow: "proposta parada",
                href: `/org/${input.orgSlug}/admin/crm?view=stalled-proposals`,
                tone: "warning" as OperatorTone,
            })),
        },
        followUps: {
            title: "Follow-ups prioritarios",
            description: "O que exige toque comercial ou resposta humana imediata devido a calor na operacao.",
            focus: input.hotLeads > 0
                ? "Converter os leads mais quentes enquanto o timing ainda favorece."
                : "Sem follow-up de calor imediato agora; manter a disciplina da rotina geral.",
            metrics: [
                {
                    id: "hot-leads",
                    label: "Hot leads",
                    value: String(input.hotLeads),
                    detail: "assessments com score alto",
                    tone: input.hotLeads > 0 ? "positive" : "neutral",
                },
                {
                    id: "outbound-active",
                    label: "Sequencias ativas",
                    value: String(input.activeOutboundSequences),
                    detail: "cadencias ativas no outbound",
                    tone: input.activeOutboundSequences > 0 ? "neutral" : "neutral",
                },
                {
                    id: "content-today",
                    label: "Conteudo na vez",
                    value: String(input.todayContentItems),
                    detail: "itens prontos/programados",
                    tone: input.todayContentItems > 0 ? "positive" : "neutral",
                },
            ],
            items: input.hotLeadItems.map((lead) => ({
                id: `lead-${lead.id}`,
                title: lead.company,
                detail: `Score total ${lead.scoreTotal} em status ${lead.status}. Exige atencao proativa.`,
                eyebrow: "lead quente",
                href: `/org/${input.orgSlug}/admin/crm`,
                tone: "positive" as OperatorTone,
            })),
        },
        queue: {
            title: "Fila e pendencias",
            description: "Inbox, action queue, execucao de workspace e o proximo passo da rotina.",
            focus: input.unreadConversations > 0
                ? "Comecar pela inbox para reduzir tempo de resposta e destravar frentes."
                : input.pendingActions > 0
                    ? "Consumir a action queue antes de abrir novas frentes taticas."
                    : input.openWorkspaces > 0
                        ? "Manter o delivery fluindo sem atritos longos."
                        : "Fila de operacao tecnica limpa no momento.",
            metrics: [
                {
                    id: "inbox",
                    label: "Inbox pendente",
                    value: String(input.unreadConversations),
                    detail: "conversas pendentes",
                    tone: input.unreadConversations > 0 ? "warning" : "positive",
                },
                {
                    id: "actions",
                    label: "Action queue",
                    value: String(input.pendingActions),
                    detail: "itens para execucao no app",
                    tone: input.pendingActions > 0 ? "warning" : "positive",
                },
                {
                    id: "overdue",
                    label: "Atrasos",
                    value: String(input.overdueTasks),
                    detail: "tarefas vencidas no delivery",
                    tone: input.overdueTasks > 0 ? "critical" : "positive",
                },
                {
                    id: "workspaces",
                    label: "Workspaces ativos",
                    value: String(input.openWorkspaces),
                    detail: "delivery em curso",
                    tone: input.openWorkspaces > 0 ? "neutral" : "neutral",
                },
            ],
            items: input.queueItems.slice(0, 8),
        },
        warnings,
    };
}

export async function buildOperatorSurfaceOverview(orgId: string, orgSlug: string, orgName: string): Promise<OperatorSurfaceModel> {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);
    const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const db = prisma as any;

    const [
        revenueSignals,
        assessments,
        staleProposalRows,
        overdueTaskRows,
        dueTodayTasks,
        pendingActions,
        unreadConversations,
        upcomingMeetingRows,
        openWorkspaces,
        activeOutboundSequences,
        todayContentItems,
        lostAssessments,
    ] = await Promise.all([
        buildTenantRevenueSignals(orgId),
        db.assessment.findMany({
            where: { organizationId: orgId },
            orderBy: { createdAt: "desc" },
            take: 200,
            select: {
                id: true,
                company: true,
                scoreTotal: true,
                status: true,
            },
        }),
        db.proposal.findMany({
            where: {
                organizationId: orgId,
                status: { in: ["sent", "viewed"] },
                updatedAt: { lt: seventyTwoHoursAgo },
            },
            orderBy: { updatedAt: "asc" },
            take: 4,
            select: {
                id: true,
                updatedAt: true,
                assessmentId: true,
                assessment: {
                    select: {
                        company: true,
                    },
                },
            },
        }),
        db.implementationTask.findMany({
            where: {
                organizationId: orgId,
                status: { in: ["todo", "doing", "blocked"] },
                dueAt: { lt: startOfDay },
            },
            orderBy: { dueAt: "asc" },
            take: 4,
            select: {
                id: true,
                title: true,
                dueAt: true,
                workspaceId: true,
            },
        }),
        db.implementationTask.count({
            where: {
                organizationId: orgId,
                status: { in: ["todo", "doing", "blocked"] },
                dueAt: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
        }),
        db.actionQueue.count({
            where: {
                organizationId: orgId,
                status: "pending",
            },
        }),
        db.whatsAppConversation.count({
            where: {
                organizationId: orgId,
                unreadCount: { gt: 0 },
            },
        }),
        db.meetingSession.findMany({
            where: {
                organizationId: orgId,
                status: { in: ["scheduled", "completed"] },
                startAt: {
                    gte: seventyTwoHoursAgo,
                    lte: sevenDaysAhead,
                },
            },
            orderBy: { startAt: "asc" },
            take: 15,
            select: {
                id: true,
                leadEmail: true,
                startAt: true,
                status: true,
                assessmentId: true,
                proposalStructure: true,
                expectedRevenue: true,
            },
        }),
        db.clientWorkspace.count({
            where: {
                organizationId: orgId,
                status: { in: ["provisioning", "active", "paused"] },
            },
        }),
        db.outboundSequence.count({
            where: {
                orgId,
                stage: { not: "done" },
            },
        }).catch(() => 0),
        db.marketingPlan.count({
            where: {
                orgId,
                OR: [
                    {
                        scheduledFor: {
                            gte: startOfDay,
                            lte: endOfDay,
                        },
                    },
                    {
                        status: { in: ["approved", "ready_to_post"] },
                    },
                ],
            },
        }).catch(() => 0),
        db.assessment.findMany({
            where: {
                organizationId: orgId,
                status: { in: ["Perdido", "Lost", "perdido", "lost", "rejeitado", "rejected"] },
                updatedAt: { gte: seventyTwoHoursAgo },
            },
            orderBy: { updatedAt: "desc" },
            take: 10,
            select: {
                id: true,
                company: true,
                status: true,
                internalNotes: true,
                updatedAt: true,
            },
        }).catch(() => []),
    ]);

    const openLeads = assessments.filter((assessment: { status: string }) => String(assessment.status).toLowerCase() !== "fechado").length;
    const hotLeadItems = assessments
        .filter((assessment: { scoreTotal: number }) => assessment.scoreTotal >= 70)
        .slice(0, 4)
        .map((assessment: { id: string; company: string; scoreTotal: number; status: string }) => ({
            id: assessment.id,
            company: assessment.company || "Lead sem empresa",
            scoreTotal: assessment.scoreTotal,
            status: assessment.status,
        }));

    const staleProposalItems = staleProposalRows.map((proposal: { id: string; updatedAt: Date; assessmentId: string | null; assessment: { company: string | null } | null }) => ({
        id: proposal.id,
        assessmentId: proposal.assessmentId,
        company: proposal.assessment?.company ?? "Lead sem empresa",
        updatedAt: proposal.updatedAt.toISOString(),
    }));

    const agendaItems = upcomingMeetingRows.map((meeting: { id: string; leadEmail: string; startAt: Date; status: string; assessmentId: string | null; proposalStructure: string | null; expectedRevenue: number | null }) => {
        const isPrepared = meeting.proposalStructure !== null || meeting.expectedRevenue !== null;
        const isMissingFollowUp = meeting.status === "completed" && !meeting.expectedRevenue; // Rough proxy for missing follow-up if DB doesn't track explicitly here
        
        return {
            id: meeting.id,
            leadLabel: meeting.leadEmail,
            startAt: meeting.startAt.toISOString(),
            status: meeting.status,
            assessmentId: meeting.assessmentId,
            isPrepared,
            isMissingFollowUp: meeting.status === "completed" || (meeting.status === "scheduled" && meeting.startAt < new Date()),
        };
    });

    const overdueTaskItems = overdueTaskRows.map((task: { id: string; title: string; dueAt: Date | null; workspaceId: string }) => ({
        id: task.id,
        title: task.title,
        dueAt: task.dueAt ? task.dueAt.toISOString() : null,
        workspaceId: task.workspaceId,
    }));

    const queueItems: OperatorSurfaceWorkItem[] = [
        ...overdueTaskItems.map((task: { id: string; title: string; dueAt: string | null; workspaceId: string }) => ({
            id: `queue-task-${task.id}`,
            title: task.title,
            detail: task.dueAt
                ? `Atrasada desde ${formatDate(task.dueAt)}.`
                : "Tarefa sem data, mas ainda aberta na fila.",
            eyebrow: "fila de execucao",
            href: `/org/${orgSlug}/admin/workspaces/${task.workspaceId}`,
            tone: "critical" as OperatorTone,
        })),
        ...(unreadConversations > 0
            ? [{
                id: "queue-inbox",
                title: "Inbox com pendencia",
                detail: `${unreadConversations} conversas com mensagens nao tratadas.`,
                eyebrow: "whatsapp crm",
                href: `/org/${orgSlug}/admin/whatsapp`,
                tone: "warning" as OperatorTone,
            }]
            : []),
        ...(pendingActions > 0
            ? [{
                id: "queue-actions",
                title: "Action queue aberta",
                detail: `${pendingActions} itens aguardando execucao no tenant.`,
                eyebrow: "command center",
                href: `/org/${orgSlug}/admin/command-center`,
                tone: "warning" as OperatorTone,
            }]
            : []),
        ...(openWorkspaces > 0
            ? [{
                id: "queue-workspaces",
                title: "Entrega em curso",
                detail: `${openWorkspaces} workspaces ativos em execucao.`,
                eyebrow: "delivery",
                href: `/org/${orgSlug}/admin/workspaces`,
                tone: "neutral" as OperatorTone,
            }]
            : []),
    ].slice(0, 6);

    const lossItems = lostAssessments.map((a: any) => {
        const meta = parseWorkspaceMetadata(a.internalNotes);
        const isRecoverable = meta.lostReason === "no-response" || meta.lostReason === "timing" || !meta.lostReason;
        
        return {
            id: a.id,
            assessmentId: a.id,
            company: a.company || "Sem nome",
            reason: meta.lostReason,
            stage: a.status,
            updatedAt: a.updatedAt.toISOString(),
            isRecoverable,
            valueCents: 0,
        };
    });

    const closeItems = [
        ...agendaItems.filter((m: any) => m.isMissingFollowUp && m.assessmentId).map((m: any) => ({
            id: m.id,
            assessmentId: m.assessmentId,
            company: m.leadLabel,
            blocker: "reuniao sem retorno",
            valueCents: m.expectedRevenue || 0,
            updatedAt: m.startAt,
        })),
        ...staleProposalItems.filter((p: any) => p.assessmentId).map((p: any) => ({
            id: p.id,
            assessmentId: p.assessmentId,
            company: p.company,
            blocker: "falta de resposta na proposta",
            valueCents: 0,
            updatedAt: p.updatedAt,
        })),
        ...(revenueSignals?.topAtRiskOpportunities || []).slice(0, 3).map((o: any) => ({
            id: o.assessmentId,
            assessmentId: o.assessmentId,
            company: o.company,
            blocker: o.reason || "decisao parada",
            valueCents: o.estimatedValueCents,
            updatedAt: o.lastTouchAt,
        })),
    ];

    return buildOperatorSurfaceModel({
        orgSlug,
        orgName,
        openLeads,
        hotLeads: hotLeadItems.length,
        staleProposals: staleProposalItems.length,
        overdueTasks: overdueTaskItems.length,
        dueTodayTasks,
        pendingActions,
        unreadConversations,
        upcomingMeetings: agendaItems.filter((m: any) => m.status === "scheduled").length,
        openWorkspaces,
        activeOutboundSequences,
        todayContentItems,
        hotLeadItems,
        staleProposalItems,
        closeItems,
        agendaItems,
        overdueTaskItems,
        queueItems,
        lossItems,
        revenueSignals,
    });
}
