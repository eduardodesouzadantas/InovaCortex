import { prisma } from "@/lib/prisma";

export type RevenueSignalTone = "neutral" | "positive" | "warning" | "critical";
export type RevenueSignalDirection = "up" | "down" | "flat";

export interface RevenueEngineRecordSnapshot {
    assessmentId: string;
    company: string;
    dealId: string | null;
    dealStatus: string | null;
    dealStageId: string | null;
    dealStageLabel: string;
    dealCreatedAt: string | null;
    dealValueCents: number;
    latestActivityAt: string | null;
    proposalId: string | null;
    proposalStatus: string;
    proposalUpdatedAt: string | null;
    proposalValueCents: number;
    conversationId: string | null;
    unreadCount: number;
    conversationLastMessageAt: string | null;
    conversationSlaDueAt: string | null;
    contactLastInboundAt: string | null;
    contactLastOutboundAt: string | null;
    ownerId: string | null;
    ownerLabel: string | null;
}

export interface RevenueMomentumSignal {
    tone: RevenueSignalTone;
    direction: RevenueSignalDirection;
    label: string;
    detail: string;
    proposalEntriesCurrentWindow: number;
    proposalEntriesPreviousWindow: number;
    activityEntriesCurrentWindow: number;
    activityEntriesPreviousWindow: number;
}

export interface RevenueStageStagnation {
    stageId: string | null;
    stageLabel: string;
    stalledCount: number;
    estimatedValueCents: number;
}

export interface RevenueOpportunityRiskItem {
    assessmentId: string;
    company: string;
    dealId: string | null;
    conversationId: string | null;
    stageLabel: string;
    proposalStatus: string;
    estimatedValueCents: number;
    ownerId: string | null;
    ownerLabel: string;
    lastTouchAt: string | null;
    riskScore: number;
    reason: string;
    recommendedAction: string;
}

export interface TenantRevenueSignals {
    generatedAt: string;
    estimatedOpenRevenueCents: number;
    estimatedRevenueAtRiskCents: number;
    stalledProposals: {
        count: number;
        valueCents: number;
        thresholdDays: number;
    };
    inactiveDeals: {
        count: number;
        valueCents: number;
        thresholdDays: number;
    };
    proposalsWithoutResponse: {
        count: number;
        thresholdDays: number;
    };
    quietCriticalConversations: {
        count: number;
        thresholdHours: number;
    };
    mostStagnantStage: RevenueStageStagnation | null;
    momentum: RevenueMomentumSignal;
    topAtRiskOpportunities: RevenueOpportunityRiskItem[];
    agingBuckets: Array<{ bucket: string; count: number; valueCents: number }>;
    riskByStage: Array<{ stageId: string | null; stageLabel: string; count: number; valueCents: number; riskShare: number }>;
    riskByOwner: Array<{ ownerId: string | null; ownerLabel: string; count: number; valueCents: number; riskShare: number }>;
    conversionTrend: {
        current: number;
        previous: number;
        delta: number;
        direction: RevenueSignalDirection;
        detail: string;
    };
    summary: {
        tone: RevenueSignalTone;
        headline: string;
        focus: string;
    };
}

const STALLED_PROPOSAL_THRESHOLD_DAYS = 5;
const INACTIVE_DEAL_THRESHOLD_DAYS = 7;
const QUIET_CONVERSATION_THRESHOLD_HOURS = 24;
const RESPONSE_GAP_THRESHOLD_DAYS = 3;
const MOMENTUM_WINDOW_DAYS = 14;

function addDays(base: Date, days: number) {
    return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function parseDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIso(value: Date | null | undefined): string | null {
    return value ? value.toISOString() : null;
}

function ageBucketLabel(days: number): string {
    if (days <= 7) return "0-7 dias";
    if (days <= 14) return "8-14 dias";
    if (days <= 30) return "15-30 dias";
    return "31+ dias";
}

function parseProposalValueCents(pricingEstimate: unknown): number {
    if (typeof pricingEstimate === "number" && Number.isFinite(pricingEstimate)) {
        return Math.round(pricingEstimate);
    }

    if (typeof pricingEstimate !== "string" || !pricingEstimate.trim()) {
        return 0;
    }

    const raw = pricingEstimate.trim();
    if (/^\d+(\.\d+)?$/.test(raw)) {
        return Math.round(Number(raw) * 100);
    }

    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const min = Number(parsed.minBRL ?? parsed.min ?? 0);
        const max = Number(parsed.maxBRL ?? parsed.max ?? min);
        const estimate = max > 0 ? (min + max) / 2 : min;
        return Number.isFinite(estimate) ? Math.round(estimate * 100) : 0;
    } catch {
        return 0;
    }
}

