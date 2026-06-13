import { getAgencyOrgSlug } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/security/crypto";
import { resolveActor } from "@/lib/whatsapp/rbac";

import type {
    WhatsAppPipelineActor,
    WhatsAppPipelineTenantContext,
} from "./pipeline-contract";

type CandidateMetaChannel = {
    organizationId: string;
    orgSlug: string | null;
    phoneNumberId?: string;
    businessAccountId?: string;
};

type SenderTenantActor = {
    orgId: string;
    orgSlug: string;
    userId: string;
    role: "owner" | "admin" | "closer" | "viewer" | "sales" | "ceo";
};

function normalizeMaybeString(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function decryptSettingValue(value: string): string | undefined {
    try {
        return normalizeMaybeString(decrypt(value));
    } catch {
        return normalizeMaybeString(value);
    }
}

async function resolveDefaultInboundOrg() {
    const preferredSlug = process.env.WHATSAPP_COPILOT_ORG_SLUG?.trim() || getAgencyOrgSlug();
    return prisma.organization.findUnique({
        where: { slug: preferredSlug },
        select: { id: true, slug: true },
    });
}

async function resolveStoredMetaChannel(phoneNumberId: string): Promise<CandidateMetaChannel | null> {
    const settings = await prisma.systemSetting.findMany({
        where: {
            key: { in: ["META_PHONE_NUMBER_ID", "META_WABA_ID"] },
        },
        select: {
            organizationId: true,
            key: true,
            value: true,
        },
    });

    const settingsByOrg = new Map<string, { phoneNumberId?: string; businessAccountId?: string }>();
    for (const setting of settings) {
        const bucket = settingsByOrg.get(setting.organizationId) ?? {};
        const resolvedValue = decryptSettingValue(setting.value);

        if (setting.key === "META_PHONE_NUMBER_ID") {
            bucket.phoneNumberId = resolvedValue;
        } else if (setting.key === "META_WABA_ID") {
            bucket.businessAccountId = resolvedValue;
        }

        settingsByOrg.set(setting.organizationId, bucket);
    }

    const match = [...settingsByOrg.entries()].find(([, candidate]) => candidate.phoneNumberId === phoneNumberId);
    if (!match) {
        return null;
    }

    const [organizationId, candidate] = match;
    const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { slug: true },
    });

    return {
        organizationId,
        orgSlug: organization?.slug ?? null,
        phoneNumberId: candidate.phoneNumberId,
        businessAccountId: candidate.businessAccountId,
    };
}

async function resolveFallbackInboundOrganization(phoneNumberId: string): Promise<WhatsAppPipelineTenantContext | null> {
    const storedChannel = await resolveStoredMetaChannel(phoneNumberId);
    if (storedChannel) {
        if (storedChannel.businessAccountId) {
            await prisma.whatsAppChannel.upsert({
                where: { phoneNumberId },
                update: {
                    organizationId: storedChannel.organizationId,
                    businessAccountId: storedChannel.businessAccountId,
                },
                create: {
                    organizationId: storedChannel.organizationId,
                    phoneNumberId,
                    businessAccountId: storedChannel.businessAccountId,
                },
            });
        }

        logger.warn("WhatsApp inbound channel resolved from stored system settings", {
            organizationId: storedChannel.organizationId,
            orgSlug: storedChannel.orgSlug,
            phoneNumberId,
        });

        return {
            organizationId: storedChannel.organizationId,
            orgSlug: storedChannel.orgSlug,
            phoneNumberId,
        };
    }

    const fallbackOrg = await resolveDefaultInboundOrg();
    if (!fallbackOrg) {
        return null;
    }

    const envBusinessAccountId = normalizeMaybeString(process.env.META_WABA_ID);
    if (envBusinessAccountId) {
        await prisma.whatsAppChannel.upsert({
            where: { phoneNumberId },
            update: {
                organizationId: fallbackOrg.id,
                businessAccountId: envBusinessAccountId,
            },
            create: {
                organizationId: fallbackOrg.id,
                phoneNumberId,
                businessAccountId: envBusinessAccountId,
            },
        });
    }

    logger.warn("WhatsApp inbound channel resolved from env fallback", {
        organizationId: fallbackOrg.id,
        orgSlug: fallbackOrg.slug,
        phoneNumberId,
        hydratedChannel: Boolean(envBusinessAccountId),
    });

    return {
        organizationId: fallbackOrg.id,
        orgSlug: fallbackOrg.slug,
        phoneNumberId,
    };
}

