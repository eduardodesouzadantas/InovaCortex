import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { routeWhatsAppMessage } from "@/lib/whatsapp/command-parser";
import { resolveActor } from "@/lib/whatsapp/rbac";

export interface InboundMessage {
    from: string;          // E.164 sender phone
    messageId: string;     // WAMID
    text: string;          // Body text
    timestamp: number;
}

/**
 * 1. Validate the X-Hub-Signature-256 header from Meta.
 *    Returns true if the signature matches the raw body.
 */
export function validateMetaSignature(rawBody: string, signature: string | null): boolean {
    const secret = process.env.META_APP_SECRET;
    if (!secret) {
        logger.warn("META_APP_SECRET not configured — skipping signature check");
        return true; // Permissive in dev; enforce in prod
    }

    if (!signature?.startsWith("sha256=")) return false;

    const expected = "sha256=" + crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");

    // Timing-safe comparison
    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expected)
        );
    } catch {
        return false;
    }
}

/**
 * 2. Parse inbound messages from Meta payload.
 *    Returns an array of InboundMessage (text only).
 */
export function parseInboundMessages(body: any): InboundMessage[] {
    const messages: InboundMessage[] = [];

    for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
            const value = change.value;
            for (const msg of value.messages || []) {
                if (msg.type === "text" && msg.text?.body) {
                    messages.push({
                        from: msg.from,
                        messageId: msg.id,
                        text: msg.text.body,
                        timestamp: parseInt(msg.timestamp, 10)
                    });
                }
            }
        }
    }

    return messages;
}

/**
 * 3. Map sender phone → organization + user identity.
 *
 * Strategy (in priority order):
 *   a) DB: WhatsAppUser table (RBAC — primary)
 *   b) DB: User.phone lookup (legacy)
 *   c) Env allowlist fallback
 *   d) Reject
 */
export async function mapSenderToOrg(phone: string): Promise<{
    orgId: string;
    orgSlug: string;
    userId: string;
    role: string;
} | null> {
    // Strategy (a): WhatsAppUser RBAC table — primary source of truth
    const actor = await resolveActor(phone);
    if (actor) {
        return {
            orgId: actor.orgId,
            orgSlug: actor.orgSlug,
            userId: actor.userId || "system",
            role: actor.role
        };
    }

    // Strategy (b): env allowlist (backward compat)
    const allowedPhones = process.env.WHATSAPP_COPILOT_PHONES
        ?.split(",").map(p => p.trim()).filter(Boolean) || [];
    const orgSlug = process.env.WHATSAPP_COPILOT_ORG_SLUG;

    if (allowedPhones.includes(phone) && orgSlug) {
        const org = await prisma.organization.findUnique({
            where: { slug: orgSlug },
            select: { id: true, slug: true }
        });
        if (!org) return null;

        const adminUser = await (prisma as any).user.findFirst({
            where: { organizationId: org.id, role: { in: ["owner", "admin"] } },
            orderBy: { createdAt: "asc" }
        });

        return {
            orgId: org.id,
            orgSlug: org.slug,
            userId: adminUser?.id || "system",
            role: adminUser?.role || "admin"
        };
    }

    return null;
}

/**
 * 4. Main handler: validate → parse → map → dispatch to AI Copilot.
 */
export async function handleInbound(rawBody: string, signature: string | null) {
    // Step 1: Validate signature
    if (!validateMetaSignature(rawBody, signature)) {
        logger.error("WhatsApp Webhook: invalid signature — request rejected");
        return { ok: false, reason: "invalid_signature" };
    }

    let body: any;
    try {
        body = JSON.parse(rawBody);
    } catch {
        return { ok: false, reason: "invalid_json" };
    }

    if (body.object !== "whatsapp_business_account") {
        return { ok: true, reason: "not_a_whatsapp_event" };
    }

    // Step 2: Parse messages
    const messages = parseInboundMessages(body);

    // Step 3: Map each sender and dispatch
    for (const msg of messages) {
        const ctx = await mapSenderToOrg(msg.from);

        if (!ctx) {
            logger.warn(`WhatsApp Copilot: unauthorized sender ${msg.from}`);
            const { sendWhatsAppMessage } = await import("@/lib/whatsapp");
            await sendWhatsAppMessage(
                msg.from,
                "❌ Número não autorizado. Contate seu administrador InovaCortex."
            ).catch(() => { });
            continue;
        }

        // Resolve or create WhatsApp session
        const sessionId = await getOrCreateSession(ctx.orgId, msg.from);

        // Dispatch to CommandParser → CommandEngine / ChatEngine (fire-and-forget)
        routeWhatsAppMessage({
            from: msg.from,
            text: msg.text,
            orgId: ctx.orgId,
            userId: ctx.userId,
            role: ctx.role,
            sessionId
        }).catch(err =>
            logger.error(`Router error for ${msg.from}: ${err.message}`)
        );

        logger.info(`Dispatched: [${ctx.orgSlug}] ${msg.from} → "${msg.text.slice(0, 40)}"`);
    }

    return { ok: true, dispatched: messages.length };
}

// ─── Session Helper ───────────────────────────────────────────────────────────

async function getOrCreateSession(orgId: string, phone: string): Promise<string> {
    const tag = `wa_${phone}`;
    const existing = await (prisma as any).aIChatSession.findFirst({
        where: { organizationId: orgId, title: tag },
        orderBy: { updatedAt: "desc" },
        select: { id: true }
    });
    if (existing) return existing.id;

    const session = await (prisma as any).aIChatSession.create({
        data: { organizationId: orgId, title: tag, mode: "whatsapp_copilot" }
    });
    return session.id;
}