function maxDate(values: Array<Date | null | undefined>): Date | null {
    return values.reduce<Date | null>((latest, current) => {
        if (!current) return latest;
        if (!latest) return current;
        return current.getTime() > latest.getTime() ? current : latest;
    }, null);
}

function hoursSince(now: Date, value: Date | null): number {
    if (!value) return Number.POSITIVE_INFINITY;
    return Math.floor((now.getTime() - value.getTime()) / (60 * 60 * 1000));
}

function daysSince(now: Date, value: Date | null): number {
    if (!value) return Number.POSITIVE_INFINITY;
    return Math.floor((now.getTime() - value.getTime()) / (24 * 60 * 60 * 1000));
}

function formatCurrencyFromCents(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
    }).format((value || 0) / 100);
}

function deriveMomentum(input: {
    proposalEntriesCurrentWindow: number;
    proposalEntriesPreviousWindow: number;
    activityEntriesCurrentWindow: number;
    activityEntriesPreviousWindow: number;
    inactiveDealsCount: number;
    quietCriticalConversationsCount: number;
}): RevenueMomentumSignal {
    const proposalDirection: RevenueSignalDirection = input.proposalEntriesCurrentWindow === input.proposalEntriesPreviousWindow
        ? "flat"
        : input.proposalEntriesCurrentWindow > input.proposalEntriesPreviousWindow
            ? "up"
            : "down";
    const activityDirection: RevenueSignalDirection = input.activityEntriesCurrentWindow === input.activityEntriesPreviousWindow
        ? "flat"
        : input.activityEntriesCurrentWindow > input.activityEntriesPreviousWindow
            ? "up"
            : "down";

    const positiveCount = [proposalDirection === "up", activityDirection === "up"].filter(Boolean).length;
    const negativeCount = [proposalDirection === "down", activityDirection === "down"].filter(Boolean).length;

    const tone: RevenueSignalTone = negativeCount === 2
        ? "critical"
        : negativeCount === 1 || input.inactiveDealsCount > 0 || input.quietCriticalConversationsCount > 0
            ? "warning"
            : positiveCount === 2
                ? "positive"
                : "neutral";

    const direction: RevenueSignalDirection = positiveCount > negativeCount
        ? "up"
        : negativeCount > positiveCount
            ? "down"
            : "flat";

    const detail = direction === "up"
        ? "A entrada de propostas e a atividade recente sustentam tracao de pipeline no curto prazo."
        : direction === "down"
            ? "A maquina comercial perdeu ritmo recente e aumenta o risco de estagnacao nas proximas semanas."
            : "O pipeline segue estavel no curto prazo, mas sem aceleracao material.";

    return {
        tone,
        direction,
        label: direction === "up"
            ? "Momentum com tracao"
            : direction === "down"
                ? "Momentum em queda"
                : "Momentum estavel",
        detail,
        proposalEntriesCurrentWindow: input.proposalEntriesCurrentWindow,
        proposalEntriesPreviousWindow: input.proposalEntriesPreviousWindow,
        activityEntriesCurrentWindow: input.activityEntriesCurrentWindow,
        activityEntriesPreviousWindow: input.activityEntriesPreviousWindow,
    };
}

