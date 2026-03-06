import { NextResponse } from "next/server";
import { handleInbound } from "@/lib/whatsapp/inbound-handler";

export const runtime = "nodejs";

/**
 * GET /api/webhooks/whatsapp
 * Meta webhook verification challenge.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
        return new NextResponse(challenge, { status: 200 });
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * POST /api/webhooks/whatsapp
 * Receives and processes inbound WhatsApp messages.
 *
 * Steps:
 *   1. Read raw body (needed for HMAC validation)
 *   2. Validate X-Hub-Signature-256
 *   3. Parse inbound messages
 *   4. Map sender → org + role
 *   5. Dispatch to AI Copilot
 */
export async function POST(request: Request) {
    // Read raw body FIRST — must be done before any .json() call
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256");

    try {
        const result = await handleInbound(rawBody, signature);

        if (!result.ok) {
            if (result.reason === "invalid_signature") {
                return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
            }
            // Non-critical failures (invalid_json, not_a_whatsapp_event)
            return NextResponse.json({ ok: false, reason: result.reason }, { status: 200 });
        }

        return NextResponse.json({ ok: true, dispatched: result.dispatched });

    } catch (error: any) {
        console.error("[WhatsApp Webhook] Unhandled error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
