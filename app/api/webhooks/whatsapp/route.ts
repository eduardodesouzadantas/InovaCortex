import { logger, withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { handleInbound } from "@/lib/whatsapp/inbound-handler";
import {
    logWebhookFailure,
    logWebhookProcessed,
    logWebhookReceived,
    logWebhookRejected,
    parseWebhookJson,
    verifyMetaSignature,
} from "@/lib/webhooks/security";

export const runtime = "nodejs";

type WhatsAppWebhookPayload = {
    entry?: Array<{
        id?: string;
        changes?: Array<{
            field?: string;
            value?: {
                metadata?: {
                    phone_number_id?: string;
                    display_phone_number?: string;
                };
                messages?: Array<Record<string, unknown>>;
            };
        }>;
    }>;
};

function extractIncomingMessages(payload: WhatsAppWebhookPayload | null) {
    const messages: Array<{
        entryId: string | null;
        field: string | null;
        phoneNumberId: string | null;
        message: Record<string, unknown>;
    }> = [];

    for (const entry of payload?.entry ?? []) {
        for (const change of entry.changes ?? []) {
            for (const message of change.value?.messages ?? []) {
                messages.push({
                    entryId: entry.id ?? null,
                    field: change.field ?? null,
                    phoneNumberId: change.value?.metadata?.phone_number_id ?? null,
                    message,
                });
            }
        }
    }

    return messages;
}

async function GETHandler(request: Request) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");
    const expectedToken = (process.env.META_VERIFY_TOKEN ?? "").trim();

    if (mode === "subscribe" && token === expectedToken && challenge) {
        logger.info("whatsapp_webhook_received", {
            event: "meta_handshake_verified",
            mode,
        });
        return new NextResponse(challenge, {
            status: 200,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
    }

    logger.warn("whatsapp_webhook_received", {
        event: "meta_handshake_rejected",
        mode,
        tokenMatched: token === expectedToken,
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

async function POSTHandler(request: Request) {
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256");
    const appSecret = (process.env.META_APP_SECRET ?? "").trim();

    if (!appSecret) {
        logWebhookFailure("whatsapp", "missing META_APP_SECRET", { payloadBytes: rawBody.length });
        return NextResponse.json({ error: "WhatsApp webhook not configured" }, { status: 503 });
    }

    if (!signature) {
        logWebhookRejected("whatsapp", "missing_signature", {
            header: "x-hub-signature-256",
            payloadBytes: rawBody.length,
        });
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    if (!verifyMetaSignature(rawBody, signature, appSecret)) {
        logWebhookRejected("whatsapp", "invalid_signature", {
            header: "x-hub-signature-256",
            payloadBytes: rawBody.length,
        });
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = parseWebhookJson<WhatsAppWebhookPayload>(rawBody);
    const incomingMessages = extractIncomingMessages(payload);
    logWebhookReceived("whatsapp", payload, { payloadBytes: rawBody.length });
    logger.info("whatsapp_webhook_received", {
        event: "incoming_webhook",
        payloadBytes: rawBody.length,
        entryCount: payload?.entry?.length ?? 0,
        messageCount: incomingMessages.length,
    });

    for (const item of incomingMessages) {
        logger.info("whatsapp_message_received", {
            entryId: item.entryId,
            field: item.field,
            phoneNumberId: item.phoneNumberId,
            message: item.message,
        });
    }

    try {
        const result = await handleInbound(rawBody, signature);

        if (!result.ok) {
            if (result.reason === "invalid_signature") {
                logWebhookRejected("whatsapp", "invalid_signature_downstream", { payloadBytes: rawBody.length });
                return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
            }

            logWebhookProcessed("whatsapp", payload, {
                result: result.reason,
                dispatched: 0,
            });
            return NextResponse.json({ ok: false, reason: result.reason }, { status: 200 });
        }

        logWebhookProcessed("whatsapp", payload, { dispatched: result.dispatched });
        return NextResponse.json({ ok: true, dispatched: result.dispatched }, { status: 200 });
    } catch (error) {
        logWebhookFailure("whatsapp", error, { payloadBytes: rawBody.length });
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

export const GET = withApiLogging("/api/webhooks/whatsapp", "GET", GETHandler);
export const POST = withApiLogging("/api/webhooks/whatsapp", "POST", POSTHandler);
