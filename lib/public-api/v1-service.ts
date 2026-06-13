import { ensureDefaultCommercialPipelineStage } from "@/lib/commercial/canonical-flow";
import { buildTenantExecutiveDashboard, type ExecutivePriorityAlert } from "@/lib/executive/tenant-intelligence";
import {
    recordOnboardingFirstContact,
    recordOnboardingFirstDeal,
    recordOnboardingPipelineConfigured,
} from "@/lib/onboarding-status";
import { PublicApiError } from "@/lib/public-api/v1-auth";
import { buildPublicApiPaginationMeta } from "@/lib/public-api/v1-pagination";
import type { PublicApiPaginationMeta } from "@/lib/public-api/v1-response";
import { emitWebhookEvent } from "@/lib/public-api/webhooks";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/whatsapp";

export interface PublicApiListResponse<T> {
    items: T[];
    pagination: PublicApiPaginationMeta;
}

export interface PublicApiContactItem {
    id: string;
    name: string | null;
    email: string | null;
    phoneNumberE164: string;
    lifecycle: string;
    tags: string[];
    lastMessageAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface PublicApiDealItem {
    id: string;
    contactId: string;
    contact: {
        id: string;
        name: string | null;
        email: string | null;
        phoneNumberE164: string;
        lifecycle: string;
        tags: string[];
    };
    stage: {
        id: string;
        name: string;
        pipelineId: string;
    };
    value: number | null;
    status: string;
    activityCount: number;
    createdAt: string;
}

export interface PublicApiActivityItem {
    id: string;
    dealId: string;
    type: string;
    note: string | null;
    createdAt: string;
    deal: {
        id: string;
        status: string;
        value: number | null;
        contact: {
            id: string;
            name: string | null;
            email: string | null;
            phoneNumberE164: string;
        };
        stage: {
            id: string;
            name: string;
        };
    };
}

export interface PublicApiConversationContact {
    id: string;
    name: string | null;
    email: string | null;
    phoneNumberE164: string | null;
}

export interface PublicApiConversationAssignedUser {
    id: string;
    email: string;
}

export interface PublicApiConversationItem {
    id: string;
    channel: "whatsapp" | "email";
    status: string;
    title: string;
    contact: PublicApiConversationContact | null;
    assignedUser: PublicApiConversationAssignedUser | null;
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
    unreadCount: number;
    subject: string | null;
    slaDueAt: string | null;
    threadId: string | null;
    conversationId: string | null;
}

export interface PublicApiConversationListResponse {
    items: PublicApiConversationItem[];
    pagination: PublicApiPaginationMeta;
    summary: {
        total: number;
        whatsapp: number;
        email: number;
    };
}

export interface PublicApiExecutivePulseResponse {
    org: {
        id: string;
        slug: string;
        name: string;
        plan: string;
    };
    generatedAt: string;
    hasData: boolean;
    emptyReason: string | null;
    overview: {
        headline: string;
        subheadline: string;
    };
    prioritizedAlerts: ExecutivePriorityAlert[];
    decisionNarrative: {
        tone: string;
        summary: string;
        stateOfPlay: string;
        biggestRisk: string;
        biggestOpportunity: string;
        focusNow: string[];
    };
    warnings: string[];
}

const CLOSED_DEAL_STATUSES = new Set(["closed_won", "closed_lost", "archived"]);
const MAX_CONVERSATION_FETCH = 500;

function toIso(value: Date | null | undefined): string | null {
    return value ? value.toISOString() : null;
}

function parseStringArray(value: string | null | undefined): string[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    } catch {
        return [];
    }
}

