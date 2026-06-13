import type { Role } from "@/lib/auth/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { parsePagination } from "@/lib/http/pagination";
import { prisma } from "@/lib/prisma";
import { calculateSlaDueDate } from "@/lib/whatsapp/engines/sla-engine";
import {
    buildRecommendedActions,
    deriveNextAction,
    deriveOperationalPriority,
    formatCadenceLabel,
    parseWorkspaceMetadata,
} from "@/lib/operator/crm-workspace";

import {
    buildWhatsAppCommercialQuickActions,
    buildContactSnapshot,
    buildConversationSnapshot,
    buildMessageSnapshot,
    composeWhatsAppCommercialTimeline,
    resolveWhatsAppConversationAttention,
} from "./crm-service";

import type {
    WhatsAppContactSnapshot,
    WhatsAppConversationSnapshot,
    WhatsAppMessageSnapshot,
} from "./pipeline-contract";
import type { WhatsAppConversationCommercialContext } from "./crm-service";

export type { WhatsAppConversationCommercialContext } from "./crm-service";

export type ConversationAction = "close" | "reopen" | "block_contact";

type ConversationAccessInput = {
    organizationId: string;
    conversationId: string;
};

type ConversationActorScope = {
    role: Role | string;
    userId: string;
};

type ConversationRecord = {
    id: string;
    organizationId: string;
    contactId: string;
    assignedUserId: string | null;
    status: string;
    unreadCount: number;
    lastMessageAt: Date | null;
    lastMessagePreview: string | null;
    slaDueAt: Date | null;
    contact: {
        id: string;
        organizationId: string;
        phoneNumberE164: string;
        name: string | null;
        tags: string;
        lifecycle: string;
        wa_id: string | null;
        optedOutAt: Date | null;
        sessionWindowUntil: Date | null;
        lastInboundAt: Date | null;
        lastOutboundAt: Date | null;
        lastMessageAt: Date | null;
    };
};

export type ScopedConversation = {
    conversation: WhatsAppConversationSnapshot;
    contact: WhatsAppContactSnapshot;
};

function assertConversationVisibility(scope: ConversationActorScope, assignedUserId: string | null): void {
    if (scope.role === "closer" && assignedUserId !== scope.userId) {
        throw new Error("FORBIDDEN: closer requires assignment");
    }
}

function assertConversationMutationAccess(scope: ConversationActorScope, assignedUserId: string | null): void {
    if (scope.role === "viewer") {
        throw new Error("FORBIDDEN: viewer cannot mutate conversation");
    }
    if (scope.role === "closer" && assignedUserId !== scope.userId) {
        throw new Error("FORBIDDEN: closer requires assignment");
    }
}

async function findConversationRecord(input: ConversationAccessInput): Promise<ConversationRecord | null> {
    return prisma.whatsAppConversation.findFirst({
        where: {
            id: input.conversationId,
            organizationId: input.organizationId,
        },
        select: {
            id: true,
            organizationId: true,
            contactId: true,
            assignedUserId: true,
            status: true,
            unreadCount: true,
            lastMessageAt: true,
            lastMessagePreview: true,
            slaDueAt: true,
            contact: {
                select: {
                    id: true,
                    organizationId: true,
                    phoneNumberE164: true,
                    name: true,
                    tags: true,
                    lifecycle: true,
                    wa_id: true,
                    optedOutAt: true,
                    sessionWindowUntil: true,
                    lastInboundAt: true,
                    lastOutboundAt: true,
                    lastMessageAt: true,
                },
            },
        },
    });
}

export async function getScopedConversation(
    input: ConversationAccessInput & ConversationActorScope,
): Promise<ScopedConversation> {
    const conversation = await findConversationRecord(input);
    if (!conversation) {
        throw new Error("CONVERSATION_NOT_FOUND");
    }

    assertConversationVisibility(input, conversation.assignedUserId);

    return {
        conversation: buildConversationSnapshot(conversation),
        contact: buildContactSnapshot(conversation.contact),
    };
}

function parseContactTags(raw: string | null | undefined): string[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map((tag) => String(tag)) : [];
    } catch {
        return [];
    }
}

