import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { processMetaWebhookBody, type MetaWebhookBody } from "@/lib/whatsapp/meta-webhook-service";
import {
    logWebhookFailure,
    logWebhookProcessed,
    logWebhookReceived,
    logWebhookRejected,
    parseWebhookJson,
    verifyMetaSignature,
} from "@/lib/webhooks/security";

export const runtime = "nodejs";

async function GETHandler(request: Request) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
        return new NextResponse(challenge, { status: 200 });
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

async function POSTHandler(request: Request) {
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256");
    const appSecret = (process.env.META_APP_SECRET ?? "").trim();

    if (!appSecret) {
        logWebhookFailure("meta", "missing META_APP_SECRET", { payloadBytes: rawBody.length });
        return NextResponse.json({ error: "Meta webhook not configured" }, { status: 503 });
    }

    if (!signature) {
        logWebhookRejected("meta", "missing_signature", {
            header: "x-hub-signature-256",
            payloadBytes: rawBody.length,
        });
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    if (!verifyMetaSignature(rawBody, signature, appSecret)) {
        logWebhookRejected("meta", "invalid_signature", {
            header: "x-hub-signature-256",
            payloadBytes: rawBody.length,
        });
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = parseWebhookJson<MetaWebhookBody>(rawBody);
    if (!body?.object) {
        logWebhookRejected("meta", "invalid_json_or_body", { payloadBytes: rawBody.length });
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    logWebhookReceived("meta", body, { payloadBytes: rawBody.length });

    try {
        const result = await processMetaWebhookBody(body);
        const statusSummary = result.statusResults.reduce<Record<string, number>>((summary, item) => {
            summary[item.outcome] = (summary[item.outcome] ?? 0) + 1;
            return summary;
        }, {});

        logWebhookProcessed("meta", body, {
            payloadBytes: rawBody.length,
            inboundCount: result.inboundResults.length,
            statusCount: result.statusResults.length,
            statusSummary,
        });

        return NextResponse.json({
            success: true,
            inboundCount: result.inboundResults.length,
            statusCount: result.statusResults.length,
            statusSummary,
        }, { status: 200 });
    } catch (error) {
        logWebhookFailure("meta", error, { payloadBytes: rawBody.length });
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

export const GET = withApiLogging("/api/webhooks/meta", "GET", GETHandler);
export const POST = withApiLogging("/api/webhooks/meta", "POST", POSTHandler);