export async function mapSenderToTenantActor(phone: string): Promise<SenderTenantActor | null> {
    const actor = await resolveActor(phone);
    if (actor) {
        return {
            orgId: actor.orgId,
            orgSlug: actor.orgSlug,
            userId: actor.userId || "system",
            role: actor.role,
        };
    }

    const allowedPhones = process.env.WHATSAPP_COPILOT_PHONES
        ?.split(",")
        .map((phoneNumber) => phoneNumber.trim())
        .filter(Boolean) || [];
    const orgSlug = process.env.WHATSAPP_COPILOT_ORG_SLUG;

    if (!allowedPhones.includes(phone) || !orgSlug) {
        return null;
    }

    const org = await prisma.organization.findUnique({
        where: { slug: orgSlug },
        select: { id: true, slug: true },
    });
    if (!org) {
        return null;
    }

    const adminUser = await prisma.user.findFirst({
        where: { organizationId: org.id, role: { in: ["owner", "admin"] } },
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true },
    });

    return {
        orgId: org.id,
        orgSlug: org.slug,
        userId: adminUser?.id || "system",
        role: (adminUser?.role || "admin") as SenderTenantActor["role"],
    };
}

export async function resolveInboundTenantContext(input: {
    phoneNumberId?: string | null;
    fromPhone: string;
    organizationId?: string | null;
    orgSlug?: string | null;
}): Promise<WhatsAppPipelineTenantContext> {
    if (input.organizationId) {
        return {
            organizationId: input.organizationId,
            orgSlug: input.orgSlug ?? null,
            phoneNumberId: input.phoneNumberId ?? null,
        };
    }

    if (input.phoneNumberId) {
        const channel = await prisma.whatsAppChannel.findUnique({
            where: { phoneNumberId: input.phoneNumberId },
            select: {
                organizationId: true,
                organization: {
                    select: {
                        slug: true,
                    },
                },
            },
        });

        if (channel) {
            return {
                organizationId: channel.organizationId,
                orgSlug: channel.organization.slug,
                phoneNumberId: input.phoneNumberId,
            };
        }

        const resolvedFromSettings = await resolveFallbackInboundOrganization(input.phoneNumberId);
        if (resolvedFromSettings) {
            return resolvedFromSettings;
        }

        throw new Error("WHATSAPP_CHANNEL_NOT_FOUND");
    }

    const actorCtx = await mapSenderToTenantActor(input.fromPhone);
    if (actorCtx) {
        return {
            organizationId: actorCtx.orgId,
            orgSlug: actorCtx.orgSlug,
            phoneNumberId: null,
        };
    }

    const fallbackOrg = await resolveDefaultInboundOrg();
    if (fallbackOrg) {
        return {
            organizationId: fallbackOrg.id,
            orgSlug: fallbackOrg.slug,
            phoneNumberId: null,
        };
    }

    throw new Error("WHATSAPP_INBOUND_ORG_NOT_RESOLVED");
}

export async function resolveInboundActor(phone: string): Promise<WhatsAppPipelineActor> {
    const actor = await mapSenderToTenantActor(phone);
    if (!actor) {
        return {
            source: "webhook",
            userId: null,
            role: "system",
            phoneNumber: phone,
        };
    }

    return {
        source: "tenant_user",
        userId: actor.userId,
        role: actor.role,
        phoneNumber: phone,
    };
}

export async function getOrCreateWhatsAppCopilotSession(orgId: string, phone: string): Promise<string> {
    const tag = `wa_${phone}`;
    const existing = await prisma.aIChatSession.findFirst({
        where: { organizationId: orgId, title: tag },
        orderBy: { createdAt: "desc" },
        select: { id: true },
    });
    if (existing) {
        return existing.id;
    }

    const session = await prisma.aIChatSession.create({
        data: {
            organizationId: orgId,
            title: tag,
            scope: "whatsapp_copilot",
        },
        select: { id: true },
    });

    return session.id;
}
