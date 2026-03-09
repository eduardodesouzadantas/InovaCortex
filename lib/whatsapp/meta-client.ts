import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/security/crypto";
import { logger } from "@/lib/logger";

const META_GRAPH_BASE = "https://graph.facebook.com/v21.0";

type MetaSettingKey =
    | "META_PHONE_NUMBER_ID"
    | "META_ACCESS_TOKEN"
    | "META_WABA_ID"
    | "META_VERIFY_TOKEN";

const META_SETTING_KEYS: MetaSettingKey[] = [
    "META_PHONE_NUMBER_ID",
    "META_ACCESS_TOKEN",
    "META_WABA_ID",
    "META_VERIFY_TOKEN",
];

export interface MetaResolvedCredentials {
    accessToken?: string;
    phoneNumberId?: string;
    wabaId?: string;
    verifyToken?: string;
}

export interface MetaSendResult {
    messageId: string | null;
    error?: string;
}

export interface MetaTemplateRecord {
    name: string;
    status: string;
    category: string;
    language: string;
    bodyJson: string;
}

type MetaGraphErrorPayload = {
    error?: { message?: string };
};

type MetaTemplateApiItem = {
    name?: string;
    status?: string;
    category?: string;
    language?: string;
    components?: unknown;
};

type MetaTemplateApiResponse = {
    data?: MetaTemplateApiItem[];
    paging?: { next?: string };
    error?: { message?: string };
};

function normalizeMaybeString(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeTemplateStatus(rawStatus: string | undefined): string {
    const normalized = (rawStatus ?? "").toLowerCase();
    if (normalized === "approved" || normalized === "pending" || normalized === "rejected" || normalized === "disabled") {
        return normalized;
    }
    return "pending";
}

function safeJson(value: unknown): string {
    try {
        return JSON.stringify(value ?? []);
    } catch {
        return "[]";
    }
}

function resolveFallbackEnvCredentials(): MetaResolvedCredentials {
    return {
        accessToken: normalizeMaybeString(process.env.META_ACCESS_TOKEN) ?? normalizeMaybeString(process.env.META_WHATSAPP_TOKEN),
        phoneNumberId: normalizeMaybeString(process.env.META_PHONE_NUMBER_ID),
        wabaId: normalizeMaybeString(process.env.META_WABA_ID),
        verifyToken: normalizeMaybeString(process.env.META_VERIFY_TOKEN),
    };
}

export async function resolveMetaCredentialsForOrg(orgId: string): Promise<MetaResolvedCredentials> {
    const settings = await prisma.systemSetting.findMany({
        where: {
            organizationId: orgId,
            key: { in: META_SETTING_KEYS },
        },
        select: { key: true, value: true },
    });

    const dbMap: Partial<Record<MetaSettingKey, string>> = {};
    for (const setting of settings) {
        const key = setting.key as MetaSettingKey;
        if (!META_SETTING_KEYS.includes(key)) continue;

        try {
            dbMap[key] = decrypt(setting.value);
        } catch {
            dbMap[key] = setting.value;
            logger.warn("Meta setting value is not decryptable; using raw value", { orgId, key });
        }
    }

    const env = resolveFallbackEnvCredentials();
    return {
        accessToken: normalizeMaybeString(dbMap.META_ACCESS_TOKEN) ?? env.accessToken,
        phoneNumberId: normalizeMaybeString(dbMap.META_PHONE_NUMBER_ID) ?? env.phoneNumberId,
        wabaId: normalizeMaybeString(dbMap.META_WABA_ID) ?? env.wabaId,
        verifyToken: normalizeMaybeString(dbMap.META_VERIFY_TOKEN) ?? env.verifyToken,
    };
}

export async function sendWhatsAppTextForOrg(
    orgId: string,
    to: string,
    body: string,
): Promise<MetaSendResult> {
    const creds = await resolveMetaCredentialsForOrg(orgId);
    if (!creds.accessToken || !creds.phoneNumberId) {
        return { messageId: null, error: "META_NOT_CONFIGURED" };
    }

    try {
        const response = await fetch(`${META_GRAPH_BASE}/${creds.phoneNumberId}/messages`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${creds.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to,
                type: "text",
                text: { preview_url: false, body },
            }),
        });

        const payload = await response.json().catch(() => ({} as MetaGraphErrorPayload));
        if (!response.ok) {
            return { messageId: null, error: payload.error?.message ?? `HTTP_${response.status}` };
        }

        const messageId = (payload as { messages?: Array<{ id?: string }> }).messages?.[0]?.id ?? null;
        return { messageId };
    } catch (error) {
        return { messageId: null, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function sendWhatsAppTemplateForOrg(
    orgId: string,
    to: string,
    templateName: string,
    language = "pt_BR",
    components: unknown[] = [],
): Promise<MetaSendResult> {
    const creds = await resolveMetaCredentialsForOrg(orgId);
    if (!creds.accessToken || !creds.phoneNumberId) {
        return { messageId: null, error: "META_NOT_CONFIGURED" };
    }

    try {
        const response = await fetch(`${META_GRAPH_BASE}/${creds.phoneNumberId}/messages`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${creds.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to,
                type: "template",
                template: {
                    name: templateName,
                    language: { code: language },
                    components,
                },
            }),
        });

        const payload = await response.json().catch(() => ({} as MetaGraphErrorPayload));
        if (!response.ok) {
            return { messageId: null, error: payload.error?.message ?? `HTTP_${response.status}` };
        }

        const messageId = (payload as { messages?: Array<{ id?: string }> }).messages?.[0]?.id ?? null;
        return { messageId };
    } catch (error) {
        return { messageId: null, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function syncMetaTemplatesForOrg(orgId: string): Promise<{
    templates: MetaTemplateRecord[];
    source: "meta" | "unconfigured";
    error?: string;
}> {
    const creds = await resolveMetaCredentialsForOrg(orgId);
    if (!creds.accessToken || !creds.wabaId) {
        return {
            templates: [],
            source: "unconfigured",
            error: "META_NOT_CONFIGURED",
        };
    }

    const collected: MetaTemplateRecord[] = [];
    let nextUrl: string | undefined = `${META_GRAPH_BASE}/${creds.wabaId}/message_templates?limit=100`;
    let pageCount = 0;

    while (nextUrl && pageCount < 5) {
        const response = await fetch(nextUrl, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${creds.accessToken}`,
            },
        });

        const payload = await response.json().catch(() => ({} as MetaTemplateApiResponse));
        if (!response.ok) {
            return {
                templates: [],
                source: "meta",
                error: payload.error?.message ?? `HTTP_${response.status}`,
            };
        }

        const items = payload.data ?? [];
        for (const item of items) {
            const name = normalizeMaybeString(item.name);
            const language = normalizeMaybeString(item.language) ?? "pt_BR";
            if (!name) continue;

            collected.push({
                name,
                language,
                status: normalizeTemplateStatus(item.status),
                category: normalizeMaybeString(item.category) ?? "utility",
                bodyJson: safeJson(item.components ?? []),
            });
        }

        nextUrl = normalizeMaybeString(payload.paging?.next);
        pageCount += 1;
    }

    return { templates: collected, source: "meta" };
}
