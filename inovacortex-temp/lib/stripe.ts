/**
 * lib/stripe.ts
 * V10: Stripe client factory — only initializes when env vars are present.
 * In stub mode all Stripe calls are no-ops that return simulated data.
 */

import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripeClient(): Stripe | null {
    if (!process.env.STRIPE_SECRET_KEY) return null;
    if (!_stripe) {
        _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: "2024-11-20.acacia",
        });
    }
    return _stripe;
}

export const STRIPE_PLANS: Record<string, string> = {
    growth: process.env.STRIPE_GROWTH_PRICE_ID ?? "price_stub_growth",
    enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID ?? "price_stub_enterprise",
};

export function isStripeEnabled(): boolean {
    return !!process.env.STRIPE_SECRET_KEY;
}
