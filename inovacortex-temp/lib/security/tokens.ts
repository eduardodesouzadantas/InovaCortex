/**
 * lib/security/tokens.ts
 * Server-side helper to retrieve and decrypt Meta API tokens.
 * Tokens stored in SystemSetting are AES-256-GCM encrypted.
 *
 * NEVER import this on the client side.
 */

import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/security/crypto";
import { logger } from "@/lib/logger";

export interface MetaCredentials {
    phoneNumberId: string;
    accessToken: string;
    wabaId: string;
    verifyToken: string;
}

/**
 * Load and decrypt Meta credentials.
 * DB values take precedence over ENV. If a DB value is a plain-text string
 * (i.e., not an encrypted blob), it is used as-is (for backward compatibility).
 */
export async function getMetaCredentials(): Promise<Partial<MetaCredentials>> {
    const keys = [
        "META_PHONE_NUMBER_ID",
        "META_ACCESS_TOKEN",
        "META_WABA_ID",
        "META_VERIFY_TOKEN",
    ];

    const dbSettings = await (prisma as any).systemSetting.findMany({
        where: { key: { in: keys } }
    });

    const dbMap: Record<string, string> = {};
    for (const setting of dbSettings) {
        try {
            dbMap[setting.key] = decrypt(setting.value);
        } catch {
            // Not encrypted (legacy or plain text) — use as-is
            logger.warn("SystemSetting value not decryptable, using raw", { key: setting.key });
            dbMap[setting.key] = setting.value;
        }
    }

    return {
        phoneNumberId: dbMap["META_PHONE_NUMBER_ID"] || process.env.META_PHONE_NUMBER_ID,
        accessToken: dbMap["META_ACCESS_TOKEN"] || process.env.META_ACCESS_TOKEN,
        wabaId: dbMap["META_WABA_ID"] || process.env.META_WABA_ID,
        verifyToken: dbMap["META_VERIFY_TOKEN"] || process.env.META_VERIFY_TOKEN,
    };
}
