/**
 * lib/services/billing/on-payment-confirmed.ts
 * V18: Single handler called by BOTH real Stripe webhook and STUB pay.
 *
 * onPaymentConfirmed(orgId, proposalId):
 *  1. Mark BillingRecord as paid
 *  2. Ensure ClientWorkspace exists (idempotent; upgrade provisioning_hold → provisioning)
 *  3. Run full provisioning (tasks + checklist) if not already done
 *  4. Enqueue 3 ActionQueue items:
 *       onboarding_pack_send    (dueAt: now)
 *       kickoff_schedule_prompt (dueAt: now)
 *       remind_onboarding_48h   (dueAt: now + 48h)
 *  5. AuditEvents throughout
 *
 * Fully idempotent — calling twice produces no duplicates.
 */

import { prisma } from "@/lib/prisma";
import { provisionWorkspace } from "@/lib/provisioning";
import { logger } from "@/lib/logger";
import { writeAuditEvent } from "@/lib/audit";

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function onPaymentConfirmed(
    orgId: string,
    proposalId: string,
    context: { stripeSessionId?: string; stub?: boolean } = {},
): Promise<{ workspaceId: string; queued: string[] }> {
    logger.info("onPaymentConfirmed start", { orgId, proposalId, ...context });

    // ── 1. Mark BillingRecord paid (idempotent) ───────────────────────────────
    const billing = await (prisma as any).billingRecord.findUnique({ where: { proposalId } });
    if (!billing) {
        throw new Error(`BillingRecord not found for proposalId: ${proposalId}`);
    }
    if (!["paid", "stub_paid"].includes(billing.status)) {
        await (prisma as any).billingRecord.update({
            where: { proposalId },
            data: {
                status: context.stub ? "stub_paid" : "paid",
                paidAt: new Date(),
            },
        });
    }

    await audit(orgId, proposalId, context.stub ? "billingStubPaid" : "billingPaid", {
        proposalId,
        stub: context.stub ?? false,
        stripeSessionId: context.stripeSessionId,
    });

    // ── 2 + 3. Provision workspace (idempotent) ───────────────────────────────
    // If workspace exists in provisioning_hold → upgrade it; then full-provision tasks/checklist
    const existingWs = await (prisma as any).clientWorkspace.findUnique({
        where: { proposalId },
    });

    if (existingWs && existingWs.status === "provisioning_hold") {
        // Upgrade status so provisionWorkspace sees it and skips re-creation
        await (prisma as any).clientWorkspace.update({
            where: { id: existingWs.id },
            data: { status: "provisioning" },
        });
    }

    const { workspace } = await provisionWorkspace(proposalId, orgId);

    // ── 4. Enqueue onboarding actions ────────────────────────────────────────
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 3600 * 1000);

    const actionsToQueue: Array<{
        type: string;
        priority: string;
        dueAt: Date | null;
        reason: string;
    }> = [
            {
                type: "onboarding_pack_send",
                priority: "high",
                dueAt: null,  // immediate
                reason: "Pagamento confirmado — enviar pacote de onboarding",
            },
            {
                type: "kickoff_schedule_prompt",
                priority: "high",
                dueAt: null,  // immediate
                reason: "Pagamento confirmado — agendar kickoff",
            },
            {
                type: "remind_onboarding_48h",
                priority: "medium",
                dueAt: in48h,
                reason: "Lembrete de onboarding 48h após pagamento",
            },
        ];

    const queued: string[] = [];

    for (const action of actionsToQueue) {
        // Idempotency: skip if pending item already exists for this workspace
        const existing = await (prisma as any).actionQueue.findFirst({
            where: {
                organizationId: orgId,
                type: action.type,
                relatedEntityType: "client_workspace",
                relatedEntityId: workspace.id,
                status: "pending",
            },
        });

        if (!existing) {
            await (prisma as any).actionQueue.create({
                data: {
                    organizationId: orgId,
                    type: action.type,
                    payloadJson: JSON.stringify({ proposalId, orgId, workspaceId: workspace.id }),
                    priority: action.priority,
                    relatedEntityType: "client_workspace",
                    relatedEntityId: workspace.id,
                    status: "pending",
                    approvalRequired: false,
                    reason: action.reason,
                    ...(action.dueAt ? { nextRetryAt: action.dueAt } : {}),
                },
            });
            queued.push(action.type);
        }
    }

    await audit(orgId, proposalId, "onboardingQueued", { workspaceId: workspace.id, actionsQueued: queued });
    logger.info("onPaymentConfirmed complete", { orgId, proposalId, workspaceId: workspace.id, queued });

    return { workspaceId: workspace.id, queued };
}

// ─── Audit helper ─────────────────────────────────────────────────────────────

async function audit(orgId: string, proposalId: string, action: string, details: object) {
    await writeAuditEvent({
        organizationId: orgId,
        action,
        details: {
            proposalId,
            source: "system:on-payment-confirmed",
            ...details,
        },
        strict: true,
        context: { proposalId },
    });
}
