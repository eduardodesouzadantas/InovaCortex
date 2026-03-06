/**
 * lib/integrations/linkedin.ts
 * V20.1: LinkedIn Publishing Integration.
 *
 * STUB mode when LINKEDIN_ACCESS_TOKEN or token not configured.
 * Real implementation: placeholder for future OAuth flow.
 */

import { logger } from "@/lib/logger";

export interface LinkedInPostOptions {
    text: string;
    orgId: string;
}

export interface LinkedInPostResult {
    externalPostId: string;
    stub: boolean;
    postedAt: Date;
}

/**
 * Publish a text post to LinkedIn.
 * Returns stub result if token not configured.
 */
export async function publishToLinkedIn(
    accessToken: string | null | undefined,
    opts: LinkedInPostOptions,
): Promise<LinkedInPostResult> {
    if (!accessToken) {
        logger.info("[LinkedIn] No access token — returning stub result", { orgId: opts.orgId });
        return {
            externalPostId: `stub_li_${Date.now()}`,
            stub: true,
            postedAt: new Date(),
        };
    }

    // ── Real API (placeholder) ────────────────────────────────────────────────
    // When implementing:
    //   POST https://api.linkedin.com/v2/ugcPosts
    //   Authorization: Bearer {accessToken}
    //   Body: { author, lifecycleState: "PUBLISHED", specificContent: { ... } }
    //
    // For now → log and stub to avoid crashing
    logger.info("[LinkedIn] POST (placeholder — not yet wired)", {
        orgId: opts.orgId,
        textLen: opts.text.length,
    });

    return {
        externalPostId: `stub_li_${Date.now()}`,
        stub: true,
        postedAt: new Date(),
    };
}

/**
 * Decrypt and return the LinkedIn access token for an org.
 * Returns null if not configured or decryption fails.
 */
export async function getLinkedInToken(orgId: string): Promise<string | null> {
    const { prisma } = await import("@/lib/prisma");
    const integration = await (prisma as any).socialIntegration.findUnique({
        where: { orgId },
        select: { linkedinStatus: true, linkedinAccessTokenEnc: true },
    }).catch(() => null);

    if (!integration || integration.linkedinStatus !== "connected") return null;
    if (!integration.linkedinAccessTokenEnc) return null;

    // Decrypt AES-256-GCM
    const key = process.env.APP_ENCRYPTION_KEY;
    if (!key) {
        logger.warn("[LinkedIn] APP_ENCRYPTION_KEY not set — cannot decrypt token", { orgId });
        return null;
    }

    try {
        return decryptToken(integration.linkedinAccessTokenEnc, key);
    } catch {
        logger.error("[LinkedIn] Token decryption failed", { orgId });
        return null;
    }
}

// ─── AES-256-GCM helpers ──────────────────────────────────────────────────────

export function encryptToken(plaintext: string, keyHex: string): string {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require("crypto") as typeof import("crypto");
    const key = Buffer.from(keyHex.padEnd(64, "0").slice(0, 64), "hex");
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${enc.toString("hex")}:${tag.toString("hex")}`;
}

export function decryptToken(ciphertext: string, keyHex: string): string {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require("crypto") as typeof import("crypto");
    const [ivHex, encHex, tagHex] = ciphertext.split(":");
    const key = Buffer.from(keyHex.padEnd(64, "0").slice(0, 64), "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return decipher.update(Buffer.from(encHex, "hex")).toString("utf8") + decipher.final("utf8");
}
