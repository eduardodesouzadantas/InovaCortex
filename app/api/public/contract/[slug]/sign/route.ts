import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * PATCH /api/public/contract/[slug]/sign
 * Signs a contract with name + email (simple electronic signature, v1).
 * Returns { checkoutUrl } from the linked BillingRecord.
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;

    let body: { name?: string; email?: string } = {};
    try { body = await request.json(); } catch { }

    const { name, email } = body;
    if (!name?.trim() || !email?.includes("@")) {
        return NextResponse.json({ error: "Nome e e-mail válidos são obrigatórios." }, { status: 400 });
    }

    const contract = await (prisma as any).contract.findUnique({
        where: { publicSlug: slug },
    });

    if (!contract) {
        return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });
    }

    if (contract.status === "signed") {
        // Already signed — return checkoutUrl directly
        const billing = await (prisma as any).billingRecord.findUnique({
            where: { proposalId: contract.proposalId },
            select: { checkoutUrl: true },
        }).catch(() => null);
        return NextResponse.json({ success: true, alreadySigned: true, checkoutUrl: billing?.checkoutUrl ?? null });
    }

    // Sign the contract
    await (prisma as any).contract.update({
        where: { publicSlug: slug },
        data: {
            status: "signed",
            signedName: name.trim(),
            signedEmail: email.trim().toLowerCase(),
            signedAt: new Date(),
        },
    });

    // Audit contractSigned
    await (prisma as any).auditEvent.create({
        data: {
            organizationId: contract.orgId,
            action: "contractSigned",
            userId: "client:" + email.trim().toLowerCase(),
            resourceType: "contract",
            resourceId: contract.id,
            details: JSON.stringify({ slug, signedName: name, signedEmail: email }),
            ipAddress: request.headers.get("x-forwarded-for") ?? "unknown",
        },
    }).catch(() => null);

    logger.info("Contract signed", { slug, signedEmail: email });

    // Retrieve checkoutUrl from BillingRecord
    const billing = await (prisma as any).billingRecord.findUnique({
        where: { proposalId: contract.proposalId },
        select: { checkoutUrl: true },
    }).catch(() => null);

    return NextResponse.json({
        success: true,
        checkoutUrl: billing?.checkoutUrl ?? null,
    });
}