function uniqueTags(tags: string[] | undefined): string[] {
    if (!tags) return [];
    return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function mapContact(contact: {
    id: string;
    name: string | null;
    email: string | null;
    phoneNumberE164: string;
    lifecycle: string;
    tags: string;
    lastMessageAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}): PublicApiContactItem {
    return {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phoneNumberE164: contact.phoneNumberE164,
        lifecycle: contact.lifecycle,
        tags: parseStringArray(contact.tags),
        lastMessageAt: toIso(contact.lastMessageAt),
        createdAt: contact.createdAt.toISOString(),
        updatedAt: contact.updatedAt.toISOString(),
    };
}

function mapDeal(deal: {
    id: string;
    contactId: string;
    contact: {
        id: string;
        name: string | null;
        email: string | null;
        phoneNumberE164: string;
        lifecycle: string;
        tags: string;
    };
    stage: {
        id: string;
        name: string;
        pipelineId: string;
    };
    value: number | null;
    status: string;
    createdAt: Date;
    _count: {
        activities: number;
    };
}): PublicApiDealItem {
    return {
        id: deal.id,
        contactId: deal.contactId,
        contact: {
            id: deal.contact.id,
            name: deal.contact.name,
            email: deal.contact.email,
            phoneNumberE164: deal.contact.phoneNumberE164,
            lifecycle: deal.contact.lifecycle,
            tags: parseStringArray(deal.contact.tags),
        },
        stage: {
            id: deal.stage.id,
            name: deal.stage.name,
            pipelineId: deal.stage.pipelineId,
        },
        value: deal.value,
        status: deal.status,
        activityCount: deal._count.activities,
        createdAt: deal.createdAt.toISOString(),
    };
}

function mapActivity(activity: {
    id: string;
    dealId: string;
    type: string;
    note: string | null;
    createdAt: Date;
    deal: {
        id: string;
        status: string;
        value: number | null;
        contact: {
            id: string;
            name: string | null;
            email: string | null;
            phoneNumberE164: string;
        };
        stage: {
            id: string;
            name: string;
        };
    };
}): PublicApiActivityItem {
    return {
        id: activity.id,
        dealId: activity.dealId,
        type: activity.type,
        note: activity.note,
        createdAt: activity.createdAt.toISOString(),
        deal: {
            id: activity.deal.id,
            status: activity.deal.status,
            value: activity.deal.value,
            contact: {
                id: activity.deal.contact.id,
                name: activity.deal.contact.name,
                email: activity.deal.contact.email,
                phoneNumberE164: activity.deal.contact.phoneNumberE164,
            },
            stage: {
                id: activity.deal.stage.id,
                name: activity.deal.stage.name,
            },
        },
    };
}

function normalizeConversationTitle(input: {
    channel: "whatsapp" | "email";
    contact: PublicApiConversationContact | null;
    subject: string | null;
}): string {
    if (input.channel === "email" && input.subject) {
        return input.subject;
    }

    return input.contact?.name
        ?? input.contact?.email
        ?? input.contact?.phoneNumberE164
        ?? (input.channel === "email" ? "Email thread" : "WhatsApp conversation");
}

function latestTimestamp(values: Array<Date | null | undefined>): number {
    return values.reduce((latest, value) => {
        if (!value) return latest;
        const timestamp = value.getTime();
        return timestamp > latest ? timestamp : latest;
    }, 0);
}

export async function listPublicContacts(input: {
    organizationId: string;
    offset: number;
    limit: number;
}): Promise<PublicApiListResponse<PublicApiContactItem>> {
    const [total, contacts] = await Promise.all([
        prisma.contact.count({
            where: {
                organizationId: input.organizationId,
            },
        }),
        prisma.contact.findMany({
                where: {
                    organizationId: input.organizationId,
                },
                orderBy: [
                    { updatedAt: "desc" },
                    { createdAt: "desc" },
                ],
                skip: input.offset,
                take: input.limit,
                select: {
                id: true,
                name: true,
                email: true,
                phoneNumberE164: true,
                lifecycle: true,
                tags: true,
                lastMessageAt: true,
                createdAt: true,
                updatedAt: true,
            },
        }),
    ]);

    return {
        items: contacts.map(mapContact),
        pagination: buildPublicApiPaginationMeta({
            offset: input.offset,
            limit: input.limit,
            total,
            returnedCount: contacts.length,
        }),
    };
}

export async function createPublicContact(input: {
    organizationId: string;
    phoneNumberE164: string;
    name?: string | null;
    email?: string | null;
    lifecycle?: string | null;
    tags?: string[] | null;
}): Promise<PublicApiContactItem> {
    const phoneNumberE164 = normalizePhone(input.phoneNumberE164);
    const normalizedDigits = phoneNumberE164.replace(/\D/g, "");
    if (normalizedDigits.length < 10) {
        throw new PublicApiError("phoneNumberE164 is required.", 400, "VALIDATION_ERROR");
    }
    const tags = uniqueTags(input.tags ?? undefined);
    const name = typeof input.name === "string" && input.name.trim() ? input.name.trim() : null;
    const email = typeof input.email === "string" && input.email.trim() ? input.email.trim().toLowerCase() : null;
    const lifecycle = typeof input.lifecycle === "string" && input.lifecycle.trim() ? input.lifecycle.trim() : null;
    const existingContact = await prisma.contact.findFirst({
        where: {
            organizationId: input.organizationId,
            phoneNumberE164,
        },
        select: {
            id: true,
        },
    });

    const contact = await prisma.contact.upsert({
        where: {
            organizationId_phoneNumberE164: {
                organizationId: input.organizationId,
                phoneNumberE164,
            },
        },
        create: {
            organizationId: input.organizationId,
            phoneNumberE164,
            name,
            email,
            lifecycle: lifecycle ?? "lead",
            tags: JSON.stringify(tags),
        },
        update: {
            ...(name ? { name } : {}),
            ...(email ? { email } : {}),
            ...(lifecycle ? { lifecycle } : {}),
            ...(input.tags ? { tags: JSON.stringify(tags) } : {}),
        },
        select: {
            id: true,
            name: true,
            email: true,
            phoneNumberE164: true,
            lifecycle: true,
            tags: true,
            lastMessageAt: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    if (!existingContact) {
        void emitWebhookEvent({
            organizationId: input.organizationId,
            eventType: "contact.created",
            data: {
                contact: mapContact(contact),
            },
        });
        void recordOnboardingFirstContact(input.organizationId).catch(() => undefined);
    }

    return mapContact(contact);
}

export async function listPublicDeals(input: {
    organizationId: string;
    offset: number;
    limit: number;
}): Promise<PublicApiListResponse<PublicApiDealItem>> {
    const [total, deals] = await Promise.all([
        prisma.deal.count({
            where: {
                organizationId: input.organizationId,
            },
        }),
        prisma.deal.findMany({
                where: {
                    organizationId: input.organizationId,
                },
                orderBy: [
                    { createdAt: "desc" },
                ],
                skip: input.offset,
                take: input.limit,
                select: {
                id: true,
                contactId: true,
                contact: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phoneNumberE164: true,
                        lifecycle: true,
                        tags: true,
                    },
                },
                stage: {
                    select: {
                        id: true,
                        name: true,
                        pipelineId: true,
                    },
                },
                value: true,
                status: true,
                createdAt: true,
                _count: {
                    select: {
                        activities: true,
                    },
                },
            },
        }),
    ]);

    return {
        items: deals.map(mapDeal),
        pagination: buildPublicApiPaginationMeta({
            offset: input.offset,
            limit: input.limit,
            total,
            returnedCount: deals.length,
        }),
    };
}

export async function createPublicDeal(input: {
    organizationId: string;
    contactId: string;
    stageId?: string | null;
    value?: number | null;
    status?: string | null;
}): Promise<{ deal: PublicApiDealItem; created: boolean }> {
    const contact = await prisma.contact.findFirst({
        where: {
            id: input.contactId,
            organizationId: input.organizationId,
        },
        select: {
            id: true,
        },
    });

    if (!contact) {
        throw new PublicApiError("Contact not found.", 404, "NOT_FOUND");
    }

    const stage = input.stageId
        ? await prisma.pipelineStage.findFirst({
            where: {
                id: input.stageId,
                pipeline: {
                    organizationId: input.organizationId,
                },
            },
            select: {
                id: true,
                name: true,
                pipelineId: true,
            },
        })
        : await ensureDefaultCommercialPipelineStage({
            organizationId: input.organizationId,
        }).then(async (defaultStage) => prisma.pipelineStage.findUnique({
            where: { id: defaultStage.stageId },
            select: {
                id: true,
                name: true,
                pipelineId: true,
            },
        }));

    if (!stage) {
        throw new PublicApiError("Pipeline stage not found.", 404, "NOT_FOUND");
    }

    void recordOnboardingPipelineConfigured(input.organizationId).catch(() => undefined);

    const existingOpenDeal = await prisma.deal.findFirst({
        where: {
            organizationId: input.organizationId,
            contactId: input.contactId,
            status: {
                notIn: [...CLOSED_DEAL_STATUSES],
            },
        },
        orderBy: {
            createdAt: "desc",
        },
        select: {
            id: true,
        },
    });

    const deal = existingOpenDeal
        ? await prisma.deal.update({
            where: {
                id: existingOpenDeal.id,
            },
            data: {
                stageId: stage.id,
                ...(typeof input.value === "number" ? { value: input.value } : {}),
                ...(typeof input.status === "string" && input.status.trim() ? { status: input.status.trim() } : {}),
            },
            select: {
                id: true,
                contactId: true,
                contact: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phoneNumberE164: true,
                        lifecycle: true,
                        tags: true,
                    },
                },
                stage: {
                    select: {
                        id: true,
                        name: true,
                        pipelineId: true,
                    },
                },
                value: true,
                status: true,
                createdAt: true,
                _count: {
                    select: {
                        activities: true,
                    },
                },
            },
        })
        : await prisma.deal.create({
            data: {
                organizationId: input.organizationId,
                contactId: input.contactId,
                stageId: stage.id,
                value: typeof input.value === "number" ? input.value : null,
                status: typeof input.status === "string" && input.status.trim() ? input.status.trim() : "open",
            },
            select: {
                id: true,
                contactId: true,
                contact: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phoneNumberE164: true,
                        lifecycle: true,
                        tags: true,
                    },
                },
                stage: {
                    select: {
                        id: true,
                        name: true,
                        pipelineId: true,
                    },
                },
                value: true,
                status: true,
                createdAt: true,
                _count: {
                    select: {
                        activities: true,
                    },
                },
            },
        });

    void emitWebhookEvent({
        organizationId: input.organizationId,
        eventType: existingOpenDeal ? "deal.updated" : "deal.created",
        data: {
            deal: mapDeal(deal),
            created: !existingOpenDeal,
        },
    });

    if (!existingOpenDeal) {
        void recordOnboardingFirstDeal(input.organizationId).catch(() => undefined);
    }

    return {
        created: !existingOpenDeal,
        deal: mapDeal(deal),
    };
}

