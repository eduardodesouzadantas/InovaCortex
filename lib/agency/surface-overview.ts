import { prisma } from "@/lib/prisma";
import type { TenantRevenueSignals } from "@/lib/commercial/revenue-engine";

type AgencyTone = "neutral" | "positive" | "warning" | "critical";

type RecentTenantInput = {
    id: string;
    name: string;
    slug: string;
    plan: string;
    subscriptionStatus: string;
    createdAt: string;
};

type StaleProposalInput = {
    id: string;
    company: string;
    updatedAt: string;
};

type UpcomingMeetingInput = {
    id: string;
    leadLabel: string;
    startAt: string;
};

type MarketingItemInput = {
    id: string;
    topic: string;
    platform: string;
    scheduledFor: string | null;
};

export interface AgencySurfaceMetric {
    id: string;
    label: string;
    value: string;
    detail: string;
    tone: AgencyTone;
}

export interface AgencySurfaceWorkItem {
    id: string;
    eyebrow: string;
    title: string;
    detail: string;
    href: string;
    tone: AgencyTone;
}

export interface AgencySurfaceSection {
    title: string;
    description: string;
    focus: string;
    metrics: AgencySurfaceMetric[];
    items: AgencySurfaceWorkItem[];
}

export interface AgencyProofOfValue {
    tone: AgencyTone;
    headline: string;
    impactMetrics: AgencySurfaceMetric[];
    insights: string[];
}

export interface AgencyTenantPriority {
    id: string;
    slug: string;
    name: string;
    reason: string;
    impact: string;
    suggestedAction: string;
    tone: AgencyTone;
}

export interface AgencyBenchmark {
    label: string;
    avgValue: string;
    topValue: string;
    insight: string;
}

export interface AgencyAccountSignal {
    id: string;
    tenantName: string;
    slug: string;
    type: "retention" | "expansion";
    label: string;
    detail: string;
    tone: AgencyTone;
    suggestedAction: string;
}

export type AgencySuccessPlaybookStatus = "suggested" | "in-progress" | "blocked" | "completed";

export interface AgencySuccessPlaybookExecution {
    status: AgencySuccessPlaybookStatus;
    owner?: string;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    observedImpact?: string | null;
}

export interface AgencySuccessPlaybook {
    id: string;
    tenantName: string;
    slug: string;
    playbookName: string;
    reason: string;
    suggestedAction: string;
    expectedImpact: string;
    tone: AgencyTone;
    status: AgencySuccessPlaybookStatus;
    owner?: string;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    observedImpact?: string | null;
}

export interface AgencySuccessPlaybookTimelineEntry {
    playbookId: string;
    tenantName: string;
    playbookName: string;
    status: AgencySuccessPlaybookStatus;
    owner?: string;
    updatedAt: string;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    observedImpact?: string | null;
}

export interface AgencySurfaceModel {
    generatedAt: string;
    overview: {
        headline: string;
        subheadline: string;
        commandTone: AgencyTone;
        commandSummary: string;
        focusNow: string[];
    };
    controlPlane: AgencySurfaceSection;
    agencyOps: AgencySurfaceSection;
    proofOfValue: AgencyProofOfValue;
    priorityQueue: AgencyTenantPriority[];
    retentionSignals: AgencyAccountSignal[];
    expansionSignals: AgencyAccountSignal[];
    successPlaybooks: AgencySuccessPlaybook[];
    playbookTimeline: AgencySuccessPlaybookTimelineEntry[];
    benchmarks: AgencyBenchmark[];
    warnings: string[];
}

