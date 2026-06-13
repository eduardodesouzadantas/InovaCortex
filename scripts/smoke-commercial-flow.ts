import { randomUUID } from "crypto";

import { ensureAssessmentCommercialFlow, ensureCommercialDealForContact } from "../lib/commercial/canonical-flow";
import { prisma } from "../lib/prisma";

class RollbackSmokeSuccess extends Error {
    summary: Record<string, unknown>;

    constructor(summary: Record<string, unknown>) {
        super("ROLLBACK_SMOKE_SUCCESS");
        this.summary = summary;
    }
}

async function main() {
    const organization = await prisma.organization.findFirst({
        select: {
            id: true,
            slug: true,
        },
        orderBy: {
            createdAt: "asc",
        },
    });

    if (!organization) {
        throw new Error("SMOKE_ORG_NOT_FOUND");
    }

    const runId = randomUUID().slice(0, 8);
    const phone = `5511999${Date.now().toString().slice(-6)}`;
    const email = `smoke-commercial-${runId}@inovacortex.local`;

    try {
        await prisma.$transaction(async (tx) => {
            const assessment = await tx.assessment.create({
                data: {
                    organizationId: organization.id,
                    name: `Smoke Commercial ${runId}`,
                    email,
                    company: `Smoke Co ${runId}`,
                    role: "Operator",
                    phone,
                    whatsappConsent: false,
                    segment: "services",
                    teamSize: "11-50",
                    volumeDay: "25",
                    channels: JSON.stringify(["WhatsApp"]),
                    stack: JSON.stringify(["CRM"]),
                    pains: JSON.stringify(["followup", "manual_tasks"]),
                    urgency: "high",
                    goal: "validate canonical commercial flow",
                    scoreTotal: 78,
                    scoreBreakdown: JSON.stringify({ operations: 30, sales: 48 }),
                    classification: "Alta prioridade",
                    recommendedMissions: JSON.stringify(["crm", "automation"]),
                    status: "Novo",
                },
                select: {
                    id: true,
                    organizationId: true,
                },
            });

            const flow = await ensureAssessmentCommercialFlow({
                assessmentId: assessment.id,
                source: "assessment",
                db: tx,
            });

            if (!flow.contactId || !flow.dealId) {
                throw new Error("SMOKE_CANONICAL_LINK_FAILED");
            }

            const linkedAssessment = await tx.assessment.findUnique({
                where: { id: assessment.id },
                select: {
                    contactId: true,
                    dealId: true,
                },
            });

            const proposal = await tx.proposal.create({
                data: {
                    assessmentId: assessment.id,
                    organizationId: organization.id,
                    dealId: flow.dealId,
                    version: 1,
                    publicSlug: `smoke-${runId}`,
                    modules: JSON.stringify([{ key: "core", label: "Core" }]),
                    pricingEstimate: JSON.stringify({ minBRL: 10000, maxBRL: 15000 }),
                    roiSnapshot: JSON.stringify({ paybackMonths: 4 }),
                    presalesSnapshot: JSON.stringify({ summary: "smoke validation" }),
                    status: "draft",
                },
                select: {
                    id: true,
                    dealId: true,
                },
            });

            const proposalActivity = await tx.activity.create({
                data: {
                    organizationId: organization.id,
                    dealId: flow.dealId,
                    type: "proposal_created",
                    note: `Smoke proposal ${proposal.id}`,
                },
                select: {
                    id: true,
                },
            });

            const whatsappDeal = await ensureCommercialDealForContact({
                db: tx,
                organizationId: organization.id,
                contactId: flow.contactId,
                existingDealId: flow.dealId,
                source: "whatsapp",
            });

            if (whatsappDeal.dealId !== flow.dealId || !whatsappDeal.reused) {
                throw new Error("SMOKE_WHATSAPP_COMPAT_FAILED");
            }

            const activityCount = await tx.activity.count({
                where: {
                    organizationId: organization.id,
                    dealId: flow.dealId,
                },
            });

            throw new RollbackSmokeSuccess({
                organizationId: organization.id,
                orgSlug: organization.slug,
                assessmentId: assessment.id,
                contactId: flow.contactId,
                dealId: flow.dealId,
                proposalId: proposal.id,
                proposalDealId: proposal.dealId,
                assessmentLinkedContactId: linkedAssessment?.contactId ?? null,
                assessmentLinkedDealId: linkedAssessment?.dealId ?? null,
                activityCount,
                proposalActivityId: proposalActivity.id,
                whatsappDealId: whatsappDeal.dealId,
                whatsappReused: whatsappDeal.reused,
                rolledBack: true,
            });
        }, {
            maxWait: 20_000,
            timeout: 20_000,
        });
    } catch (error) {
        if (error instanceof RollbackSmokeSuccess) {
            console.log(JSON.stringify({
                ok: true,
                validation: "commercial_flow_smoke",
                mode: "transactional_rollback",
                ...error.summary,
            }, null, 2));
            return;
        }

        throw error;
    }
}

main().catch((error) => {
    console.error(JSON.stringify({
        ok: false,
        validation: "commercial_flow_smoke",
        error: error instanceof Error ? error.message : String(error),
    }, null, 2));
    process.exit(1);
});