export function buildRevenueEngineSnapshot(input: {
    now?: Date;
    records: RevenueEngineRecordSnapshot[];
    proposalEntriesCurrentWindow: number;
    proposalEntriesPreviousWindow: number;
    activityEntriesCurrentWindow: number;
    activityEntriesPreviousWindow: number;
}): TenantRevenueSignals {
    const now = input.now ?? new Date();
    let estimatedOpenRevenueCents = 0;
    let estimatedRevenueAtRiskCents = 0;
    let stalledProposalCount = 0;
    let stalledProposalValueCents = 0;
    let inactiveDealCount = 0;
    let inactiveDealValueCents = 0;
    let proposalsWithoutResponseCount = 0;
    let quietCriticalConversationsCount = 0;
    const stagnantStageMap = new Map<string, RevenueStageStagnation>();
    const atRiskOpportunities: RevenueOpportunityRiskItem[] = [];
    const agingBucketsMap = new Map<string, { count: number; valueCents: number }>();
    const riskByStageMap = new Map<string, { stageId: string | null; stageLabel: string; count: number; valueCents: number }>();
    const riskByOwnerMap = new Map<string, { ownerId: string | null; ownerLabel: string; count: number; valueCents: number }>();

    for (const record of input.records) {
        const proposalUpdatedAt = parseDate(record.proposalUpdatedAt);
        const latestActivityAt = parseDate(record.latestActivityAt);
        const conversationLastMessageAt = parseDate(record.conversationLastMessageAt);
        const conversationSlaDueAt = parseDate(record.conversationSlaDueAt);
        const lastInboundAt = parseDate(record.contactLastInboundAt);
        const lastOutboundAt = parseDate(record.contactLastOutboundAt);
        const dealCreatedAt = parseDate(record.dealCreatedAt);
        const lastTouchAt = maxDate([
            proposalUpdatedAt,
            latestActivityAt,
            conversationLastMessageAt,
            lastInboundAt,
            lastOutboundAt,
            dealCreatedAt,
        ]);

        const estimatedValueCents = record.proposalValueCents > 0
            ? record.proposalValueCents
            : Math.max(0, record.dealValueCents);
        const hasOpenDeal = record.dealStatus === "open";
        const hasActiveProposal = ["draft", "sent", "viewed"].includes(record.proposalStatus);
        const openOpportunity = estimatedValueCents > 0 && (hasOpenDeal || hasActiveProposal);

        if (openOpportunity) {
            estimatedOpenRevenueCents += estimatedValueCents;
            const opportunityAgeDays = daysSince(now, maxDate([lastTouchAt, dealCreatedAt, proposalUpdatedAt]));
            const bucket = ageBucketLabel(Number.isFinite(opportunityAgeDays) ? opportunityAgeDays : 0);
            const existingAging = agingBucketsMap.get(bucket) ?? { count: 0, valueCents: 0 };
            existingAging.count += 1;
            existingAging.valueCents += estimatedValueCents;
            agingBucketsMap.set(bucket, existingAging);
        }

        const proposalAgeDays = daysSince(now, proposalUpdatedAt);
        const stalledProposal = ["sent", "viewed"].includes(record.proposalStatus)
            && proposalAgeDays >= STALLED_PROPOSAL_THRESHOLD_DAYS;
        if (stalledProposal) {
            stalledProposalCount += 1;
            stalledProposalValueCents += estimatedValueCents;
        }

        const inactiveDeal = hasOpenDeal
            && daysSince(now, lastTouchAt) >= INACTIVE_DEAL_THRESHOLD_DAYS;
        if (inactiveDeal) {
            inactiveDealCount += 1;
            inactiveDealValueCents += estimatedValueCents;
        }

        const proposalsWithoutResponse = ["sent", "viewed"].includes(record.proposalStatus)
            && proposalUpdatedAt
            && (!lastInboundAt || proposalUpdatedAt.getTime() > lastInboundAt.getTime())
            && proposalAgeDays >= RESPONSE_GAP_THRESHOLD_DAYS;
        if (proposalsWithoutResponse) {
            proposalsWithoutResponseCount += 1;
        }

        const unreadOverdue = record.unreadCount > 0
            && (
                (conversationSlaDueAt && conversationSlaDueAt.getTime() < now.getTime())
                || hoursSince(now, conversationLastMessageAt) >= QUIET_CONVERSATION_THRESHOLD_HOURS
            );
        const noReplyAfterRecentInbound = Boolean(
            lastInboundAt
            && hoursSince(now, lastInboundAt) >= QUIET_CONVERSATION_THRESHOLD_HOURS
            && (!lastOutboundAt || lastOutboundAt.getTime() < lastInboundAt.getTime()),
        );
        const quietCriticalConversation = Boolean(record.conversationId)
            && (unreadOverdue || (hasActiveProposal && noReplyAfterRecentInbound));
        if (quietCriticalConversation) {
            quietCriticalConversationsCount += 1;
        }

        const reasons: string[] = [];
        let riskScore = 0;

        if (stalledProposal) {
            reasons.push(`Proposta parada ha ${proposalAgeDays} dias.`);
            riskScore += 4;
        }

        if (inactiveDeal) {
            reasons.push(`Deal sem avanço relevante ha ${daysSince(now, lastTouchAt)} dias.`);
            riskScore += 3;
        }

        if (quietCriticalConversation) {
            reasons.push(record.unreadCount > 0
                ? `${record.unreadCount} mensagem${record.unreadCount === 1 ? "" : "ens"} aguardando retorno.`
                : "Conversa critica sem toque relevante.");
            riskScore += 3;
        }

        if (proposalsWithoutResponse) {
            reasons.push("Proposta enviada sem resposta relevante do contato.");
            riskScore += 2;
        }

        if (reasons.length === 0 || estimatedValueCents <= 0) {
            continue;
        }

        estimatedRevenueAtRiskCents += estimatedValueCents;

        const stageKey = record.dealStageId ?? "no-stage";
        const currentStage = stagnantStageMap.get(stageKey) ?? {
            stageId: record.dealStageId,
            stageLabel: record.dealStageLabel || "Sem stage",
            stalledCount: 0,
            estimatedValueCents: 0,
        };
        currentStage.stalledCount += 1;
        currentStage.estimatedValueCents += estimatedValueCents;
        stagnantStageMap.set(stageKey, currentStage);

        const stageRisk = riskByStageMap.get(stageKey) ?? {
            stageId: record.dealStageId,
            stageLabel: record.dealStageLabel || "Sem stage",
            count: 0,
            valueCents: 0,
        };
        stageRisk.count += 1;
        stageRisk.valueCents += estimatedValueCents;
        riskByStageMap.set(stageKey, stageRisk);

        const ownerKey = record.ownerId ?? "unassigned";
        const ownerRisk = riskByOwnerMap.get(ownerKey) ?? {
            ownerId: record.ownerId,
            ownerLabel: record.ownerLabel || "Sem responsavel",
            count: 0,
            valueCents: 0,
        };
        ownerRisk.count += 1;
        ownerRisk.valueCents += estimatedValueCents;
        riskByOwnerMap.set(ownerKey, ownerRisk);

        atRiskOpportunities.push({
            assessmentId: record.assessmentId,
            company: record.company || "Lead sem empresa",
            dealId: record.dealId,
            conversationId: record.conversationId,
            stageLabel: record.dealStageLabel || "Sem stage",
            proposalStatus: record.proposalStatus,
            estimatedValueCents,
            lastTouchAt: toIso(lastTouchAt),
            ownerId: record.ownerId,
            ownerLabel: record.ownerLabel || "Sem responsavel",
            riskScore: riskScore + Math.min(6, Math.round(estimatedValueCents / 500_000)),
            reason: reasons.join(" "),
            recommendedAction: stalledProposal
                ? "Cobrar proposta parada agora."
                : quietCriticalConversation
                    ? "Responder conversa e fixar proxima acao."
                    : "Reativar o deal com dono e proximo passo.",
        });
    }

    const agingBuckets = Array.from(agingBucketsMap.entries())
        .map(([bucket, value]) => ({ bucket, ...value }))
        .sort((a, b) => {
            const order = ["0-7 dias", "8-14 dias", "15-30 dias", "31+ dias"];
            return order.indexOf(a.bucket) - order.indexOf(b.bucket);
        });

    const riskByStage = Array.from(riskByStageMap.values())
        .map((entry) => ({
            ...entry,
            riskShare: estimatedRevenueAtRiskCents > 0
                ? entry.valueCents / estimatedRevenueAtRiskCents
                : 0,
        }))
        .sort((a, b) => b.valueCents - a.valueCents);

    const riskByOwner = Array.from(riskByOwnerMap.values())
        .map((entry) => ({
            ...entry,
            riskShare: estimatedRevenueAtRiskCents > 0
                ? entry.valueCents / estimatedRevenueAtRiskCents
                : 0,
        }))
        .sort((a, b) => b.valueCents - a.valueCents);

    const mostStagnantStage = Array.from(stagnantStageMap.values())
        .sort((a, b) => b.estimatedValueCents - a.estimatedValueCents)[0] ?? null;

    const conversionTrendCurrent = input.proposalEntriesCurrentWindow;
    const conversionTrendPrevious = input.proposalEntriesPreviousWindow;
    const conversionTrendDelta = conversionTrendCurrent - conversionTrendPrevious;
    const conversionTrendDirection: RevenueSignalDirection = conversionTrendDelta > 0
        ? "up"
        : conversionTrendDelta < 0
            ? "down"
            : "flat";

    const conversionTrend = {
        current: conversionTrendCurrent,
        previous: conversionTrendPrevious,
        delta: conversionTrendDelta,
        direction: conversionTrendDirection,
        detail: conversionTrendDirection === "up"
            ? "Entrada de propostas recente aumenta e fortalece proximo fechamento."
            : conversionTrendDirection === "down"
                ? "Entrada de propostas na janela caiu; monitorar origem do gap."
                : "Entrada de propostas ficou estavel entre as janelas recentes.",
    };

    const momentum = deriveMomentum({
        proposalEntriesCurrentWindow: input.proposalEntriesCurrentWindow,
        proposalEntriesPreviousWindow: input.proposalEntriesPreviousWindow,
        activityEntriesCurrentWindow: input.activityEntriesCurrentWindow,
        activityEntriesPreviousWindow: input.activityEntriesPreviousWindow,
        inactiveDealsCount: inactiveDealCount,
        quietCriticalConversationsCount,
    });

    const topAtRiskOpportunities = atRiskOpportunities
        .sort((left, right) => {
            if (right.riskScore !== left.riskScore) {
                return right.riskScore - left.riskScore;
            }
            return right.estimatedValueCents - left.estimatedValueCents;
        })
        .slice(0, 5);

    const riskShare = estimatedOpenRevenueCents > 0
        ? estimatedRevenueAtRiskCents / estimatedOpenRevenueCents
        : 0;
    const tone: RevenueSignalTone = estimatedRevenueAtRiskCents === 0
        ? momentum.tone === "positive"
            ? "positive"
            : "neutral"
        : riskShare >= 0.55 || stalledProposalCount >= 3 || inactiveDealCount >= 4
            ? "critical"
            : riskShare >= 0.25 || quietCriticalConversationsCount > 0
                ? "warning"
                : "neutral";

    const headline = estimatedOpenRevenueCents <= 0
        ? "Ainda nao ha receita aberta suficiente para uma leitura forte de revenue."
        : tone === "critical"
            ? `${formatCurrencyFromCents(estimatedRevenueAtRiskCents)} do pipeline ja opera sob risco de inacao.`
            : tone === "warning"
                ? `Existe ${formatCurrencyFromCents(estimatedRevenueAtRiskCents)} em receita aberta pedindo intervencao curta.`
                : `O pipeline aberto soma ${formatCurrencyFromCents(estimatedOpenRevenueCents)} com risco controlado.`;

    const focus = topAtRiskOpportunities[0]
        ? `${topAtRiskOpportunities[0].company}: ${topAtRiskOpportunities[0].recommendedAction}`
        : mostStagnantStage
            ? `Destravar o stage ${mostStagnantStage.stageLabel} antes de ampliar volume novo.`
            : momentum.detail;

    return {
        generatedAt: now.toISOString(),
        estimatedOpenRevenueCents,
        estimatedRevenueAtRiskCents,
        stalledProposals: {
            count: stalledProposalCount,
            valueCents: stalledProposalValueCents,
            thresholdDays: STALLED_PROPOSAL_THRESHOLD_DAYS,
        },
        inactiveDeals: {
            count: inactiveDealCount,
            valueCents: inactiveDealValueCents,
            thresholdDays: INACTIVE_DEAL_THRESHOLD_DAYS,
        },
        proposalsWithoutResponse: {
            count: proposalsWithoutResponseCount,
            thresholdDays: RESPONSE_GAP_THRESHOLD_DAYS,
        },
        quietCriticalConversations: {
            count: quietCriticalConversationsCount,
            thresholdHours: QUIET_CONVERSATION_THRESHOLD_HOURS,
        },
        mostStagnantStage,
        momentum,
        topAtRiskOpportunities,
        agingBuckets,
        riskByStage,
        riskByOwner,
        conversionTrend,
        summary: {
            tone,
            headline,
            focus,
        },
    };
}