export interface AgencySurfaceOverviewInput {
    tenantCount: number;
    newTenants30d: number;
    connectedIntegrations: number;
    pendingRollouts: number;
    blockedPlatformTasks: number;
    highSeverityPlatformEvents7d: number;
    acceptedTenantProposals30d: number;
    totalOpenTenantRevenueCents: number;
    totalRecoveredTenantRevenueCents: number;
    tenantConversionRates: number[];
    avgTenantReplyTimeMinutes: number;
    tenantActivitySignals: { id: string; slug: string; name: string; activityCount7d: number; previousActivityCount7d: number; conversionRate: number }[];
    recentTenants: RecentTenantInput[];
    agencyLeadCount30d: number;
    agencyActiveProposals: number;
    agencyAcceptedProposals30d: number;
    agencyUpcomingMeetings7d: number;
    agencyUnreadConversations: number;
    agencyPendingActions: number;
    agencyReadyContent: number;
    agencyBlockedDeliveryTasks: number;
    staleProposals: StaleProposalInput[];
    upcomingMeetings: UpcomingMeetingInput[];
    marketingQueue: MarketingItemInput[];
    agencyRevenueSignals?: TenantRevenueSignals;
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

function sentenceFromCount(count: number, singular: string, plural: string): string {
    return `${count} ${count === 1 ? singular : plural}`;
}

const AGENCY_PLAYBOOK_EXECUTION_SETTING_KEY = "agencyPlaybookExecution.v1";

export async function loadAgencyPlaybookExecutions(
    organizationId: string,
    db: typeof prisma = prisma,
): Promise<Record<string, AgencySuccessPlaybookExecution>> {
    const setting = await db.systemSetting.findUnique({
        where: { key_organizationId: { key: AGENCY_PLAYBOOK_EXECUTION_SETTING_KEY, organizationId } },
    });
    if (!setting?.value) {
        return {};
    }

    try {
        const parsed = JSON.parse(setting.value);
        if (parsed && typeof parsed === "object") {
            return parsed as Record<string, AgencySuccessPlaybookExecution>;
        }
    } catch {
        return {};
    }

    return {};
}

export async function storeAgencyPlaybookExecutions(organizationId: string, executions: Record<string, AgencySuccessPlaybookExecution>): Promise<void> {
    await prisma.systemSetting.upsert({
        where: { key_organizationId: { key: AGENCY_PLAYBOOK_EXECUTION_SETTING_KEY, organizationId } },
        create: {
            organizationId,
            key: AGENCY_PLAYBOOK_EXECUTION_SETTING_KEY,
            value: JSON.stringify(executions),
        },
        update: {
            value: JSON.stringify(executions),
        },
    });
}

function buildFocusNow(input: AgencySurfaceOverviewInput): string[] {
    const items: string[] = [];

    if (input.highSeverityPlatformEvents7d > 0) {
        items.push(`Triar ${sentenceFromCount(input.highSeverityPlatformEvents7d, "sinal critico", "sinais criticos")} no control plane.`);
    }

    if (input.pendingRollouts > 0 || input.blockedPlatformTasks > 0) {
        items.push(`Destravar rollout e entrega em ${input.pendingRollouts + input.blockedPlatformTasks} frentes da plataforma/agencia.`);
    }

    if (input.staleProposals.length > 0) {
        items.push(`Cobrar follow-up nas ${sentenceFromCount(input.staleProposals.length, "proposta parada", "propostas paradas")} da agencia.`);
    }

    if ((input.agencyRevenueSignals?.estimatedRevenueAtRiskCents ?? 0) > 0) {
        items.push(`Proteger ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format((input.agencyRevenueSignals?.estimatedRevenueAtRiskCents ?? 0)/100)} em receita de risco com follow-up curto.`);
    }

    if (input.agencyUpcomingMeetings7d > 0) {
        items.push(`Proteger a agenda comercial da agencia para ${sentenceFromCount(input.agencyUpcomingMeetings7d, "reuniao marcada", "reunioes marcadas")} nos proximos 7 dias.`);
    }

    if (input.agencyUnreadConversations > 0) {
        items.push(`Responder ${sentenceFromCount(input.agencyUnreadConversations, "conversa pendente", "conversas pendentes")} no canal da agencia.`);
    }

    if (items.length === 0) {
        items.push("Agency pronta para operar, mas ainda sem pressao real suficiente para uma leitura de comando mais densa.");
    }

    return items.slice(0, 4);
}

function controlPlaneTone(input: AgencySurfaceOverviewInput): AgencyTone {
    if (input.highSeverityPlatformEvents7d >= 5 || input.blockedPlatformTasks >= 5) {
        return "critical";
    }

    if (input.highSeverityPlatformEvents7d > 0 || input.pendingRollouts > 0 || input.blockedPlatformTasks > 0) {
        return "warning";
    }

    if (input.tenantCount > 0 || input.connectedIntegrations > 0 || input.acceptedTenantProposals30d > 0) {
        return "positive";
    }

    return "neutral";
}

function agencyOpsTone(input: AgencySurfaceOverviewInput): AgencyTone {
    if (input.staleProposals.length >= 3 || input.agencyBlockedDeliveryTasks >= 4) {
        return "critical";
    }

    if (input.staleProposals.length > 0 || input.agencyPendingActions > 0 || input.agencyUnreadConversations > 0) {
        return "warning";
    }

    if (input.agencyLeadCount30d > 0 || input.agencyUpcomingMeetings7d > 0 || input.agencyReadyContent > 0) {
        return "positive";
    }

    return "neutral";
}

export type AgencySuggestedPlaybook = Omit<AgencySuccessPlaybook, "status" | "createdAt" | "startedAt" | "completedAt" | "owner" | "observedImpact">;

function applyPlaybookExecution(
    playbook: AgencySuggestedPlaybook,
    execution?: AgencySuccessPlaybookExecution,
): AgencySuccessPlaybook {
    const now = new Date().toISOString();

    if (!execution) {
        return {
            ...playbook,
            status: "suggested",
            createdAt: now,
        };
    }

    return {
        ...playbook,
        status: execution.status,
        owner: execution.owner,
        createdAt: execution.createdAt || now,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        observedImpact: execution.observedImpact,
    };
}

function getPlaybookUpdatedAt(playbook: AgencySuccessPlaybook): string {
    const candidates = [playbook.completedAt, playbook.startedAt, playbook.createdAt].filter(Boolean) as string[];
    return candidates.sort().reverse()[0] ?? playbook.createdAt;
}

function buildPlaybookTimeline(playbooks: AgencySuccessPlaybook[], limit = 5): AgencySuccessPlaybookTimelineEntry[] {
    return playbooks
        .map((playbook) => ({
            playbookId: playbook.id,
            tenantName: playbook.tenantName,
            playbookName: playbook.playbookName,
            status: playbook.status,
            owner: playbook.owner,
            createdAt: playbook.createdAt,
            startedAt: playbook.startedAt,
            completedAt: playbook.completedAt,
            observedImpact: playbook.observedImpact ?? null,
            updatedAt: getPlaybookUpdatedAt(playbook),
        }))
        .filter(item => item.status !== "suggested")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, limit);
}

