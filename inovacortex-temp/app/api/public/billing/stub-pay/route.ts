import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { onPaymentConfirmed } from "@/lib/services/billing/on-payment-confirmed";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * POST /api/public/billing/stub-pay
 * STUB-only endpoint: simulates a payment for local/dev testing.
 * Calls the same onPaymentConfirmed handler as the real Stripe webhook.
 *
 * Only active when STRIPE_SECRET_KEY is not set (or NEXT_PUBLIC_DEV_STUB=true).
 */
export async function POST(request: NextRequest) {
    const isStubAllowed = !process.env.STRIPE_SECRET_KEY ||
        process.env.NEXT_PUBLIC_DEV_STUB === "true";

    if (!isStubAllowed) {
        return NextResponse.json({ error: "Stub payments disabled in production." }, { status: 403 });
    }

    let body: { proposalId?: string } = {};
    try { body = await request.json(); } catch { }

    const { proposalId } = body;
    if (!proposalId) {
        return NextResponse.json({ error: "proposalId required." }, { status: 400 });
    }

    const billing = await (prisma as any).billingRecord.findUnique({
        where: { proposalId },
    });

    if (!billing) {
        return NextResponse.json({ error: "BillingRecord not found." }, { status: 404 });
    }

    if (["paid", "stub_paid"].includes(billing.status)) {
        return NextResponse.json({ success: true, alreadyPaid: true, status: billing.status });
    }

    logger.info("[STUB] Simulating payment", { proposalId, orgId: billing.orgId });

    try {
        const result = await onPaymentConfirmed(billing.orgId, proposalId, { stub: true });
        return NextResponse.json({
            success: true,
            stub: true,
            workspaceId: result.workspaceId,
            queued: result.queued,
        });
    } catch (err: any) {
        logger.error("[STUB] onPaymentConfirmed failed", { error: err.message, proposalId });
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
