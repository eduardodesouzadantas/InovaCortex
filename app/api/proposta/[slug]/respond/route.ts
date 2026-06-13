import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit, writeAuditEvent } from "@/lib/audit";
import { logger, withApiLogging } from "@/lib/logger";
import { generateContract } from "@/lib/contract-engine";
import { createCheckoutForProposal } from "@/lib/billing";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { getBaseUrl } from "@/lib/runtime/base-url";

export const runtime = "nodejs";

/**
 * POST /api/proposta/[slug]/respond
 * V18: On accept:
 *  1. Generate Contract draft
 *  2. Create BillingRecord + Checkout URL (real Stripe or STUB)
 *  3. Create ClientWorkspace in provisioning_hold (full provision happens after payment)
 *  4. Notify lead via WhatsApp with contract + payment links
 *
 * Anti-chaos: WhatsApp/Stripe failures are non-fatal — proposal accept still succeeds.
 */
async function POSTHandler(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    const { action } = await request.json();

    if (!["accept", "adjust"].includes(action)) {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const proposal = await (prisma as any).proposal.findUnique({
        where: { publicSlug: slug },
        include: { assessment: true },
    });

    if (!proposal) {
        return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
    }

    if (["accepted", "rejected"].includes(proposal.status)) {
        return NextResponse.json({ error: "Proposta já finalizada" }, { status: 409 });
    }

    const newStatus = action === "accept" ? "accepted" : "draft";
    const auditAction = action === "accept" ? "proposalStatusChanged" : "proposalUpdated";

    await (prisma as any).proposal.update({
        where: { publicSlug: slug },
        data: { status: newStatus },
    });

    await logAudit("presales", proposal.assessmentId, auditAction, { status: newStatus, slug });
    logger.info("Proposal response received", { slug, action, newStatus });

    // ── Non-accept path → return early ───────────────────────────────────────
    if (action !== "accept") {
        return NextResponse.json({ success: true, status: newStatus });
    }

    // ── Accept path: V18 contract + billing autopilot ────────────────────────
    const orgId = proposal.organizationId;
    const assessment = proposal.assessment;

    // Org slug for STUB URLs — try to load from Organization
    const org = await (prisma as any).organization.findUnique({
        where: { id: orgId },
        select: { slug: true, name: true },
    }).catch(() => null);
    const orgSlug = org?.slug ?? orgId;
    const orgName = org?.name ?? "InovaCortex";

    // 1. Generate Contract
    let contractSlug: string | null = null;
    let contractViewUrl: string | null = null;
    try {
        const contractOutput = generateContract({
            proposal: {
                id: proposal.id,
                version: proposal.version ?? 1,
                modules: proposal.modules ?? "[]",
                pricingEstimate: proposal.pricingEstimate ?? "{}",
                roiSnapshot: proposal.roiSnapshot ?? null,
            },
            assessment: {
                id: assessment.id,
                company: assessment.company ?? "Empresa",
                name: assessment.name ?? assessment.email,
                email: assessment.email,
                phone: assessment.phone ?? null,
            },
            orgName,
        });

        // Upsert Contract (idempotent)
        await (prisma as any).contract.upsert({
            where: { proposalId: proposal.id },
            create: {
                orgId,
                proposalId: proposal.id,
                status: "draft",
                publicSlug: contractOutput.publicSlug,
                htmlBody: contractOutput.htmlBody,
            },
            update: {
                htmlBody: contractOutput.htmlBody,
                status: "draft",
            },
        });

        contractSlug = contractOutput.publicSlug;
        const baseUrl = getBaseUrl();
        contractViewUrl = `${baseUrl}/contrato/${contractSlug}`;

        await writeAuditEvent({
            organizationId: orgId,
            assessmentId: proposal.assessmentId,
            action: "contractGenerated",
            details: {
                proposalId: proposal.id,
                contractSlug,
                source: "system:accept-flow",
            },
            strict: true,
            context: { proposalId: proposal.id, contractSlug },
        });

    } catch (err: any) {
        logger.error("Contract generation failed (non-fatal)", { error: err.message, proposalId: proposal.id });
    }

    // 2. Create BillingRecord + checkout session
    let checkoutUrl: string | null = null;
    try {
        const pricing = JSON.parse(proposal.pricingEstimate ?? "{}");
        const amountCents = Math.round((pricing.minBRL ?? 0) * 100);
        const companyName = assessment.company ?? "Cliente";

        const billingResult = await createCheckoutForProposal(orgId, proposal.id, {
            amountCents,
            currency: "BRL",
            description: `Implementação ${orgName} — ${companyName}`,
            orgSlug,
            successPath: contractSlug ? `/contrato/${contractSlug}?paid=1` : `/proposta/${slug}?paid=1`,
            cancelPath: `/proposta/${slug}`,
        });

        checkoutUrl = billingResult.checkoutUrl;
    } catch (err: any) {
        logger.error("Billing creation failed (non-fatal)", { error: err.message, proposalId: proposal.id });
    }

    // 3. Create/update ClientWorkspace in provisioning_hold
    let workspaceId: string | null = null;
    try {
        const existing = await (prisma as any).clientWorkspace.findUnique({
            where: { proposalId: proposal.id },
        });
        if (!existing) {
            const ws = await (prisma as any).clientWorkspace.create({
                data: {
                    organizationId: orgId,
                    assessmentId: proposal.assessmentId,
                    proposalId: proposal.id,
                    modulesEnabled: proposal.modules ?? "[]",
                    status: "provisioning_hold",
                },
            });
            workspaceId = ws.id;
        } else {
            workspaceId = existing.id;
        }
    } catch (err: any) {
        logger.error("Workspace hold creation failed (non-fatal)", { error: err.message });
    }

    // 4. Notify lead via WhatsApp (non-blocking)
    try {
        const phone = assessment.phone;
        if (phone) {
            const lines = [
                `🎉 *Proposta Aceita — Próximos Passos*`,
                ``,
                `Olá ${assessment.name?.split(" ")[0] ?? ""}! Para iniciarmos a implementação:`,
                ``,
                ...(contractViewUrl ? [`1️⃣ *Assine o contrato:*\n${contractViewUrl}`] : []),
                ...(checkoutUrl ? [`2️⃣ *Realize o pagamento:*\n${checkoutUrl}`] : []),
                ``,
                `Após a confirmação do pagamento, sua equipe receberá o pacote de onboarding e agendaremos o kickoff.`,
                ``,
                `_${orgName}_`,
            ];
            await sendWhatsAppMessage(phone, lines.join("\n"));
        }
    } catch (err: any) {
        logger.error("WhatsApp notification failed (non-fatal)", { error: err.message });
    }

    return NextResponse.json({
        success: true,
        status: newStatus,
        contractSlug,
        checkoutUrl,
        workspaceId,
    });
}

export const POST = withApiLogging("/api/proposta/[slug]/respond", "POST", POSTHandler);
