/**
 * lib/billing.ts
 * V18: Billing Adapter — Stripe (real) or STUB mode.
 *
 * Anti-chaos rule: NEVER blocks the app when STRIPE_SECRET_KEY is missing.
 * STUB mode creates a functional BillingRecord with a local stub-pay URL.
 *
 * Usage:
 *   const result = await createCheckoutForProposal(orgId, proposalId, opts);
 *   → result.checkoutUrl  (real Stripe URL or /org/[slug]/billing/stub/[id])
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/runtime/base-url";
import { writeAuditEvent } from "@/lib/audit";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CheckoutOptions {
    amountCents: number;
    currency?: string;
    description: string;
    orgSlug: string;
    successPath?: string;
    cancelPath?: string;
}

export interface CheckoutResult {
    sessionId: string;
    checkoutUrl: string;
    stub: boolean;
}

// ─── Main Function ────────────────────────────────────────────────────────────

/**
 * Creates (or finds existing) BillingRecord for a proposal.
 * Idempotent: returns existing if already created.
 */
export async function createCheckoutForProposal(
    orgId: string,
    proposalId: string,
    opts: CheckoutOptions,
): Promise<CheckoutResult> {
    // Idempotency: return existing BillingRecord if already created
    const existing = await (prisma as any).billingRecord.findUnique({
        where: { proposalId },
    });
    if (existing?.checkoutUrl) {
        return {
            sessionId: existing.stripeCheckoutSessionId ?? `existing_${existing.id}`,
            checkoutUrl: existing.checkoutUrl,
            stub: !existing.stripeCheckoutSessionId || existing.stripeCheckoutSessionId.startsWith("stub_"),
        };
    }

    const isStripeEnabled = !!process.env.STRIPE_SECRET_KEY;
    const baseUrl = getBaseUrl();

    if (isStripeEnabled) {
        return createStripeCheckout(orgId, proposalId, opts, baseUrl);
    }
    return createStubCheckout(orgId, proposalId, opts, baseUrl);
}

// ─── Stripe Mode ──────────────────────────────────────────────────────────────

async function createStripeCheckout(
    orgId: string,
    proposalId: string,
    opts: CheckoutOptions,
    baseUrl: string,
): Promise<CheckoutResult> {
    try {
        const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeSecretKey) {
            throw new Error("STRIPE_SECRET_KEY_MISSING");
        }
        const stripe = await importStripe(stripeSecretKey);

        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],
            line_items: [{
                quantity: 1,
                price_data: {
                    currency: (opts.currency ?? "Brl").toLowerCase(),
                    unit_amount: opts.amountCents,
                    product_data: { name: opts.description },
                },
            }],
            success_url: `${baseUrl}${opts.successPath ?? "/contrato/obrigado"}?session={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}${opts.cancelPath ?? "/proposta-cancelada"}`,
            metadata: { orgId, proposalId },
        });

        const billing = await (prisma as any).billingRecord.upsert({
            where: { proposalId },
            create: {
                orgId, proposalId,
                stripeCheckoutSessionId: session.id,
                amountCents: opts.amountCents,
                currency: opts.currency ?? "BRL",
                status: "pending",
                checkoutUrl: session.url ?? "",
            },
            update: {
                stripeCheckoutSessionId: session.id,
                checkoutUrl: session.url ?? "",
                status: "pending",
            },
        });

        await audit(orgId, proposalId, "billingCheckoutCreated", { sessionId: session.id, amountCents: opts.amountCents });
        logger.info("Stripe checkout session created", { proposalId, sessionId: session.id });

        return { sessionId: session.id, checkoutUrl: session.url ?? "", stub: false };

    } catch (err: any) {
        logger.error("Stripe checkout failed — falling back to STUB", { error: err.message, proposalId });
        return createStubCheckout(orgId, proposalId, opts, baseUrl);
    }
}

// ─── STUB Mode ────────────────────────────────────────────────────────────────

async function createStubCheckout(
    orgId: string,
    proposalId: string,
    opts: CheckoutOptions,
    baseUrl: string,
): Promise<CheckoutResult> {
    const sessionId = `stub_${Date.now()}_${proposalId.slice(0, 8)}`;
    const checkoutUrl = `${baseUrl}/org/${opts.orgSlug}/billing/stub/${proposalId}`;

    await (prisma as any).billingRecord.upsert({
        where: { proposalId },
        create: {
            orgId, proposalId,
            stripeCheckoutSessionId: sessionId,
            amountCents: opts.amountCents,
            currency: opts.currency ?? "BRL",
            status: "pending",
            checkoutUrl,
        },
        update: {
            stripeCheckoutSessionId: sessionId,
            checkoutUrl,
            status: "pending",
        },
    });

    await audit(orgId, proposalId, "billingStubCreated", { sessionId, amountCents: opts.amountCents, checkoutUrl });
    logger.info("[STUB] Billing checkout stub created", { proposalId, checkoutUrl });

    return { sessionId, checkoutUrl, stub: true };
}

// ─── Stripe lazy loader ───────────────────────────────────────────────────────

async function importStripe(secretKey: string) {
    const { default: Stripe } = await import("stripe");
    return new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });
}

// ─── Audit helper ─────────────────────────────────────────────────────────────

async function audit(orgId: string, proposalId: string, action: string, details: object) {
    await writeAuditEvent({
        organizationId: orgId,
        action,
        details: {
            proposalId,
            source: "system:billing",
            ...details,
        },
        strict: true,
        context: { proposalId },
    });
}
