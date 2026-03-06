import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { onPaymentConfirmed } from "@/lib/services/billing/on-payment-confirmed";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/stripe
 * Handles Stripe checkout.session.completed and invoice.payment_succeeded.
 *
 * STUB-safe: If STRIPE_WEBHOOK_SECRET is not set, skips signature verification
 * (useful for local testing with Stripe CLI or raw curl).
 *
 * On successful payment:
 *  - Finds BillingRecord by stripeCheckoutSessionId
 *  - Delegates to onPaymentConfirmed (workspace + onboarding)
 */
export async function POST(request: NextRequest) {
    const rawBody = await request.text();
    const sig = request.headers.get("stripe-signature") ?? "";
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // ── Parse and verify event ────────────────────────────────────────────────
    let event: any;

    if (webhookSecret) {
        try {
            const stripe = await importStripe();
            event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
        } catch (err: any) {
            logger.error("Stripe webhook signature verification failed", { error: err.message });
            return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
        }
    } else {
        // STUB mode — parse without verification
        try {
            event = JSON.parse(rawBody);
            logger.info("[STUB] Stripe webhook received without signature verification", { type: event.type });
        } catch {
            return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
        }
    }

    // ── Handle relevant events ────────────────────────────────────────────────
    const handledTypes = new Set([
        "checkout.session.completed",
        "invoice.payment_succeeded",
        "payment_intent.succeeded",
    ]);

    if (!handledTypes.has(event.type)) {
        return NextResponse.json({ received: true, skipped: true });
    }

    const session = event.data?.object ?? {};

    // Derive stripeCheckoutSessionId from the event
    const sessionId: string | null =
        session.id ??                              // checkout.session
        session.payment_intent ??                  // invoice
        session.metadata?.sessionId ??
        null;

    // Derive proposalId from metadata or BillingRecord lookup
    let proposalId: string | null = session.metadata?.proposalId ?? null;
    let orgId: string | null = session.metadata?.orgId ?? null;

    if (!proposalId && sessionId) {
        const billing = await (prisma as any).billingRecord.findFirst({
            where: { stripeCheckoutSessionId: sessionId },
        });
        proposalId = billing?.proposalId ?? null;
        orgId = billing?.orgId ?? null;
    }

    if (!proposalId || !orgId) {
        logger.warn("Stripe webhook: could not resolve proposalId/orgId", { sessionId, event: event.type });
        return NextResponse.json({ received: true, warning: "proposalId not resolved" });
    }

    // ── Delegate to onPaymentConfirmed ────────────────────────────────────────
    try {
        const result = await onPaymentConfirmed(orgId, proposalId, {
            stripeSessionId: sessionId ?? undefined,
            stub: !webhookSecret,
        });

        logger.info("Stripe webhook processed", {
            event: event.type,
            proposalId,
            workspaceId: result.workspaceId,
            queued: result.queued,
        });

        return NextResponse.json({ received: true, workspaceId: result.workspaceId, queued: result.queued });

    } catch (err: any) {
        logger.error("onPaymentConfirmed failed in webhook", { error: err.message, proposalId });
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

async function importStripe() {
    const { default: Stripe } = await import("stripe");
    return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-02-25.clover" });
}
