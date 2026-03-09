import { prisma } from "@/lib/prisma";
import { encrypt, isEncrypted, maskToken } from "@/lib/security/crypto";

export const META_SETTING_KEYS = [
    "META_WABA_ID",
    "META_PHONE_NUMBER_ID",
    "META_ACCESS_TOKEN",
    "META_VERIFY_TOKEN",
] as const;

export type MetaSettingKey = (typeof META_SETTING_KEYS)[number];

export type MetaSettingInput = {
    key: string;
    value: string;
};

const META_KEY_SET = new Set<string>(META_SETTING_KEYS);

function isMetaSettingKey(key: string): key is MetaSettingKey {
    return META_KEY_SET.has(key);
}

export function sanitizeMetaSettingInputs(input: unknown): {
    ok: true;
    settings: Array<{ key: MetaSettingKey; value: string }>;
} | {
    ok: false;
    error: string;
} {
    if (!Array.isArray(input)) {
        return { ok: false, error: "Invalid format. Expected array." };
    }

    const validSettings: Array<{ key: MetaSettingKey; value: string }> = [];
    for (const item of input) {
        if (!item || typeof item !== "object") continue;
        const key = "key" in item ? (item as MetaSettingInput).key : "";
        const value = "value" in item ? (item as MetaSettingInput).value : "";

        if (typeof key !== "string" || typeof value !== "string") continue;
        if (!isMetaSettingKey(key)) continue;

        validSettings.push({ key, value });
    }

    return { ok: true, settings: validSettings };
}

export async function listMaskedMetaSettings(organizationId: string): Promise<Array<{
    key: string;
    masked: string;
    configured: boolean;
}>> {
    const settings = await prisma.systemSetting.findMany({
        where: {
            organizationId,
            key: { in: META_SETTING_KEYS as unknown as string[] },
        },
        select: { key: true, value: true },
    });

    return settings.map((setting) => ({
        key: setting.key,
        masked: maskToken(setting.value),
        configured: Boolean(setting.value),
    }));
}

export async function upsertMetaSettings(
    organizationId: string,
    settings: Array<{ key: MetaSettingKey; value: string }>,
): Promise<{ updatedKeys: string[] }> {
    const upserts = settings.map((setting) => {
        const valueToStore = setting.value
            ? (isEncrypted(setting.value) ? setting.value : encrypt(setting.value))
            : setting.value;

        return prisma.systemSetting.upsert({
            where: {
                key_organizationId: {
                    key: setting.key,
                    organizationId,
                },
            },
            update: { value: valueToStore },
            create: {
                key: setting.key,
                organizationId,
                value: valueToStore,
            },
        });
    });

    if (upserts.length > 0) {
        await prisma.$transaction(upserts);
    }

    return { updatedKeys: settings.map((setting) => setting.key) };
}
