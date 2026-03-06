import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripeClient, STRIPE_PLANS, isStripeEnabled } from "@/lib/stripe";
import { getSession } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * POST /api/stripe/create-checkout-session
 * Creates a Stripe Checkout session for plan upgrade.
 * In stub mode, returns a clear message to configure Stripe.
 */
export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { plan } = await request.json();

    if (!isStripeEnabled()) {
        return NextResponse.json({
            stubMode: true,
            message: "Configure STRIPE_SECRET_KEY para ativar pagamentos.",
            plan,
        });
    }

    const stripe = getStripeClient()!;
    const priceId = STRIPE_PLANS[plan];
    if (!priceId || priceId.startsWith("price_stub")) {
        return NextResponse.json({ error: "Plano inválido ou não configurado" }, { status: 400 });
    }

    const org = await (prisma as any).organization.findUnique({
        where: { id: session.orgId }
    });
    if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

    // Create or retrieve Stripe customer
    let customerId = org.stripeCustomerId;
    if (!customerId) {
        const customer = await stripe.customers.create({
            metadata: { orgId: org.id, orgSlug: org.slug },
        });
        customerId = customer.id;
        await (prisma as any).organization.update({
            where: { id: org.id },
            data: { stripeCustomerId: customerId },
        });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/org/${org.slug}/admin/billing?success=1`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/org/${org.slug}/admin/billing?canceled=1`,
        metadata: { orgId: org.id, plan },
    });

    logger.info("Stripe checkout session created", { orgId: org.id, plan, sessionId: checkoutSession.id });

    return NextResponse.json({ url: checkoutSession.url });
}
