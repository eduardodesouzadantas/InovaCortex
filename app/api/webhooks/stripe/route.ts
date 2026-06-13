import { NextRequest, NextResponse } from "next/server";
import { logger, withApiLogging } from "@/lib/logger";
import { onPaymentConfirmed } from "@/lib/services/billing/on-payment-confirmed";
import { prisma } from "@/lib/prisma";
import {
    logWebhookFailure,
    logWebhookProcessed,
    logWebhookReceived,
    logWebhookRejected,
    verifyStripeEvent,
} from "@/lib/webhooks/security";

export const runtime = "nodejs";

async function POSTHandler(request: NextRequest) {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");
    const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
    const stripeSecretKey = (process.env.STRIPE_SECRET_KEY ?? "").trim();

    if (!webhookSecret || !stripeSecretKey) {
        logWebhookFailure("stripe", "missing webhook configuration", {
            hasWebhookSecret: Boolean(webhookSecret),
            hasStripeSecretKey: Boolean(stripeSecretKey),
        });
        return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 503 });
    }

    if (!signature) {
        logWebhookRejected("stripe", "missing_signature", {
            header: "stripe-signature",
            payloadBytes: rawBody.length,
        });
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    let event: any;
    try {
        event = await verifyStripeEvent(rawBody, signature, stripeSecretKey, webhookSecret);
    } catch (error) {
        logWebhookRejected("stripe", "invalid_signature", {
            header: "stripe-signature",
            payloadBytes: rawBody.length,
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    logWebhookReceived("stripe", event, {
        payloadBytes: rawBody.length,
    });

    const handledTypes = new Set([
        "checkout.session.completed",
        "invoice.payment_succeeded",
        "payment_intent.succeeded",
    ]);

    if (!handledTypes.has(event.type)) {
        logWebhookProcessed("stripe", event, { skipped: true });
        return NextResponse.json({ received: true, skipped: true });
    }

    const session = event.data?.object ?? {};
    const sessionId: string | null =
        session.id ??
        session.payment_intent ??
        session.metadata?.sessionId ??
        null;

    let proposalId: string | null = session.metadata?.proposalId ?? null;
    let orgId: string | null = session.metadata?.orgId ?? null;

    if (!proposalId && sessionId) {
        const billing = await (prisma as any).billingRecord.findFirst({
            where: { stripeCheckoutSessionId: sessionId },
            select: {
                proposalId: true,
                orgId: true,
            },
        });
        proposalId = billing?.proposalId ?? null;
        orgId = billing?.orgId ?? null;
    }

    if (!proposalId || !orgId) {
        logWebhookRejected("stripe", "unresolved_billing_context", {
            eventType: event.type,
            sessionId,
        });
        return NextResponse.json({ received: true, warning: "proposalId not resolved" });
    }

    try {
        const result = await onPaymentConfirmed(orgId, proposalId, {
            stripeSessionId: sessionId ?? undefined,
            stub: false,
        });

        logWebhookProcessed("stripe", event, {
            proposalId,
            orgId,
            workspaceId: result.workspaceId,
            queued: result.queued,
        });

        return NextResponse.json({ received: true, workspaceId: result.workspaceId, queued: result.queued });
    } catch (error) {
        logWebhookFailure("stripe", error, {
            eventType: event.type,
            proposalId,
            orgId,
        });
        logger.error("onPaymentConfirmed failed in webhook", {
            proposalId,
            orgId,
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
    }
}

export const POST = withApiLogging("/api/webhooks/stripe", "POST", POSTHandler);
