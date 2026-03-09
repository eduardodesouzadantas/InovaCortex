/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCheckoutForProposal } from "@/lib/billing";
import { onPaymentConfirmed } from "@/lib/services/billing/on-payment-confirmed";
import { writeAuditEvent } from "@/lib/audit";

async function findBillingRecord(id: string): Promise<any | null> {
    return (
        (await (prisma as any).billingRecord.findUnique({ where: { id } })) ??
        (await (prisma as any).billingRecord.findUnique({ where: { proposalId: id } }))
    );
}

export async function resendBillingCheckoutHandler(id: string): Promise<NextResponse> {
    const billing = await findBillingRecord(id);
    if (!billing) {
        return NextResponse.json({ error: "Billing record not found" }, { status: 404 });
    }

    const org = await (prisma as any).organization.findUnique({
        where: { id: billing.orgId },
        select: { slug: true },
    });
    if (!org?.slug) {
        return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    try {
        const result = await createCheckoutForProposal(billing.orgId, billing.proposalId, {
            amountCents: billing.amountCents,
            currency: billing.currency ?? "BRL",
            description: `Pagamento da proposta ${billing.proposalId.slice(0, 8)}`,
            orgSlug: org.slug,
        });

        await writeAuditEvent({
            organizationId: billing.orgId,
            action: "billingResendRequested",
            details: {
                billingId: billing.id,
                proposalId: billing.proposalId,
                checkoutUrl: result.checkoutUrl,
            },
            strict: true,
            context: { billingId: billing.id, proposalId: billing.proposalId },
        });

        return NextResponse.json({
            ok: true,
            checkoutUrl: result.checkoutUrl,
            stub: result.stub,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message ?? "Failed to resend charge" }, { status: 500 });
    }
}

export async function resendBillingOnboardingHandler(id: string): Promise<NextResponse> {
    const billing = await findBillingRecord(id);
    if (!billing) {
        return NextResponse.json({ error: "Billing record not found" }, { status: 404 });
    }

    if (!["paid", "stub_paid"].includes(billing.status)) {
        return NextResponse.json(
            { error: "Onboarding can only be resent after payment confirmation" },
            { status: 400 },
        );
    }

    try {
        const result = await onPaymentConfirmed(billing.orgId, billing.proposalId, {
            stub: billing.status === "stub_paid",
        });

        await writeAuditEvent({
            organizationId: billing.orgId,
            action: "onboardingResendRequested",
            details: {
                billingId: billing.id,
                proposalId: billing.proposalId,
                workspaceId: result.workspaceId,
                queued: result.queued,
            },
            strict: true,
            context: { billingId: billing.id, proposalId: billing.proposalId },
        });

        return NextResponse.json({ ok: true, workspaceId: result.workspaceId, queued: result.queued });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message ?? "Failed to resend onboarding" }, { status: 500 });
    }
}