export async function getConversationCommercialContext(input: ConversationAccessInput & ConversationActorScope & {
    orgSlug: string;
}): Promise<WhatsAppConversationCommercialContext> {
    const conversation = await findConversationRecord(input);
    if (!conversation) {
        throw new Error("CONVERSATION_NOT_FOUND");
    }

    assertConversationVisibility(input, conversation.assignedUserId);

    const assessment = await prisma.assessment.findFirst({
        where: {
            organizationId: input.organizationId,
            contactId: conversation.contactId,
        },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            createdAt: true,
            company: true,
            status: true,
            scoreTotal: true,
            classification: true,
            internalNotes: true,
            deal: {
                select: {
                    id: true,
                    stageId: true,
                    stage: {
                        select: {
                            name: true,
                            pipelineId: true,
                        },
                    },
                    activities: {
                        orderBy: { createdAt: "desc" },
                        take: 6,
                        select: {
                            id: true,
                            type: true,
                            note: true,
                            createdAt: true,
                        },
                    },
                },
            },
            proposals: {
                orderBy: { updatedAt: "desc" },
                take: 4,
                select: {
                    id: true,
                    status: true,
                    version: true,
                    publicSlug: true,
                    pricingEstimate: true,
                    updatedAt: true,
                },
            },
        },
    });

    const [upcomingMeeting, pipeline] = await Promise.all([
        assessment
            ? prisma.meetingSession.findFirst({
                where: {
                    organizationId: input.organizationId,
                    assessmentId: assessment.id,
                    status: { in: ["scheduled", "confirmed", "rescheduled", "active", "pending"] },
                },
                orderBy: { startAt: "asc" },
                select: {
                    id: true,
                    startAt: true,
                    status: true,
                    recommendedCTA: true,
                    leadEmail: true,
                },
            }).catch(() => null)
            : null,
        prisma.pipeline.findFirst({
            where: { organizationId: input.organizationId },
            orderBy: { createdAt: "asc" },
            select: {
                stages: {
                    orderBy: { position: "asc" },
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        }),
    ]);

    const attention = resolveWhatsAppConversationAttention({
        status: conversation.status,
        unreadCount: conversation.unreadCount,
        slaDueAt: conversation.slaDueAt,
        optedOutAt: conversation.contact.optedOutAt,
    });

    if (!assessment) {
        return {
            conversationId: conversation.id,
            contact: {
                id: conversation.contact.id,
                name: conversation.contact.name,
                phoneNumberE164: conversation.contact.phoneNumberE164,
                lifecycle: conversation.contact.lifecycle,
                tags: parseContactTags(conversation.contact.tags),
                waId: conversation.contact.wa_id,
            },
            attention,
            record: null,
            recommendations: [],
            recentEvents: [],
            quickActions: [],
        };
    }

    const workspaceMetadata = parseWorkspaceMetadata(assessment.internalNotes);
    const proposalStatus = assessment.proposals[0]?.status ?? "none";
    const hasUpcomingMeeting = Boolean(upcomingMeeting);
    const priority = deriveOperationalPriority({
        explicitPriority: workspaceMetadata.priority,
        unreadCount: conversation.unreadCount,
        proposalStatus,
        hasUpcomingMeeting,
    });
    const nextAction = deriveNextAction({
        explicitNextAction: workspaceMetadata.nextAction,
        unreadCount: conversation.unreadCount,
        proposalStatus,
        hasDeal: Boolean(assessment.deal?.id),
        hasUpcomingMeeting,
    });
    const nextActionAt = workspaceMetadata.nextActionAt ?? (upcomingMeeting?.startAt?.toISOString() ?? null);
    const recommendations = buildRecommendedActions({
        cadence: workspaceMetadata.cadence,
        unreadCount: conversation.unreadCount,
        proposalStatus,
        hasUpcomingMeeting,
        hasDeal: Boolean(assessment.deal?.id),
        needsAttention: conversation.unreadCount > 0 || ["sent", "viewed"].includes(proposalStatus),
    });
    const activities = (assessment.deal?.activities ?? []).map((activity) => ({
        id: activity.id,
        title: activity.type.replaceAll("_", " "),
        detail: activity.note || "Sem nota adicional",
        eyebrow: "activity",
        at: activity.createdAt.toISOString(),
        tone: activity.type.includes("changed") ? "warning" as const : "neutral" as const,
    }));
    const proposals = assessment.proposals.map((proposal) => ({
        id: proposal.id,
        title: `Proposta v${proposal.version}`,
        detail: proposal.status,
        eyebrow: proposal.status,
        at: proposal.updatedAt.toISOString(),
        tone: proposal.status === "accepted" ? "positive" as const : proposal.status === "sent" ? "warning" as const : "neutral" as const,
    }));
    const meetings = upcomingMeeting ? [{
        id: upcomingMeeting.id,
        title: upcomingMeeting.leadEmail || "Agenda comercial",
        detail: upcomingMeeting.recommendedCTA || `Status ${upcomingMeeting.status}`,
        eyebrow: "meeting",
        at: upcomingMeeting.startAt.toISOString(),
        tone: "positive" as const,
    }] : [];

    return {
        conversationId: conversation.id,
        contact: {
            id: conversation.contact.id,
            name: conversation.contact.name,
            phoneNumberE164: conversation.contact.phoneNumberE164,
            lifecycle: conversation.contact.lifecycle,
            tags: parseContactTags(conversation.contact.tags),
            waId: conversation.contact.wa_id,
        },
        attention,
        record: {
            assessmentId: assessment.id,
            company: assessment.company || "Lead sem empresa",
            status: assessment.status,
            scoreLabel: `${assessment.scoreTotal} · ${assessment.classification}`,
            stageId: assessment.deal?.stageId ?? null,
            stageLabel: assessment.deal?.stage?.name ?? "Sem deal",
            proposalLabel: assessment.proposals[0]?.status ? `${assessment.proposals[0].status} · v${assessment.proposals[0].version}` : "Sem proposta",
            proposalPublicSlug: assessment.proposals[0]?.publicSlug ?? null,
            ownerLabel: conversation.assignedUserId ? "Responsavel atribuido" : "Sem responsavel",
            priority,
            cadenceLabel: formatCadenceLabel(workspaceMetadata.cadence),
            nextAction,
            nextActionAtLabel: nextActionAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(nextActionAt)) : "-",
            crmHref: `/org/${input.orgSlug}/admin/crm?assessmentId=${assessment.id}`,
            stageOptions: (pipeline?.stages ?? []).map((stage) => ({ value: stage.id, label: stage.name })),
        },
        recommendations,
        recentEvents: composeWhatsAppCommercialTimeline({
            activities,
            proposals,
            meetings,
        }),
        quickActions: buildWhatsAppCommercialQuickActions({
            orgSlug: input.orgSlug,
            assessmentId: assessment.id,
            conversationId: conversation.id,
            nextAction,
            nextActionAt,
            recommendations,
            proposalPublicSlug: assessment.proposals[0]?.publicSlug ?? null,
        }),
    };
}