export async function listPublicActivities(input: {
    organizationId: string;
    offset: number;
    limit: number;
    dealId?: string | null;
}): Promise<PublicApiListResponse<PublicApiActivityItem>> {
    const where = {
        organizationId: input.organizationId,
        ...(input.dealId ? { dealId: input.dealId } : {}),
    };

    const [total, activities] = await Promise.all([
        prisma.activity.count({ where }),
        prisma.activity.findMany({
            where,
            orderBy: [
                { createdAt: "desc" },
            ],
            skip: input.offset,
            take: input.limit,
            select: {
                id: true,
                dealId: true,
                type: true,
                note: true,
                createdAt: true,
                deal: {
                    select: {
                        id: true,
                        status: true,
                        value: true,
                        contact: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                phoneNumberE164: true,
                            },
                        },
                        stage: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
        }),
    ]);

    return {
        items: activities.map(mapActivity),
        pagination: buildPublicApiPaginationMeta({
            offset: input.offset,
            limit: input.limit,
            total,
            returnedCount: activities.length,
        }),
    };
}

export async function createPublicActivity(input: {
    organizationId: string;
    dealId: string;
    type: string;
    note?: string | null;
}): Promise<PublicApiActivityItem> {
    const deal = await prisma.deal.findFirst({
        where: {
            id: input.dealId,
            organizationId: input.organizationId,
        },
        select: {
            id: true,
        },
    });

    if (!deal) {
        throw new PublicApiError("Deal not found.", 404, "NOT_FOUND");
    }

    const activity = await prisma.activity.create({
        data: {
            organizationId: input.organizationId,
            dealId: input.dealId,
            type: input.type.trim(),
            note: typeof input.note === "string" && input.note.trim() ? input.note.trim() : null,
        },
        select: {
            id: true,
            dealId: true,
            type: true,
            note: true,
            createdAt: true,
            deal: {
                select: {
                    id: true,
                    status: true,
                    value: true,
                    contact: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phoneNumberE164: true,
                        },
                    },
                    stage: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
        },
    });

    void emitWebhookEvent({
        organizationId: input.organizationId,
        eventType: "activity.created",
        data: {
            activity: mapActivity(activity),
        },
    });

    return mapActivity(activity);
}

export async function listPublicConversations(input: {
    organizationId: string;
    offset: number;
    limit: number;
}): Promise<{
    items: PublicApiConversationItem[];
    pagination: PublicApiPaginationMeta;
    summary: {
        total: number;
        whatsapp: number;
        email: number;
    };
}> {
    const fetchWindow = Math.min(MAX_CONVERSATION_FETCH, Math.max(input.limit, input.offset + input.limit));

    const [whatsappTotal, emailTotal, whatsappConversations, emailThreads] = await Promise.all([
        prisma.whatsAppConversation.count({
            where: {
                organizationId: input.organizationId,
            },
        }),
        prisma.emailThread.count({
            where: {
                organizationId: input.organizationId,
            },
        }),
        prisma.whatsAppConversation.findMany({
            where: {
                organizationId: input.organizationId,
            },
            orderBy: [
                { lastMessageAt: "desc" },
                { updatedAt: "desc" },
            ],
            take: fetchWindow,
            select: {
                id: true,
                status: true,
                unreadCount: true,
                lastMessageAt: true,
                lastMessagePreview: true,
                slaDueAt: true,
                createdAt: true,
                updatedAt: true,
                contact: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phoneNumberE164: true,
                    },
                },
                user: {
                    select: {
                        id: true,
                        email: true,
                    },
                },
            },
        }),
        prisma.emailThread.findMany({
            where: {
                organizationId: input.organizationId,
            },
            orderBy: [
                { lastMessageAt: "desc" },
                { updatedAt: "desc" },
            ],
            take: fetchWindow,
            select: {
                id: true,
                status: true,
                unreadCount: true,
                lastMessageAt: true,
                lastMessagePreview: true,
                slaDueAt: true,
                subject: true,
                createdAt: true,
                updatedAt: true,
                contact: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phoneNumberE164: true,
                    },
                },
                user: {
                    select: {
                        id: true,
                        email: true,
                    },
                },
            },
        }),
    ]);

    const mappedWhatsApp = whatsappConversations.map((conversation) => {
        const contact = conversation.contact
            ? {
                id: conversation.contact.id,
                name: conversation.contact.name,
                email: conversation.contact.email,
                phoneNumberE164: conversation.contact.phoneNumberE164,
            }
            : null;

        return {
            id: `whatsapp:${conversation.id}`,
            channel: "whatsapp" as const,
            status: conversation.status,
            title: normalizeConversationTitle({ channel: "whatsapp", contact, subject: null }),
            contact,
            assignedUser: conversation.user
                ? {
                    id: conversation.user.id,
                    email: conversation.user.email,
                }
                : null,
            lastMessageAt: toIso(conversation.lastMessageAt),
            lastMessagePreview: conversation.lastMessagePreview,
            unreadCount: conversation.unreadCount,
            subject: null,
            slaDueAt: toIso(conversation.slaDueAt),
            threadId: null,
            conversationId: conversation.id,
            sortAt: latestTimestamp([conversation.lastMessageAt, conversation.updatedAt, conversation.createdAt]),
        };
    });

    const mappedEmail = emailThreads.map((thread) => {
        const contact = thread.contact
            ? {
                id: thread.contact.id,
                name: thread.contact.name,
                email: thread.contact.email,
                phoneNumberE164: thread.contact.phoneNumberE164,
            }
            : null;

        return {
            id: `email:${thread.id}`,
            channel: "email" as const,
            status: thread.status,
            title: normalizeConversationTitle({ channel: "email", contact, subject: thread.subject ?? null }),
            contact,
            assignedUser: thread.user
                ? {
                    id: thread.user.id,
                    email: thread.user.email,
                }
                : null,
            lastMessageAt: toIso(thread.lastMessageAt),
            lastMessagePreview: thread.lastMessagePreview,
            unreadCount: thread.unreadCount,
            subject: thread.subject ?? null,
            slaDueAt: toIso(thread.slaDueAt),
            threadId: thread.id,
            conversationId: null,
            sortAt: latestTimestamp([thread.lastMessageAt, thread.updatedAt, thread.createdAt]),
        };
    });

    const merged = [...mappedWhatsApp, ...mappedEmail].sort((left, right) => {
        if (left.sortAt !== right.sortAt) {
            return right.sortAt - left.sortAt;
        }

        return left.title.localeCompare(right.title, "pt-BR");
    });

    const pagedItems = merged.slice(input.offset, input.offset + input.limit).map(({ sortAt, ...item }) => item);

    return {
        items: pagedItems,
        pagination: buildPublicApiPaginationMeta({
            offset: input.offset,
            limit: input.limit,
            total: whatsappTotal + emailTotal,
            returnedCount: pagedItems.length,
        }),
        summary: {
            total: whatsappTotal + emailTotal,
            whatsapp: whatsappTotal,
            email: emailTotal,
        },
    };
}

export async function getPublicExecutivePulse(input: {
    organizationSlug: string;
}): Promise<PublicApiExecutivePulseResponse> {
    const dashboard = await buildTenantExecutiveDashboard(input.organizationSlug);

    if (!dashboard) {
        throw new PublicApiError("Organization not found.", 404, "NOT_FOUND");
    }

    return {
        org: dashboard.org,
        generatedAt: dashboard.generatedAt,
        hasData: dashboard.hasData,
        emptyReason: dashboard.emptyReason,
        overview: dashboard.overview,
        prioritizedAlerts: dashboard.prioritizedAlerts,
        decisionNarrative: dashboard.decisionNarrative,
        warnings: dashboard.warnings,
    };
}