export async function buildTenantRevenueSignals(orgId: string, db: typeof prisma = prisma): Promise<TenantRevenueSignals> {
    const now = new Date();
    const currentWindowStart = addDays(now, -MOMENTUM_WINDOW_DAYS);
    const previousWindowStart = addDays(currentWindowStart, -MOMENTUM_WINDOW_DAYS);
    const client = db as typeof prisma;

    const assessmentRows = await client.assessment.findMany({
        where: {
            organizationId: orgId,
        },
        select: {
            id: true,
            company: true,
            contact: {
                select: {
                    lastInboundAt: true,
                    lastOutboundAt: true,
                    conversations: {
                        orderBy: { lastMessageAt: "desc" },
                        take: 1,
                        select: {
                            id: true,
                            unreadCount: true,
                            lastMessageAt: true,
                            slaDueAt: true,
                        },
                    },
                },
            },
            deal: {
                select: {
                    id: true,
                    status: true,
                    stageId: true,
                    value: true,
                    createdAt: true,
                    stage: {
                        select: {
                            name: true,
                        },
                    },
                    activities: {
                        orderBy: { createdAt: "desc" },
                        take: 1,
                        select: {
                            createdAt: true,
                        },
                    },
                },
            },
            assignments: {
                where: { status: "active" },
                orderBy: { assignedAt: "desc" },
                take: 1,
                select: {
                    salesRep: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
            proposals: {
                orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
                take: 1,
                select: {
                    id: true,
                    status: true,
                    pricingEstimate: true,
                    updatedAt: true,
                },
            },
        },
    });

    const proposalEntriesCurrentWindow = await client.proposal.count({
        where: {
            organizationId: orgId,
            createdAt: {
                gte: currentWindowStart,
                lt: now,
            },
        },
    });

    const proposalEntriesPreviousWindow = await client.proposal.count({
        where: {
            organizationId: orgId,
            createdAt: {
                gte: previousWindowStart,
                lt: currentWindowStart,
            },
        },
    });

    const activityEntriesCurrentWindow = await client.activity.count({
        where: {
            organizationId: orgId,
            createdAt: {
                gte: currentWindowStart,
                lt: now,
            },
        },
    });

    const activityEntriesPreviousWindow = await client.activity.count({
        where: {
            organizationId: orgId,
            createdAt: {
                gte: previousWindowStart,
                lt: currentWindowStart,
            },
        },
    });

    const records: RevenueEngineRecordSnapshot[] = assessmentRows.map((assessment) => {
        const latestConversation = assessment.contact?.conversations[0] ?? null;
        const latestProposal = assessment.proposals[0] ?? null;
        return {
            assessmentId: assessment.id,
            company: assessment.company ?? "Lead sem empresa",
            dealId: assessment.deal?.id ?? null,
            dealStatus: assessment.deal?.status ?? null,
            dealStageId: assessment.deal?.stageId ?? null,
            dealStageLabel: assessment.deal?.stage?.name ?? "Sem stage",
            dealCreatedAt: toIso(assessment.deal?.createdAt ?? null),
            dealValueCents: Number.isFinite(assessment.deal?.value)
                ? Math.round(Number(assessment.deal?.value) * 100)
                : 0,
            latestActivityAt: toIso(assessment.deal?.activities[0]?.createdAt ?? null),
            proposalId: latestProposal?.id ?? null,
            proposalStatus: latestProposal?.status ?? "none",
            proposalUpdatedAt: toIso(latestProposal?.updatedAt ?? null),
            proposalValueCents: parseProposalValueCents(latestProposal?.pricingEstimate),
            conversationId: latestConversation?.id ?? null,
            unreadCount: latestConversation?.unreadCount ?? 0,
            conversationLastMessageAt: toIso(latestConversation?.lastMessageAt ?? null),
            conversationSlaDueAt: toIso(latestConversation?.slaDueAt ?? null),
            contactLastInboundAt: toIso(assessment.contact?.lastInboundAt ?? null),
            contactLastOutboundAt: toIso(assessment.contact?.lastOutboundAt ?? null),
            ownerId: assessment.assignments?.[0]?.salesRep?.id ?? null,
            ownerLabel: assessment.assignments?.[0]?.salesRep?.name ?? "Sem responsavel",
        };
    });

    return buildRevenueEngineSnapshot({
        now,
        records,
        proposalEntriesCurrentWindow,
        proposalEntriesPreviousWindow,
        activityEntriesCurrentWindow,
        activityEntriesPreviousWindow,
    });
}