export async function listWhatsAppConversations(input: {
    organizationId: string;
    role: Role | string;
    userId: string;
    searchParams: URLSearchParams;
}) {
    const unreadOnly = input.searchParams.get("unread") === "true";
    const requestedStatus = input.searchParams.get("status");
    const status = requestedStatus === "closed" || requestedStatus === "snoozed" ? requestedStatus : "open";
    const pagination = parsePagination(input.searchParams, { defaultLimit: 50, maxLimit: 100 });

    const where = {
        organizationId: input.organizationId,
        status,
        ...(unreadOnly ? { unreadCount: { gt: 0 } } : {}),
        ...(input.role === "closer" ? { assignedUserId: input.userId } : {}),
    };

    const [total, conversations] = await prisma.$transaction([
        prisma.whatsAppConversation.count({ where }),
        prisma.whatsAppConversation.findMany({
            where,
            select: {
                id: true,
                organizationId: true,
                contactId: true,
                assignedUserId: true,
                status: true,
                slaDueAt: true,
                lastMessageAt: true,
                lastMessagePreview: true,
                unreadCount: true,
                createdAt: true,
                updatedAt: true,
                contact: {
                    select: {
                        id: true,
                        organizationId: true,
                        name: true,
                        phoneNumberE164: true,
                        tags: true,
                        lifecycle: true,
                        optedOutAt: true,
                        lastOutboundAt: true,
                        lastInboundAt: true,
                        lastMessageAt: true,
                        sessionWindowUntil: true,
                    },
                },
                user: {
                    select: {
                        email: true,
                    },
                },
                messages: {
                    select: {
                        id: true,
                        organizationId: true,
                        conversationId: true,
                        contactId: true,
                        messageId: true,
                        direction: true,
                        type: true,
                        text: true,
                        status: true,
                        sentAt: true,
                        deliveredAt: true,
                        readAt: true,
                        failedAt: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: "desc" },
                    take: 20,
                },
            },
            orderBy: [
                { unreadCount: "desc" },
                { slaDueAt: "asc" },
                { lastMessageAt: "desc" },
            ],
            skip: pagination.skip,
            take: pagination.limit,
        }),
    ]);

    const now = new Date();
    return {
        total,
        pagination,
        conversations: conversations.map((conversation) => ({
            ...conversation,
            messages: [...conversation.messages].reverse().map(buildMessageSnapshot),
            isOutside24h: conversation.contact.sessionWindowUntil
                ? new Date(conversation.contact.sessionWindowUntil) < now
                : true,
        })),
    };
}

