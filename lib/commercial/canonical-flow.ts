import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { emitWebhookEvent } from "@/lib/public-api/webhooks";
import { normalizePhone } from "@/lib/whatsapp";
import {
    recordOnboardingFirstContact,
    recordOnboardingFirstDeal,
    recordOnboardingPipelineConfigured,
} from "@/lib/onboarding-status";

const DEFAULT_PIPELINE_NAME = "CRM Principal";
const CLOSED_DEAL_STATUSES = ["closed_won", "closed_lost", "archived"] as const;
const DEFAULT_PIPELINE_STAGES = [
    { name: "Novo", position: 1, probability: 10 },
    { name: "Contato", position: 2, probability: 25 },
    { name: "Proposta", position: 3, probability: 50 },
    { name: "Negociacao", position: 4, probability: 75 },
    { name: "Fechado", position: 5, probability: 100 },
    { name: "Perdido", position: 6, probability: 0 },
] as const;

type CommercialDbClient = Prisma.TransactionClient | typeof prisma;
type DealSource = "assessment" | "proposal" | "whatsapp";

type AssessmentSnapshot = {
    id: string;
    organizationId: string;
    name: string;
    company: string;
    phone: string | null;
    contactId: string | null;
    dealId: string | null;
};

export type CanonicalDealResolution = {
    dealId: string | null;
    pipelineId: string | null;
    stageId: string | null;
    created: boolean;
    reused: boolean;
    activityIds: string[];
    dealCreatedActivityId: string | null;
};

export type AssessmentCommercialFlowResult = CanonicalDealResolution & {
    assessmentId: string;
    organizationId: string;
    contactId: string | null;
    phoneNumberE164: string | null;
    contactCreated: boolean;
    contactReused: boolean;
    assessmentLinked: boolean;
    assessmentLinkedActivityId: string | null;
};

function getDb(db?: CommercialDbClient): CommercialDbClient {
    return db ?? prisma;
}

function buildDealCreatedActivity(input: { source: DealSource; assessmentId?: string; company?: string }) {
    if (input.source === "whatsapp") {
        return {
            type: "deal_created_from_whatsapp",
            note: "Canonical deal automatically created from WhatsApp pipeline",
        };
    }

    if (input.source === "proposal") {
        return {
            type: "deal_created_from_proposal",
            note: `Canonical deal created during proposal orchestration${input.company ? ` for ${input.company}` : ""}`,
        };
    }

    return {
        type: "deal_created_from_assessment",
        note: `Canonical deal created from assessment ${input.assessmentId ?? "unknown"}${input.company ? ` for ${input.company}` : ""}`,
    };
}

async function loadAssessment(db: CommercialDbClient, assessmentId: string): Promise<AssessmentSnapshot> {
    const assessment = await db.assessment.findUnique({
        where: { id: assessmentId },
        select: {
            id: true,
            organizationId: true,
            name: true,
            company: true,
            phone: true,
            contactId: true,
            dealId: true,
        },
    });

    if (!assessment) {
        throw new Error("ASSESSMENT_NOT_FOUND");
    }

    return assessment;
}

