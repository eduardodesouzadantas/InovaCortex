/**
 * lib/whatsapp.ts
 * R3: WhatsApp Business API client (Meta Cloud API v19).
 *
 * Reads META_WHATSAPP_TOKEN and META_PHONE_NUMBER_ID from env.
 * Gracefully stubs when not configured (logs instead of crashing).
 */

import { logger } from "@/lib/logger";

const META_BASE = "https://graph.facebook.com/v19.0";
const META_TOKEN = process.env.META_WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

export const isWhatsAppEnabled = !!(META_TOKEN && PHONE_NUMBER_ID);

export interface WASendResult {
    messageId: string | null;
    stub: boolean;
    error?: string;
}

/**
 * Send a free-text WhatsApp message to a phone number.
 * @param to   E.164 format, e.g. "5511999998888"
 * @param body Message text (max 4096 chars)
 */
export async function sendWhatsAppMessage(
    to: string,
    body: string,
): Promise<WASendResult> {
    if (!isWhatsAppEnabled) {
        logger.warn("WhatsApp stub: message not sent (META_WHATSAPP_TOKEN not configured)", { to, bodyLength: body.length });
        return { messageId: `stub_${Date.now()}`, stub: true };
    }

    try {
        const res = await fetch(`${META_BASE}/${PHONE_NUMBER_ID}/messages`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${META_TOKEN}`,
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

        const json = await res.json() as any;

        if (!res.ok) {
            const errMsg = json.error?.message ?? `HTTP ${res.status}`;
            logger.error("WhatsApp API error", { to, error: errMsg });
            return { messageId: null, stub: false, error: errMsg };
        }

        const messageId = json.messages?.[0]?.id ?? null;
        logger.info("WhatsApp message sent", { to, messageId });
        return { messageId, stub: false };

    } catch (err) {
        const errMsg = String(err);
        logger.error("WhatsApp send failed", { to, error: errMsg });
        return { messageId: null, stub: false, error: errMsg };
    }
}

/**
 * Send a WhatsApp template message (pre-approved by Meta).
 * @param to           E.164 phone
 * @param templateName Approved template name in Business Manager
 * @param language     e.g. "pt_BR"
 * @param components   Template body parameter components
 */
export async function sendWhatsAppTemplate(
    to: string,
    templateName: string,
    language: string = "pt_BR",
    components: any[] = [],
): Promise<WASendResult> {
    if (!isWhatsAppEnabled) {
        logger.warn("WhatsApp template stub", { to, templateName });
        return { messageId: `stub_tmpl_${Date.now()}`, stub: true };
    }

    try {
        const res = await fetch(`${META_BASE}/${PHONE_NUMBER_ID}/messages`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${META_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to,
                type: "template",
                template: { name: templateName, language: { code: language }, components },
            }),
        });

        const json = await res.json() as any;
        if (!res.ok) {
            return { messageId: null, stub: false, error: json.error?.message ?? `HTTP ${res.status}` };
        }
        return { messageId: json.messages?.[0]?.id ?? null, stub: false };

    } catch (err) {
        return { messageId: null, stub: false, error: String(err) };
    }
}

/**
 * Normalize a Brazilian phone number to E.164.
 * Accepts: (11) 99999-9999, 11999999999, +5511999999999, etc.
 */
export function normalizePhone(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length >= 12) return digits;
    if (digits.length === 11) return `55${digits}`;  // DDD + 9 + number
    if (digits.length === 10) return `55${digits}`;  // DDD + 8-digit number
    return `55${digits}`;
}