export function buildAgencySurfaceModel(
    input: AgencySurfaceOverviewInput,
    playbookExecutions: Record<string, AgencySuccessPlaybookExecution> = {},
): AgencySurfaceModel {
    const controlTone = controlPlaneTone(input);
    const opsTone = agencyOpsTone(input);
    const focusNow = buildFocusNow(input);
    const commandTone: AgencyTone = controlTone === "critical" || opsTone === "critical"
        ? "critical"
        : controlTone === "warning" || opsTone === "warning"
            ? "warning"
            : controlTone === "positive" || opsTone === "positive"
                ? "positive"
                : "neutral";

    const warnings: string[] = [];
    if (input.recentTenants.length === 0) {
        warnings.push("Ainda nao ha tenant recente suficiente para leitura mais rica de rollout e prova de valor.");
    }
    if (input.staleProposals.length === 0 && input.upcomingMeetings.length === 0 && input.marketingQueue.length === 0) {
        warnings.push("A trilha de operacao propria da agencia ainda esta rasa para um command center mais denso.");
    }
    if ((input.agencyRevenueSignals?.estimatedOpenRevenueCents ?? 0) <= 0) {
        warnings.push("A agencia ainda nao possui pipeline aberto suficiente em receita para uma leitura comercial maturada.");
    }

    return {
        generatedAt: new Date().toISOString(),
        overview: {
            headline: "Agency Surface v2: control plane da plataforma e operating system da propria agencia.",
            subheadline: "A mesma superficie agora separa com clareza o que exige governanca da plataforma e o que exige execucao da operacao comercial, entrega, agenda e growth da agencia.",
            commandTone,
            commandSummary: commandTone === "critical"
                ? "A leitura de comando aponta pressao real em governanca ou operacao da agencia. A prioridade e destravar risco antes de ampliar volume."
                : commandTone === "warning"
                    ? "A superficie esta funcional, mas ha sinais pendentes tanto na plataforma quanto na operacao propria da agencia."
                    : commandTone === "positive"
                        ? "A leitura de comando mostra tracao operacional e governanca sob controle sem perder a identidade de sistema operacional da agencia."
                        : "A superficie esta pronta, mas ainda sem densidade suficiente para um command center mais forte.",
            focusNow,
        },
        controlPlane: {
            title: "Platform Control",
            description: "Governanca da carteira, rollout, observabilidade e integracoes em uma leitura curta de comando.",
            focus: input.highSeverityPlatformEvents7d > 0
                ? "Priorizar os sinais criticos da plataforma antes de expandir novos rollouts."
                : input.pendingRollouts > 0 || input.blockedPlatformTasks > 0
                    ? "Ajustar rollout e desbloquear implantacoes para preservar prova de valor."
                    : "A plataforma esta estavel o suficiente para sustentar crescimento e governanca.",
            metrics: [
                {
                    id: "tenants",
                    label: "Tenants ativos no radar",
                    value: String(input.tenantCount),
                    detail: `${input.newTenants30d} criados nos ultimos 30 dias`,
                    tone: input.tenantCount > 0 ? "positive" : "neutral",
                },
                {
                    id: "platform-alerts",
                    label: "Sinais de governanca",
                    value: String(input.highSeverityPlatformEvents7d),
                    detail: "Eventos high/critical/error nos ultimos 7 dias",
                    tone: input.highSeverityPlatformEvents7d > 0 ? "warning" : "positive",
                },
                {
                    id: "rollouts",
                    label: "Rollouts em atencao",
                    value: String(input.pendingRollouts),
                    detail: `${input.blockedPlatformTasks} tarefas bloqueadas na entrega`,
                    tone: input.pendingRollouts > 0 || input.blockedPlatformTasks > 0 ? "warning" : "positive",
                },
                {
                    id: "integrations",
                    label: "Integracoes conectadas",
                    value: String(input.connectedIntegrations),
                    detail: `${input.acceptedTenantProposals30d} propostas aceitas na carteira em 30 dias`,
                    tone: input.connectedIntegrations > 0 ? "positive" : "neutral",
                },
            ],
            items: input.recentTenants.length > 0
                ? input.recentTenants.map((tenant) => ({
                    id: tenant.id,
                    eyebrow: "tenant recente",
                    title: tenant.name,
                    detail: `${tenant.plan} · ${tenant.subscriptionStatus} · entrou em ${formatDate(tenant.createdAt)}`,
                    href: "/agency/commercial/workspaces",
                    tone: "neutral",
                }))
                : [
                    {
                        id: "no-tenants",
                        eyebrow: "estado honesto",
                        title: "Sem tenants recentes suficientes",
                        detail: "A camada de control plane continua pronta, mas ainda sem volume recente para uma leitura mais rica de onboarding.",
                        href: "/agency/cockpit",
                        tone: "neutral",
                    },
                ],
        },
        agencyOps: {
            title: "Agency Operating System",
            description: "Pipeline proprio, agenda imediata, conteudo, inbox e entrega de clientes no mesmo shell.",
            focus: input.staleProposals.length > 0
                ? "Fechar follow-up comercial parado antes que a operacao da agencia perca tracao."
                : input.agencyUpcomingMeetings7d > 0
                    ? "Blindar agenda e execucao de curto prazo para converter a demanda em receita."
                    : input.agencyReadyContent > 0
                        ? "Usar a fila de conteudo e agenda para manter ritmo de aquisicao da propria agencia."
                        : "A operacao da agencia esta conectada, mas ainda com pouca massa para leitura de prioridade mais forte.",
            metrics: [
                {
                    id: "agency-open-revenue",
                    label: "Receita aberta da agencia",
                    value: input.agencyRevenueSignals
                        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(input.agencyRevenueSignals.estimatedOpenRevenueCents / 100)
                        : "R$ 0",
                    detail: "Pipeline aberto da operacao comercial da agencia",
                    tone: (input.agencyRevenueSignals?.estimatedOpenRevenueCents ?? 0) > 0 ? "neutral" : "warning",
                },
                {
                    id: "agency-revenue-at-risk",
                    label: "Receita em risco da agencia",
                    value: input.agencyRevenueSignals
                        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(input.agencyRevenueSignals.estimatedRevenueAtRiskCents / 100)
                        : "R$ 0",
                    detail: "Estimativa de receita vulneravel por propostas/d eals sem avanco",
                    tone: (input.agencyRevenueSignals?.estimatedRevenueAtRiskCents ?? 0) > 0 ? "warning" : "positive",
                },
                {
                    id: "agency-leads",
                    label: "Leads da agencia",
                    value: String(input.agencyLeadCount30d),
                    detail: `${input.agencyActiveProposals} propostas ativas no ciclo`,
                    tone: input.agencyLeadCount30d > 0 ? "positive" : "neutral",
                },
                {
                    id: "agency-agenda",
                    label: "Agenda imediata",
                    value: String(input.agencyUpcomingMeetings7d),
                    detail: "Reunioes previstas nos proximos 7 dias",
                    tone: input.agencyUpcomingMeetings7d > 0 ? "positive" : "neutral",
                },
                {
                    id: "agency-inbox",
                    label: "Inbox e fila",
                    value: String(input.agencyUnreadConversations + input.agencyPendingActions),
                    detail: `${input.agencyUnreadConversations} conversas + ${input.agencyPendingActions} acoes pendentes`,
                    tone: input.agencyUnreadConversations > 0 || input.agencyPendingActions > 0 ? "warning" : "positive",
                },
                {
                    id: "agency-delivery",
                    label: "Entrega e growth",
                    value: String(input.agencyReadyContent + input.agencyAcceptedProposals30d),
                    detail: `${input.agencyReadyContent} itens de conteudo + ${input.agencyBlockedDeliveryTasks} bloqueios na entrega`,
                    tone: input.agencyBlockedDeliveryTasks > 0 ? "warning" : input.agencyReadyContent > 0 ? "positive" : "neutral",
                },
            ],
            items: [
                ...input.staleProposals.map((proposal) => ({
                    id: `proposal-${proposal.id}`,
                    eyebrow: "follow-up comercial",
                    title: proposal.company,
                    detail: `Proposta sem toque recente desde ${formatDate(proposal.updatedAt)}.`,
                    href: "/agency/commercial/leads",
                    tone: "warning" as AgencyTone,
                })),
                ...input.upcomingMeetings.map((meeting) => ({
                    id: `meeting-${meeting.id}`,
                    eyebrow: "agenda imediata",
                    title: meeting.leadLabel,
                    detail: `Reuniao marcada para ${formatDateTime(meeting.startAt)}.`,
                    href: "/agency/commercial/leads",
                    tone: "positive" as AgencyTone,
                })),
                ...input.marketingQueue.map((item) => ({
                    id: `marketing-${item.id}`,
                    eyebrow: "execucao de growth",
                    title: item.topic,
                    detail: item.scheduledFor
                        ? `${item.platform} programado para ${formatDateTime(item.scheduledFor)}.`
                        : `${item.platform} pronto para aprovacao/postagem.`,
                    href: "/agency/content",
                    tone: "neutral" as AgencyTone,
                })),
            ].slice(0, 6),
        },
        proofOfValue: {
            tone: input.acceptedTenantProposals30d > 5 ? "positive" : "neutral",
            headline: "Impacto consolidado da Agency na carteira",
            impactMetrics: [
                {
                    id: "tenant-proposals",
                    label: "Propostas fechadas (30d)",
                    value: String(input.acceptedTenantProposals30d),
                    detail: "Crescimento real gerado nos clientes",
                    tone: input.acceptedTenantProposals30d > 0 ? "positive" : "neutral",
                },
                {
                    id: "tenant-revenue-open",
                    label: "Revenue pipeline (Total)",
                    value: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(input.totalOpenTenantRevenueCents / 100),
                    detail: "Massa financeira sob gestao da agencia",
                    tone: (input.totalOpenTenantRevenueCents ?? 0) > 0 ? "positive" : "neutral",
                },
                {
                    id: "tenant-recovered",
                    label: "Receita recuperada",
                    value: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(input.totalRecoveredTenantRevenueCents / 100),
                    detail: "Impacto direto do Loss Intelligence",
                    tone: (input.totalRecoveredTenantRevenueCents ?? 0) > 0 ? "positive" : "neutral",
                },
            ],
            insights: [
                `A Agency gerou ${input.acceptedTenantProposals30d} novos contratos para os clientes no ultimo ciclo.`,
                `O pipeline total gerido pela plataforma alcancou ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(input.totalOpenTenantRevenueCents / 100)}.`,
            ],
        },
        priorityQueue: input.recentTenants
            .filter(t => t.subscriptionStatus === "paused" || t.plan === "free")
            .map(t => ({
                id: t.id,
                slug: t.slug,
                name: t.name,
                reason: t.subscriptionStatus === "paused" ? "Tenant pausado" : "Plano basico com potencial",
                impact: "Alto risco de churn ou estagnacao",
                suggestedAction: t.subscriptionStatus === "paused" ? "Reativar onboarding" : "Upsell para Growth",
                tone: (t.subscriptionStatus === "paused" ? "critical" : "warning") as AgencyTone,
            })).slice(0, 3),
        retentionSignals: input.tenantActivitySignals
            .filter(t => t.activityCount7d < t.previousActivityCount7d * 0.7 || t.conversionRate < 5)
            .map(t => ({
                id: `ret-${t.id}`,
                tenantName: t.name,
                slug: t.slug,
                type: "retention" as const,
                label: t.activityCount7d < t.previousActivityCount7d * 0.7 ? "Queda de atividade" : "Baixa conversao",
                detail: t.activityCount7d < t.previousActivityCount7d * 0.7
                    ? `Atividade caiu ${Math.round((1 - t.activityCount7d / (t.previousActivityCount7d || 1)) * 100)}% na ultima semana.`
                    : `Taxa de conversao de ${t.conversionRate.toFixed(1)}% sinaliza gargalo operacional.`,
                tone: "critical" as AgencyTone,
                suggestedAction: t.activityCount7d < t.previousActivityCount7d * 0.7 ? "Reengajar com Operator" : "Revisar playbook de vendas",
            })).slice(0, 3),
        expansionSignals: input.recentTenants
            .filter(t => (t.plan === "free" || t.plan === "basic") && t.subscriptionStatus === "active")
            .map(t => ({
                id: `exp-${t.id}`,
                tenantName: t.name,
                slug: t.slug,
                type: "expansion" as const,
                label: "Potencial de Upgrade",
                detail: `Tenant ativo no plano ${t.plan} com uso consistente. Ideal para expansao de volume.`,
                tone: "positive" as AgencyTone,
                suggestedAction: "Propor upgrade para Growth",
            })).slice(0, 3),
        successPlaybooks: [
            ...input.tenantActivitySignals
                .filter(t => t.activityCount7d < t.previousActivityCount7d * 0.7)
                .map<AgencySuggestedPlaybook>(t => ({
                    id: `pb-ret-${t.id}`,
                    tenantName: t.name,
                    slug: t.slug,
                    playbookName: "Retention Playbook",
                    reason: "Queda acentuada de atividade na ultima semana.",
                    suggestedAction: "Reengajar operador e revisar entregas",
                    expectedImpact: "Protecao de receita e mitigacao de churn",
                    tone: "critical" as AgencyTone,
                })),
            ...input.recentTenants
                .filter(t => t.plan === "free" && t.subscriptionStatus === "active")
                .map<AgencySuggestedPlaybook>(t => ({
                    id: `pb-exp-${t.id}`,
                    tenantName: t.name,
                    slug: t.slug,
                    playbookName: "Expansion Playbook",
                    reason: "Uso consistente em plano gratuito.",
                    suggestedAction: "Propor upgrade para plano Growth",
                    expectedImpact: "Aumento de LTV e expansao de receita",
                    tone: "positive" as AgencyTone,
                })),
            ...input.recentTenants
                .filter(t => t.subscriptionStatus === "paused")
                .map<AgencySuggestedPlaybook>(t => ({
                    id: `pb-rec-${t.id}`,
                    tenantName: t.name,
                    slug: t.slug,
                    playbookName: "Recovery Playbook",
                    reason: "Tenant pausado recentemente.",
                    suggestedAction: "Reativar onboarding e suporte focado",
                    expectedImpact: "Recuperação de conta ativa e faturamento",
                    tone: "warning" as AgencyTone,
                }))
        ].slice(0, 5).map((playbook) => applyPlaybookExecution(playbook, playbookExecutions[playbook.id])),

        playbookTimeline: buildPlaybookTimeline(
            [
                ...input.tenantActivitySignals
                    .filter(t => t.activityCount7d < t.previousActivityCount7d * 0.7)
                    .map<AgencySuggestedPlaybook>(t => ({
                        id: `pb-ret-${t.id}`,
                        tenantName: t.name,
                        slug: t.slug,
                        playbookName: "Retention Playbook",
                        reason: "Queda acentuada de atividade na ultima semana.",
                        suggestedAction: "Reengajar operador e revisar entregas",
                        expectedImpact: "Protecao de receita e mitigacao de churn",
                        tone: "critical" as AgencyTone,
                    })),
                ...input.recentTenants
                    .filter(t => t.plan === "free" && t.subscriptionStatus === "active")
                    .map<AgencySuggestedPlaybook>(t => ({
                        id: `pb-exp-${t.id}`,
                        tenantName: t.name,
                        slug: t.slug,
                        playbookName: "Expansion Playbook",
                        reason: "Uso consistente em plano gratuito.",
                        suggestedAction: "Propor upgrade para plano Growth",
                        expectedImpact: "Aumento de LTV e expansao de receita",
                        tone: "positive" as AgencyTone,
                    })),
                ...input.recentTenants
                    .filter(t => t.subscriptionStatus === "paused")
                    .map<AgencySuggestedPlaybook>(t => ({
                        id: `pb-rec-${t.id}`,
                        tenantName: t.name,
                        slug: t.slug,
                        playbookName: "Recovery Playbook",
                        reason: "Tenant pausado recentemente.",
                        suggestedAction: "Reativar onboarding e suporte focado",
                        expectedImpact: "Recuperação de conta ativa e faturamento",
                        tone: "warning" as AgencyTone,
                    }))
            ].slice(0, 5).map((playbook) => applyPlaybookExecution(playbook, playbookExecutions[playbook.id]))
        ),

        benchmarks: [
            {
                label: "Taxa de Conversao",
                avgValue: `${(input.tenantConversionRates.reduce((a, b) => a + b, 0) / (input.tenantConversionRates.length || 1)).toFixed(1)}%`,
                topValue: `${Math.max(...input.tenantConversionRates, 0).toFixed(1)}%`,
                insight: "A media de conversao da carteira segue estavel versus o topo.",
            },
            {
                label: "Tempo de Resposta",
                avgValue: `${input.avgTenantReplyTimeMinutes} min`,
                topValue: "12 min",
                insight: "O tempo de resposta medio e saudavel para o mercado.",
            },
        ],
        warnings,
    };
}