export async function ensureDefaultCommercialPipelineStage(input: {
    organizationId: string;
    db?: CommercialDbClient;
}): Promise<{ pipelineId: string; stageId: string }> {
    const db = getDb(input.db);
    const pipeline = await db.pipeline.findFirst({
        where: { organizationId: input.organizationId },
        select: { id: true },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });

    if (pipeline) {
        const firstStage = await db.pipelineStage.findFirst({
            where: { pipelineId: pipeline.id },
            select: { id: true },
            orderBy: { position: "asc" },
        });

        if (firstStage) {
            void recordOnboardingPipelineConfigured(input.organizationId).catch(() => undefined);
            return {
                pipelineId: pipeline.id,
                stageId: firstStage.id,
            };
        }

        await db.pipelineStage.createMany({
            data: DEFAULT_PIPELINE_STAGES.map((stage) => ({
                pipelineId: pipeline.id,
                name: stage.name,
                position: stage.position,
                probability: stage.probability,
            })),
        });

        const createdFirstStage = await db.pipelineStage.findFirst({
            where: { pipelineId: pipeline.id },
            select: { id: true },
            orderBy: { position: "asc" },
        });

        if (createdFirstStage) {
            void recordOnboardingPipelineConfigured(input.organizationId).catch(() => undefined);
            return {
                pipelineId: pipeline.id,
                stageId: createdFirstStage.id,
            };
        }
    }

    const createdPipeline = await db.pipeline.create({
        data: {
            organizationId: input.organizationId,
            name: DEFAULT_PIPELINE_NAME,
            position: 1,
            stages: {
                create: DEFAULT_PIPELINE_STAGES.map((stage) => ({
                    name: stage.name,
                    position: stage.position,
                    probability: stage.probability,
                })),
            },
        },
        select: {
            id: true,
            stages: {
                select: { id: true },
                orderBy: { position: "asc" },
                take: 1,
            },
        },
    });

    const firstStage = createdPipeline.stages[0];
    if (!firstStage) {
        throw new Error("PIPELINE_STAGE_CREATE_FAILED");
    }

    void recordOnboardingPipelineConfigured(input.organizationId).catch(() => undefined);

    return {
        pipelineId: createdPipeline.id,
        stageId: firstStage.id,
    };
}