export async function listConversationMessages(input: {
    organizationId: string;
    role: Role | string;
    userId: string;
    conversationId: string;
    searchParams: URLSearchParams;
}) {
    const conversation = await findConversationRecord({
        organizationId: input.organizationId,
        conversationId: input.conversationId,
    });

    if (!conversation) {
        throw new Error("CONVERSATION_NOT_FOUND");
    }

    assertConversationVisibility(input, conversation.assignedUserId);

    const pagination = parsePagination(input.searchParams, { defaultLimit: 100, maxLimit: 200 });
    const [total, messagesDesc] = await prisma.$transaction([
        prisma.whatsAppMessage.count({
            where: {
                organizationId: input.organizationId,
                conversationId: input.conversationId,
            },
        }),
        prisma.whatsAppMessage.findMany({
            where: {
                organizationId: input.organizationId,
                conversationId: input.conversationId,
            },
            select: {
                id: true,
                organizationId: true,
                conversationId: true,
                contactId: true,
                messageId: true,
                direction: true,
                type: true,
                text: true,
                mediaUrl: true,
                status: true,
                replyToId: true,
                sentAt: true,
                deliveredAt: true,
                readAt: true,
                failedAt: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            skip: pagination.skip,
            take: pagination.limit,
        }),
    ]);

    if (conversation.unreadCount > 0) {
        await prisma.whatsAppConversation.update({
            where: { id: input.conversationId },
            data: { unreadCount: 0 },
        });
    }

    return {
        pagination,
        total,
        messages: [...messagesDesc].reverse().map(buildMessageSnapshot) as Array<WhatsAppMessageSnapshot & {
            mediaUrl?: string | null;
            replyToId?: string | null;
        }>,
    };
}

export async function applyConversationAction(input: {
    organizationId: string;
    role: Role | string;
    userId: string;
    conversationId: string;
    action: ConversationAction;
}) {
    const conversation = await findConversationRecord({
        organizationId: input.organizationId,
        conversationId: input.conversationId,
    });

    if (!conversation) {
        throw new Error("CONVERSATION_NOT_FOUND");
    }

    assertConversationMutationAccess(input, conversation.assignedUserId);

    if (input.action === "close") {
        const updated = await prisma.whatsAppConversation.update({
            where: { id: input.conversationId },
            data: { status: "closed", unreadCount: 0 },
            select: {
                id: true,
                organizationId: true,
                contactId: true,
                assignedUserId: true,
                status: true,
                unreadCount: true,
                lastMessageAt: true,
                lastMessagePreview: true,
                slaDueAt: true,
            },
        });

        await writeAuditEvent({
            organizationId: input.organizationId,
            action: "whatsappConversationClosed",
            details: { conversationId: input.conversationId, byUserId: input.userId },
            strict: true,
            context: { conversationId: input.conversationId },
        });

        return {
            action: input.action,
            conversation: buildConversationSnapshot(updated),
        };
    }

    if (input.action === "reopen") {
        if (conversation.contact.optedOutAt) {
            throw new Error("CONTACT_OPTED_OUT");
        }

        const updated = await prisma.whatsAppConversation.update({
            where: { id: input.conversationId },
            data: {
                status: "open",
                slaDueAt: calculateSlaDueDate(input.organizationId),
            },
            select: {
                id: true,
                organizationId: true,
                contactId: true,
                assignedUserId: true,
                status: true,
                unreadCount: true,
                lastMessageAt: true,
                lastMessagePreview: true,
                slaDueAt: true,
            },
        });

        await writeAuditEvent({
            organizationId: input.organizationId,
            action: "whatsappConversationReopened",
            details: { conversationId: input.conversationId, byUserId: input.userId },
            strict: true,
            context: { conversationId: input.conversationId },
        });

        return {
            action: input.action,
            conversation: buildConversationSnapshot(updated),
        };
    }

    await prisma.$transaction([
        prisma.contact.updateMany({
            where: { id: conversation.contact.id, organizationId: input.organizationId },
            data: {
                optedOutAt: new Date(),
                optOutReason: `manual_block:${input.userId}`,
            },
        }),
        prisma.whatsAppConversation.update({
            where: { id: input.conversationId },
            data: { status: "closed", unreadCount: 0 },
        }),
    ]);

    await writeAuditEvent({
        organizationId: input.organizationId,
        action: "whatsappContactBlocked",
        details: { conversationId: input.conversationId, contactId: conversation.contact.id, byUserId: input.userId },
        strict: true,
        context: { conversationId: input.conversationId, contactId: conversation.contact.id },
    });

    return {
        action: input.action,
        conversation: buildConversationSnapshot({
            ...conversation,
            status: "closed",
            unreadCount: 0,
        }),
        contact: buildContactSnapshot({
            ...conversation.contact,
            optedOutAt: new Date(),
        }),
    };
}
