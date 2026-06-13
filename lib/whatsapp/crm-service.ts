import { prisma } from "@/lib/prisma";
import { ensureCommercialDealForContact } from "@/lib/commercial/canonical-flow";
import type {
    CrmEditableField,
    CrmFieldOption,
    CrmPlaybookId,
    CrmRecommendedAction,
    CrmRecordTimelineItem,
} from "@/lib/operator/crm-workspace";

import type {
    WhatsAppContactSnapshot,
    WhatsAppConversationSnapshot,
    WhatsAppDealLink,
    WhatsAppMessageDirection,
    WhatsAppMessageSnapshot,
} from "./pipeline-contract";

type EnsureDealInput = {
    organizationId: string;
    contactId: string;
    messageDirection?: WhatsAppMessageDirection;
    messageText?: string | null;
};

export type WhatsAppConversationAttention = {
    label: string;
    detail: string;
    tone: "neutral" | "positive" | "warning" | "critical";
};

export interface WhatsAppCommercialTimelineItem extends CrmRecordTimelineItem {
    kind: "activity" | "proposal" | "meeting";
}

export interface WhatsAppCommercialQuickAction {
    id: string;
    assessmentId: string;
    label: string;
    description: string;
    tone: "neutral" | "positive" | "warning" | "critical";
    kind: "link" | "playbook" | "inline-update";
    href?: string;
    playbookId?: CrmPlaybookId;
    field?: CrmEditableField;
    value?: string;
}

export interface WhatsAppConversationCommercialContext {
    conversationId: string;
    contact: {
        id: string;
        name: string | null;
        phoneNumberE164: string;
        lifecycle: string;
        tags: string[];
        waId: string | null;
    };
    attention: WhatsAppConversationAttention;
    record: null | {
        assessmentId: string;
        company: string;
        status: string;
        scoreLabel: string;
        stageId: string | null;
        stageLabel: string;
        proposalLabel: string;
        proposalPublicSlug: string | null;
        ownerLabel: string;
        priority: string;
        cadenceLabel: string;
        nextAction: string;
        nextActionAtLabel: string;
        crmHref: string;
        stageOptions: CrmFieldOption[];
    };
    recommendations: CrmRecommendedAction[];
    recentEvents: WhatsAppCommercialTimelineItem[];
    quickActions: WhatsAppCommercialQuickAction[];
}

function truncateMessagePreview(messageText: string | null | undefined): string {
    if (!messageText) return "No message body";
    const normalized = messageText.replace(/\s+/g, " ").trim();
    return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized;
}

export function buildContactSnapshot(contact: {
    id: string;
    organizationId: string;
    phoneNumberE164: string;
    name: string | null;
    optedOutAt: Date | null;
    sessionWindowUntil: Date | null;
    lastInboundAt: Date | null;
    lastOutboundAt: Date | null;
    lastMessageAt: Date | null;
}): WhatsAppContactSnapshot {
    return { ...contact };
}

export function buildConversationSnapshot(conversation: {
    id: string;
    organizationId: string;
    contactId: string;
    assignedUserId: string | null;
    status: string;
    unreadCount: number;
    lastMessageAt: Date | null;
    lastMessagePreview: string | null;
    slaDueAt: Date | null;
}): WhatsAppConversationSnapshot {
    return { ...conversation };
}

export function buildMessageSnapshot(message: {
    id: string;
    organizationId: string;
    conversationId: string;
    contactId: string;
    messageId: string | null;
    direction: string;
    type: string;
    text: string | null;
    status: string;
    sentAt: Date | null;
    deliveredAt: Date | null;
    readAt: Date | null;
    failedAt: Date | null;
    createdAt: Date;
}): WhatsAppMessageSnapshot {
    return {
        id: message.id,
        organizationId: message.organizationId,
        conversationId: message.conversationId,
        contactId: message.contactId,
        externalMessageId: message.messageId,
        direction: message.direction as WhatsAppMessageDirection,
        type: message.type,
        text: message.text,
        status: message.status,
        sentAt: message.sentAt,
        deliveredAt: message.deliveredAt,
        readAt: message.readAt,
        failedAt: message.failedAt,
        createdAt: message.createdAt,
    };
}

export function resolveWhatsAppMessageLifecycleLabel(message: {
    status: string;
    deliveredAt: Date | null;
    readAt: Date | null;
    failedAt: Date | null;
}): string {
    if (message.readAt) return "Lida";
    if (message.deliveredAt) return "Entregue";
    if (message.failedAt) return "Falhou";

    switch (message.status) {
        case "queued":
            return "Na fila";
        case "accepted":
            return "Aceita";
        case "sent":
            return "Enviada";
        case "delivered":
            return "Entregue";
        case "read":
            return "Lida";
        case "failed":
            return "Falhou";
        case "received":
            return "Recebida";
        default:
            return message.status || "-";
    }
}

