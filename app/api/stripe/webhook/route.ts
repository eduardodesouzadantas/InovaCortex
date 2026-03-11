import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripeClient, isStripeEnabled } from "@/lib/stripe";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * POST /api/stripe/webhook
 * Receives Stripe events and updates Organization subscription status.
 *
 * Envs required:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 */
export async function POST(request: NextRequest) {
    if (!isStripeEnabled()) {
        return NextResponse.json({ received: true, mode: "stub" });
    }

    const stripe = getStripeClient()!;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        logger.warn("STRIPE_WEBHOOK_SECRET not configured; webhook running in degraded mode");
        return NextResponse.json({
            received: true,
            warning: "stripe_webhook_secret_missing",
            mode: "degraded",
        });
    }

    const body = await request.text();
    const signature = request.headers.get("stripe-signature") ?? "";

    let event: any;
    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
        logger.warn("Stripe webhook signature verification failed", { error: String(err) });
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    logger.info("Stripe webhook received", { type: event.type });

    // ── Handle events ─────────────────────────────────────────────────────────

    const handlers: Record<string, (event: any) => Promise<void>> = {
        "customer.subscription.created": handleSubscriptionUpsert,
        "customer.subscription.updated": handleSubscriptionUpsert,
        "customer.subscription.deleted": handleSubscriptionDeleted,
        "invoice.payment_succeeded": handlePaymentSucceeded,
        "invoice.payment_failed": handlePaymentFailed,
    };

    const handler = handlers[event.type];
    if (handler) {
        try {
            await handler(event);
        } catch (err) {
            logger.error("Stripe webhook handler error", { type: event.type, error: String(err) });
            return NextResponse.json({ error: "Handler failed" }, { status: 500 });
        }
    }

    return NextResponse.json({ received: true });
}

// ── Event Handlers ─────────────────────────────────────────────────────────────

async function resolveOrgByCustomer(customerId: string): Promise<any | null> {
    return (prisma as any).organization.findFirst({ where: { stripeCustomerId: customerId } });
}

function planFromPriceId(priceId?: string): string {
    if (!priceId) return "free";
    if (priceId.includes("enterprise")) return "enterprise";
    if (priceId.includes("growth")) return "growth";
    return "free";
}

async function handleSubscriptionUpsert(event: any) {
    const sub = event.data.object;
    const org = await resolveOrgByCustomer(sub.customer);
    if (!org) return;

    const plan = planFromPriceId(sub.items?.data?.[0]?.price?.id);

    await (prisma as any).organization.update({
        where: { id: org.id },
        data: {
            stripeSubscriptionId: sub.id,
            subscriptionStatus: sub.status,           // active | trialing | past_due...
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            plan,
            maxAssessmentsPerMonth: plan === "enterprise" ? 9999 : plan === "growth" ? 100 : 10,
        },
    });

    logger.info("Subscription upserted", { orgId: org.id, plan, status: sub.status });
}

async function handleSubscriptionDeleted(event: any) {
    const sub = event.data.object;
    const org = await resolveOrgByCustomer(sub.customer);
    if (!org) return;

    await (prisma as any).organization.update({
        where: { id: org.id },
        data: { subscriptionStatus: "canceled", plan: "free", maxAssessmentsPerMonth: 10 },
    });

    logger.info("Subscription canceled", { orgId: org.id });
}

async function handlePaymentSucceeded(event: any) {
    const invoice = event.data.object;
    const org = await resolveOrgByCustomer(invoice.customer);
    if (!org) return;

    await (prisma as any).organization.update({
        where: { id: org.id },
        data: { subscriptionStatus: "active" },
    });
}

async function handlePaymentFailed(event: any) {
    const invoice = event.data.object;
    const org = await resolveOrgByCustomer(invoice.customer);
    if (!org) return;

    await (prisma as any).organization.update({
        where: { id: org.id },
        data: { subscriptionStatus: "past_due" },
    });

    logger.warn("Payment failed — org moved to past_due", { orgId: org.id });
}