export async function ensureCommercialDealForContact(input: {
    organizationId: string;
    contactId: string;
    source: DealSource;
    db?: CommercialDbClient;
    existingDealId?: string | null;
    assessmentId?: string;
    company?: string;
}): Promise<CanonicalDealResolution> {
    const db = getDb(input.db);
    const activityIds: string[] = [];

    if (input.existingDealId) {
        const linkedDeal = await db.deal.findFirst({
            where: {
                id: input.existingDealId,
                organizationId: input.organizationId,
                contactId: input.contactId,
            },
            select: {
                id: true,
                stage: {
                    select: {
                        id: true,
                        pipelineId: true,
                    },
                },
            },
        });

        if (linkedDeal) {
            void recordOnboardingPipelineConfigured(input.organizationId).catch(() => undefined);
            return {
                dealId: linkedDeal.id,
                pipelineId: linkedDeal.stage.pipelineId,
                stageId: linkedDeal.stage.id,
                created: false,
                reused: true,
                activityIds,
                dealCreatedActivityId: null,
            };
        }
    }

    const existingDeal = await db.deal.findFirst({
        where: {
            organizationId: input.organizationId,
            contactId: input.contactId,
            status: { notIn: [...CLOSED_DEAL_STATUSES] },
        },
        select: {
            id: true,
            stage: {
                select: {
                    id: true,
                    pipelineId: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    if (existingDeal) {
        void recordOnboardingPipelineConfigured(input.organizationId).catch(() => undefined);
        return {
            dealId: existingDeal.id,
            pipelineId: existingDeal.stage.pipelineId,
            stageId: existingDeal.stage.id,
            created: false,
            reused: true,
            activityIds,
            dealCreatedActivityId: null,
        };
    }

    const defaultStage = await ensureDefaultCommercialPipelineStage({
        db,
        organizationId: input.organizationId,
    });

    const deal = await db.deal.create({
        data: {
            organizationId: input.organizationId,
            contactId: input.contactId,
            stageId: defaultStage.stageId,
            value: null,
            status: "open",
        },
        select: { id: true },
    });

    const createdActivityDescriptor = buildDealCreatedActivity({
        source: input.source,
        assessmentId: input.assessmentId,
        company: input.company,
    });

    const createdActivity = await db.activity.create({
        data: {
            organizationId: input.organizationId,
            dealId: deal.id,
            type: createdActivityDescriptor.type,
            note: createdActivityDescriptor.note,
        },
        select: { id: true },
    });

    activityIds.push(createdActivity.id);
    void recordOnboardingPipelineConfigured(input.organizationId).catch(() => undefined);
    void recordOnboardingFirstDeal(input.organizationId).catch(() => undefined);

    void emitWebhookEvent({
        organizationId: input.organizationId,
        eventType: "deal.created",
        data: {
            deal: {
                id: deal.id,
                organizationId: input.organizationId,
                contactId: input.contactId,
                stageId: defaultStage.stageId,
                pipelineId: defaultStage.pipelineId,
                status: "open",
                source: input.source,
            },
        },
    });

    void emitWebhookEvent({
        organizationId: input.organizationId,
        eventType: "activity.created",
        data: {
            activity: {
                id: createdActivity.id,
                organizationId: input.organizationId,
                dealId: deal.id,
                type: createdActivityDescriptor.type,
                note: createdActivityDescriptor.note,
            },
        },
    });

    return {
        dealId: deal.id,
        pipelineId: defaultStage.pipelineId,
        stageId: defaultStage.stageId,
        created: true,
        reused: false,
        activityIds,
        dealCreatedActivityId: createdActivity.id,
    };
}

export async function ensureAssessmentCommercialFlow(input: {
    assessmentId: string;
    source?: Exclude<DealSource, "whatsapp">;
    db?: CommercialDbClient;
}): Promise<AssessmentCommercialFlowResult> {
    const db = getDb(input.db);
    const source = input.source ?? "assessment";
    const assessment = await loadAssessment(db, input.assessmentId);

    let phoneNumberE164: string | null = null;
    let contactId: string | null = null;
    let contactCreated = false;
    let contactReused = false;

    if (assessment.contactId) {
        const linkedContact = await db.contact.findFirst({
            where: {
                id: assessment.contactId,
                organizationId: assessment.organizationId,
            },
            select: { id: true },
        });

        if (linkedContact) {
            contactId = linkedContact.id;
            contactReused = true;
        }
    }

    if (!contactId && assessment.phone) {
        phoneNumberE164 = normalizePhone(assessment.phone);
        const existingContact = await db.contact.findUnique({
            where: {
                organizationId_phoneNumberE164: {
                    organizationId: assessment.organizationId,
                    phoneNumberE164,
                },
            },
            select: {
                id: true,
                name: true,
            },
        });

        if (existingContact) {
            contactId = existingContact.id;
            contactReused = true;

            if (!existingContact.name && assessment.name) {
                await db.contact.update({
                    where: { id: existingContact.id },
                    data: { name: assessment.name },
                });
            }
        } else {
            const createdContact = await db.contact.create({
                data: {
                    organizationId: assessment.organizationId,
                    phoneNumberE164,
                    name: assessment.name || null,
                },
                select: { id: true },
            });
            contactId = createdContact.id;
            contactCreated = true;
            void recordOnboardingFirstContact(assessment.organizationId).catch(() => undefined);
        }
    }

    let deal: CanonicalDealResolution = {
        dealId: null,
        pipelineId: null,
        stageId: null,
        created: false,
        reused: false,
        activityIds: [] as string[],
        dealCreatedActivityId: null as string | null,
    };

    if (contactId) {
        deal = await ensureCommercialDealForContact({
            db,
            organizationId: assessment.organizationId,
            contactId,
            existingDealId: assessment.dealId,
            source,
            assessmentId: assessment.id,
            company: assessment.company,
        });
    }

    const shouldUpdateAssessment =
        assessment.contactId !== contactId || assessment.dealId !== deal.dealId;

    if (shouldUpdateAssessment) {
        await db.assessment.update({
            where: { id: assessment.id },
            data: {
                contactId,
                dealId: deal.dealId,
            },
        });
    }

    let assessmentLinkedActivityId: string | null = null;
    if (deal.dealId && shouldUpdateAssessment) {
        const activity = await db.activity.create({
            data: {
                organizationId: assessment.organizationId,
                dealId: deal.dealId,
                type: "assessment_linked",
                note: `Assessment ${assessment.id} linked to canonical commercial flow${assessment.company ? ` for ${assessment.company}` : ""}`,
            },
            select: { id: true },
        });
        assessmentLinkedActivityId = activity.id;
        deal.activityIds.push(activity.id);
    }

    return {
        assessmentId: assessment.id,
        organizationId: assessment.organizationId,
        contactId,
        phoneNumberE164,
        contactCreated,
        contactReused,
        assessmentLinked: shouldUpdateAssessment,
        assessmentLinkedActivityId,
        ...deal,
    };
}