export function resolveWhatsAppConversationAttention(input: {
    status: string;
    unreadCount: number;
    slaDueAt: Date | null;
    optedOutAt?: Date | null;
}): WhatsAppConversationAttention {
    if (input.optedOutAt) {
        return {
            label: "Contato bloqueado",
            detail: "O contato nao deve receber novos envios pelo canal.",
            tone: "critical",
        };
    }

    if (input.unreadCount > 0 && input.slaDueAt && input.slaDueAt.getTime() < Date.now()) {
        return {
            label: "Resposta vencida",
            detail: `${input.unreadCount} mensagens aguardam retorno fora do SLA.`,
            tone: "critical",
        };
    }

    if (input.unreadCount > 0) {
        return {
            label: "Resposta pendente",
            detail: `${input.unreadCount} mensagens aguardam retorno no WhatsApp.`,
            tone: "warning",
        };
    }

    if (input.status === "closed") {
        return {
            label: "Conversa fechada",
            detail: "Nao ha pendencia aberta no inbox neste momento.",
            tone: "neutral",
        };
    }

    if (input.status === "snoozed") {
        return {
            label: "Conversa adiada",
            detail: "A conversa esta pausada e pode voltar para a fila depois.",
            tone: "warning",
        };
    }

    return {
        label: "Conversa ativa",
        detail: "O canal esta pronto para continuidade operacional.",
        tone: "positive",
    };
}

export function composeWhatsAppCommercialTimeline(input: {
    activities: CrmRecordTimelineItem[];
    proposals: CrmRecordTimelineItem[];
    meetings: CrmRecordTimelineItem[];
}): WhatsAppCommercialTimelineItem[] {
    return [
        ...input.activities.map((item) => ({ ...item, id: `activity:${item.id}`, kind: "activity" as const })),
        ...input.proposals.map((item) => ({ ...item, id: `proposal:${item.id}`, kind: "proposal" as const })),
        ...input.meetings.map((item) => ({ ...item, id: `meeting:${item.id}`, kind: "meeting" as const })),
    ]
        .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
        .slice(0, 6);
}

export function buildWhatsAppCommercialQuickActions(input: {
    orgSlug: string;
    assessmentId: string;
    conversationId: string;
    nextAction: string;
    nextActionAt: string | null;
    recommendations: CrmRecommendedAction[];
    proposalPublicSlug?: string | null;
}): WhatsAppCommercialQuickAction[] {
    const actions: WhatsAppCommercialQuickAction[] = [
        {
            id: "open-crm-record",
            assessmentId: input.assessmentId,
            label: "Abrir record 360",
            description: "Abre o detalhe 360 do CRM para este mesmo registro.",
            tone: "neutral",
            kind: "link",
            href: `/org/${input.orgSlug}/admin/crm?assessmentId=${input.assessmentId}`,
        },
        {
            id: "register-follow-up",
            assessmentId: input.assessmentId,
            label: "Registrar follow-up",
            description: `Salva "${input.nextAction}" como proxima acao do record.`,
            tone: "positive",
            kind: "inline-update",
            field: "workspace.nextAction",
            value: input.nextAction,
        },
    ];

    if (input.nextActionAt) {
        actions.push({
            id: "mark-next-action",
            assessmentId: input.assessmentId,
            label: "Marcar proxima acao",
            description: "Fixa a proxima data operacional no CRM canonico.",
            tone: "positive",
            kind: "inline-update",
            field: "workspace.nextActionAt",
            value: input.nextActionAt,
        });
    }

    if (input.recommendations[0]) {
        actions.push({
            id: `playbook:${input.recommendations[0].playbookId}`,
            assessmentId: input.assessmentId,
            label: input.recommendations[0].actionLabel,
            description: input.recommendations[0].reason,
            tone: "warning",
            kind: "playbook",
            playbookId: input.recommendations[0].playbookId,
        });
    }

    if (input.proposalPublicSlug) {
        actions.push({
            id: "open-proposal",
            assessmentId: input.assessmentId,
            label: "Abrir proposta",
            description: "Abre a proposta mais relevante ligada a esta conversa.",
            tone: "warning",
            kind: "link",
            href: `/org/${input.orgSlug}/proposta/${input.proposalPublicSlug}`,
        });
    }

    return actions.slice(0, 5);
}

export async function ensureCanonicalDealLink(input: EnsureDealInput): Promise<WhatsAppDealLink> {
    const dealResolution = await ensureCommercialDealForContact({
        organizationId: input.organizationId,
        contactId: input.contactId,
        source: "whatsapp",
    });

    let messageActivityId: string | null = null;
    if (dealResolution.dealId && input.messageDirection) {
        const activity = await prisma.activity.create({
            data: {
                organizationId: input.organizationId,
                dealId: dealResolution.dealId,
                type: input.messageDirection === "inbound" ? "whatsapp_inbound_message" : "whatsapp_outbound_message",
                note: truncateMessagePreview(input.messageText),
            },
            select: { id: true },
        });
        messageActivityId = activity.id;
    }

    return {
        dealId: dealResolution.dealId,
        pipelineId: dealResolution.pipelineId,
        stageId: dealResolution.stageId,
        created: dealResolution.created,
        reused: dealResolution.reused,
        activityIds: messageActivityId ? [...dealResolution.activityIds, messageActivityId] : dealResolution.activityIds,
        messageActivityId,
        dealCreatedActivityId: dealResolution.dealCreatedActivityId,
    };
}
