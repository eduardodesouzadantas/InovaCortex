import { emitWebhookEvent } from "@/lib/public-api/webhooks";
import { prisma } from "@/lib/prisma";
import { sendOutboundWhatsAppMessage } from "@/lib/whatsapp/outbound-service";
import { normalizePhone } from "@/lib/whatsapp";
import { getOrganizationAccountStatus, ORGANIZATION_BILLING_SUSPENDED_MESSAGE } from "@/lib/billing/account-status";

export type MobileDealUpdateInput = {
    organizationId: string;
    userId: string;
    role: string;
    dealId: string;
    status?: string | null;
    value?: number | null;
    note?: string | null;
};

export type MobileActivityCreateInput = {
    organizationId: string;
    userId: string;
    role: string;
    dealId?: string | null;
    threadId?: string | null;
    type: string;
    note?: string | null;
};

export type MobileWhatsAppReplyInput = {
    organizationId: string;
    userId: string;
    role: string;
    conversationId: string;
    phoneNumber: string;
    text: string;
};

export class MobileActionError extends Error {
    status: number;
    code: string;

    constructor(message: string, status: number, code: string) {
        super(message);
        this.name = "MobileActionError";
        this.status = status;
        this.code = code;
    }
}

function parseTags(value: string | null | undefined): string[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map((tag) => String(tag)) : [];
    } catch {
        return [];
    }
}

function mapDealSnapshot(deal: {
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
    _count: { activities: number };
}) {
    return {
        id: deal.id,
        contactId: deal.contactId,
        contact: {
            id: deal.contact.id,
            name: deal.contact.name,
            email: deal.contact.email,
            phoneNumberE164: deal.contact.phoneNumberE164,
            lifecycle: deal.contact.lifecycle,
            tags: parseTags(deal.contact.tags),
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

function mapActivitySnapshot(activity: {
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
}) {
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

async function resolveEmailReplyDeal(input: {
    organizationId: string;
    threadId: string;
}): Promise<{ dealId: string } | null> {
    const thread = await prisma.emailThread.findFirst({
        where: {
            id: input.threadId,
            organizationId: input.organizationId,
        },
        select: {
            dealId: true,
            contactId: true,
        },
    });

    if (!thread) {
        return null;
    }

    if (thread.dealId) {
        return { dealId: thread.dealId };
    }

    if (!thread.contactId) {
        return null;
    }

    const deal = await prisma.deal.findFirst({
        where: {
            organizationId: input.organizationId,
            contactId: thread.contactId,
            status: {
                notIn: ["closed_won", "closed_lost", "archived"],
            },
        },
        orderBy: {
            createdAt: "desc",
        },
        select: {
            id: true,
        },
    });

    return deal ? { dealId: deal.id } : null;
}

export async function updateMobileDeal(input: MobileDealUpdateInput) {
    if (await getOrganizationAccountStatus(input.organizationId) === "suspended") {
        throw new MobileActionError(ORGANIZATION_BILLING_SUSPENDED_MESSAGE, 403, "FORBIDDEN");
    }

    const existing = await prisma.deal.findFirst({
        where: {
            id: input.dealId,
            organizationId: input.organizationId,
        },
        select: {
            id: true,
        },
    });

    if (!existing) {
        throw new MobileActionError("Deal not found.", 404, "DEAL_NOT_FOUND");
    }

    const deal = await prisma.deal.update({
        where: {
            id: existing.id,
        },
        data: {
            ...(typeof input.status === "string" && input.status.trim() ? { status: input.status.trim() } : {}),
            ...(typeof input.value === "number" ? { value: input.value } : {}),
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

    let activitySnapshot: ReturnType<typeof mapActivitySnapshot> | null = null;

    if (typeof input.note === "string" && input.note.trim()) {
        const activity = await prisma.activity.create({
            data: {
                organizationId: input.organizationId,
                dealId: deal.id,
                type: "mobile_note",
                note: input.note.trim(),
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

        activitySnapshot = mapActivitySnapshot(activity);
    }

    void emitWebhookEvent({
        organizationId: input.organizationId,
        eventType: "deal.updated",
        data: {
            deal: mapDealSnapshot(deal),
            created: false,
            source: "mobile",
        },
    });

    if (activitySnapshot) {
        void emitWebhookEvent({
            organizationId: input.organizationId,
            eventType: "activity.created",
            data: {
                activity: activitySnapshot,
            },
        });
    }

    return {
        deal: mapDealSnapshot(deal),
        noteSaved: typeof input.note === "string" && Boolean(input.note.trim()),
    };
}

export async function createMobileActivity(input: MobileActivityCreateInput) {
    if (await getOrganizationAccountStatus(input.organizationId) === "suspended") {
        throw new MobileActionError(ORGANIZATION_BILLING_SUSPENDED_MESSAGE, 403, "FORBIDDEN");
    }

    const resolvedDealId = input.dealId
        ? input.dealId
        : input.threadId
            ? (await resolveEmailReplyDeal({
                organizationId: input.organizationId,
                threadId: input.threadId,
            }))?.dealId ?? null
            : null;

    if (!resolvedDealId) {
        throw new MobileActionError("Deal not found for activity.", 404, "DEAL_NOT_FOUND");
    }

    const deal = await prisma.deal.findFirst({
        where: {
            id: resolvedDealId,
            organizationId: input.organizationId,
        },
        select: {
            id: true,
        },
    });

    if (!deal) {
        throw new MobileActionError("Deal not found for activity.", 404, "DEAL_NOT_FOUND");
    }

    const activity = await prisma.activity.create({
        data: {
            organizationId: input.organizationId,
            dealId: deal.id,
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
            activity: mapActivitySnapshot(activity),
        },
    });

    return {
        activity: mapActivitySnapshot(activity),
    };
}

export async function sendMobileWhatsAppReply(input: MobileWhatsAppReplyInput) {
    const normalizedPhone = normalizePhone(input.phoneNumber);
    if (!normalizedPhone) {
        throw new MobileActionError("Phone number not found.", 404, "PHONE_NOT_FOUND");
    }

    const result = await sendOutboundWhatsAppMessage({
        organizationId: input.organizationId,
        role: input.role,
        userId: input.userId,
        request: {
            conversationId: input.conversationId,
            type: "text",
            text: input.text,
            templateName: "",
            templateLanguage: "",
        },
    });

    if (!result.ok) {
        throw new MobileActionError(result.message, result.status, result.code);
    }

    return {
        message: result.result.message,
        deal: result.result.deal,
    };
}