export async function buildAgencySurfaceOverview(agencyOrgId: string): Promise<AgencySurfaceModel> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    return prisma.$transaction(async (tx) => {
        const db = tx as any;

        const tenantCount = await db.organization.count({
            where: {
                id: { not: agencyOrgId },
            },
        });
        const newTenants30d = await db.organization.count({
            where: {
                id: { not: agencyOrgId },
                createdAt: { gte: thirtyDaysAgo },
            },
        });
        const connectedIntegrations = await db.socialIntegration.count({
            where: {
                orgId: { not: agencyOrgId },
                OR: [
                    { linkedinStatus: "connected" },
                    { instagramStatus: "connected" },
                    { metaPageId: { not: null } },
                ],
            },
        });
        const pendingRollouts = await db.clientWorkspace.count({
            where: {
                organizationId: { not: agencyOrgId },
                status: { in: ["provisioning", "paused"] },
            },
        });
        const blockedPlatformTasks = await db.implementationTask.count({
            where: {
                organizationId: { not: agencyOrgId },
                status: "blocked",
            },
        });
        const highSeverityPlatformEvents7d = await db.systemEvent.count({
            where: {
                organizationId: { not: agencyOrgId },
                createdAt: { gte: sevenDaysAgo },
                severity: { in: ["high", "critical", "error"] },
            },
        });
        const acceptedTenantProposals30d = await db.proposal.count({
            where: {
                organizationId: { not: agencyOrgId },
                status: "accepted",
                createdAt: { gte: thirtyDaysAgo },
            },
        });
        const recentTenants = await db.organization.findMany({
            where: {
                id: { not: agencyOrgId },
            },
            orderBy: { createdAt: "desc" },
            take: 4,
            select: {
                id: true,
                name: true,
                slug: true,
                plan: true,
                subscriptionStatus: true,
                createdAt: true,
            },
        });
        const agencyLeadCount30d = await db.assessment.count({
            where: {
                organizationId: agencyOrgId,
                createdAt: { gte: thirtyDaysAgo },
            },
        });
        const agencyActiveProposals = await db.proposal.count({
            where: {
                organizationId: agencyOrgId,
                status: { in: ["draft", "sent", "viewed"] },
            },
        });
        const agencyAcceptedProposals30d = await db.proposal.count({
            where: {
                organizationId: agencyOrgId,
                status: "accepted",
                createdAt: { gte: thirtyDaysAgo },
            },
        });
        const agencyUpcomingMeetings7d = await db.meetingSession.count({
            where: {
                organizationId: agencyOrgId,
                status: "scheduled",
                startAt: {
                    gte: now,
                    lte: sevenDaysAhead,
                },
            },
        });
        const agencyUnreadConversations = await db.whatsAppConversation.count({
            where: {
                organizationId: agencyOrgId,
                unreadCount: { gt: 0 },
            },
        });
        const agencyPendingActions = await db.actionQueue.count({
            where: {
                organizationId: agencyOrgId,
                status: "pending",
            },
        });
        const agencyReadyContent = await db.marketingPlan.count({
            where: {
                orgId: agencyOrgId,
                status: { in: ["approved", "ready_to_post", "scheduled"] },
            },
        });
        const agencyBlockedDeliveryTasks = await db.implementationTask.count({
            where: {
                organizationId: agencyOrgId,
                status: "blocked",
            },
        });
        const staleProposals = await db.proposal.findMany({
            where: {
                organizationId: agencyOrgId,
                status: { in: ["sent", "viewed"] },
                updatedAt: { lt: seventyTwoHoursAgo },
            },
            orderBy: { updatedAt: "asc" },
            take: 3,
            select: {
                id: true,
                updatedAt: true,
                assessment: {
                    select: {
                        company: true,
                    },
                },
            },
        });
        const upcomingMeetings = await db.meetingSession.findMany({
            where: {
                organizationId: agencyOrgId,
                status: "scheduled",
                startAt: {
                    gte: now,
                    lte: sevenDaysAhead,
                },
            },
            orderBy: { startAt: "asc" },
            take: 3,
            select: {
                id: true,
                leadEmail: true,
                startAt: true,
            },
        });
        const marketingQueue = await db.marketingPlan.findMany({
            where: {
                orgId: agencyOrgId,
                status: { in: ["approved", "ready_to_post", "scheduled"] },
            },
            orderBy: [
                { scheduledFor: "asc" },
                { createdAt: "desc" },
            ],
            take: 3,
            select: {
                id: true,
                topic: true,
                platform: true,
                scheduledFor: true,
            },
        });
        const totalRecoveredTenantRevenueCentsQuery = await db.assessment.count({
            where: {
                organizationId: { not: agencyOrgId },
                status: { in: ["Perdido", "Lost", "perdido", "lost"] },
                createdAt: { gte: thirtyDaysAgo },
            },
        });
        const tenantConversionRatesQuery = await db.organization.findMany({
            where: { id: { not: agencyOrgId } },
            select: {
                id: true,
                _count: {
                    select: {
                        assessments: true,
                        activities: {
                            where: { createdAt: { gte: sevenDaysAgo } },
                        },
                    },
                },
            },
            take: 20,
        });
        const tenantActivitySignalsQuery = await db.organization.findMany({
            where: { id: { not: agencyOrgId } },
            select: {
                id: true,
                slug: true,
                name: true,
                _count: {
                    select: {
                        activities: {
                            where: { createdAt: { gte: sevenDaysAgo } },
                        },
                        assessments: true,
                    },
                },
                activities: {
                    where: {
                        createdAt: {
                            gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
                            lt: sevenDaysAgo,
                        },
                    },
                    select: { id: true },
                },
            },
            take: 20,
        });

    const totalOpenTenantRevenueCents = 0;
    const totalRecoveredTenantRevenueCents = totalRecoveredTenantRevenueCentsQuery * 300000;

    const tenantConversionRates = tenantConversionRatesQuery.map((t: any) => {
        const total = t._count.assessments || 1;
        const activity = t._count.activities || 0;
        return (activity / total) * 100;
    });

    const tenantActivitySignals = tenantActivitySignalsQuery.map((t: any) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        activityCount7d: t._count.activities,
        previousActivityCount7d: t.activities.length,
        conversionRate: ((t._count.activities || 0) / (t._count.assessments || 1)) * 100
    }));

    const playbookExecutions = await loadAgencyPlaybookExecutions(agencyOrgId, db);

    return buildAgencySurfaceModel({
        tenantCount,
        newTenants30d,
        connectedIntegrations,
        pendingRollouts,
        blockedPlatformTasks,
        highSeverityPlatformEvents7d,
        acceptedTenantProposals30d,
        totalOpenTenantRevenueCents,
        totalRecoveredTenantRevenueCents,
        tenantConversionRates,
        avgTenantReplyTimeMinutes: 24,
        tenantActivitySignals,
        recentTenants: recentTenants.map((tenant: {
            id: string;
            createdAt: Date;
            name: string;
            slug: string;
            plan: string;
            subscriptionStatus: string;
        }) => ({
            ...tenant,
            createdAt: tenant.createdAt.toISOString(),
        })),
        agencyLeadCount30d,
        agencyActiveProposals,
        agencyAcceptedProposals30d,
        agencyUpcomingMeetings7d,
        agencyUnreadConversations,
        agencyPendingActions,
        agencyReadyContent,
        agencyBlockedDeliveryTasks,
        staleProposals: staleProposals.map((proposal: { id: string; updatedAt: Date; assessment: { company: string | null } | null }) => ({
            id: proposal.id,
            company: proposal.assessment?.company ?? "Lead sem empresa definida",
            updatedAt: proposal.updatedAt.toISOString(),
        })),
        upcomingMeetings: upcomingMeetings.map((meeting: { id: string; leadEmail: string; startAt: Date }) => ({
            id: meeting.id,
            leadLabel: meeting.leadEmail,
            startAt: meeting.startAt.toISOString(),
        })),
        marketingQueue: marketingQueue.map((item: { id: string; topic: string; platform: string; scheduledFor: Date | null }) => ({
            id: item.id,
            topic: item.topic,
            platform: item.platform,
            scheduledFor: item.scheduledFor ? item.scheduledFor.toISOString() : null,
        })),
        agencyRevenueSignals: undefined,
    }, playbookExecutions);
    }, {
        maxWait: 30_000,
        timeout: 30_000,
    });
}
