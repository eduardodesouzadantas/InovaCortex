/**
 * lib/integrations/meta-instagram.ts
 * V20.1: Meta / Instagram Publishing Integration.
 *
 * STUB mode when META_ACCESS_TOKEN or metaPageId not configured.
 * Real implementation: Meta Graph API v21+ Media + Publish flow.
 */

import { logger } from "@/lib/logger";

export interface InstagramPostOptions {
    text: string;
    orgId: string;
    imageUrl?: string; // optional: image URL for feed post
}

export interface InstagramPostResult {
    externalPostId: string;
    stub: boolean;
    postedAt: Date;
}

/**
 * Publish a post to Instagram via Meta Graph API.
 * Uses two-step flow: create container → publish.
 * Falls back to stub if token/pageId not present.
 */
export async function publishToInstagram(
    accessToken: string | null | undefined,
    metaPageId: string | null | undefined,
    opts: InstagramPostOptions,
): Promise<InstagramPostResult> {
    if (!accessToken || !metaPageId) {
        logger.info("[Instagram] No access token or pageId — returning stub result", { orgId: opts.orgId });
        return {
            externalPostId: `stub_ig_${Date.now()}`,
            stub: true,
            postedAt: new Date(),
        };
    }

    // ── Real API (placeholder) ────────────────────────────────────────────────
    // Step 1: Create media container
    //   POST https://graph.facebook.com/v21.0/{pageId}/media
    //   params: caption, media_type="IMAGE", image_url (or VIDEO), access_token
    //
    // Step 2: Publish container
    //   POST https://graph.facebook.com/v21.0/{pageId}/media_publish
    //   params: creation_id, access_token
    //
    // For now → log and stub
    logger.info("[Instagram] POST (placeholder — not yet wired)", {
        orgId: opts.orgId,
        metaPageId,
        textLen: opts.text.length,
        hasImage: !!opts.imageUrl,
    });

    return {
        externalPostId: `stub_ig_${Date.now()}`,
        stub: true,
        postedAt: new Date(),
    };
}

/**
 * Load and decrypt Meta/Instagram credentials for an org.
 */
export async function getMetaCredentials(orgId: string): Promise<{
    accessToken: string | null;
    pageId: string | null;
}> {
    const { prisma } = await import("@/lib/prisma");
    const integration = await (prisma as any).socialIntegration.findUnique({
        where: { orgId },
        select: { instagramStatus: true, metaAccessTokenEnc: true, metaPageId: true },
    }).catch(() => null);

    if (!integration || integration.instagramStatus !== "connected") {
        return { accessToken: null, pageId: null };
    }

    const key = process.env.APP_ENCRYPTION_KEY;
    if (!key || !integration.metaAccessTokenEnc) {
        return { accessToken: null, pageId: integration.metaPageId ?? null };
    }

    try {
        const { decryptToken } = await import("@/lib/integrations/linkedin");
        const accessToken = decryptToken(integration.metaAccessTokenEnc, key);
        return { accessToken, pageId: integration.metaPageId ?? null };
    } catch {
        logger.error("[Instagram] Token decryption failed", { orgId });
        return { accessToken: null, pageId: null };
    }
}
