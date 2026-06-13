import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const CLOSED_DEAL_STATUSES = ["closed_won", "closed_lost", "archived"];
const DEFAULT_PIPELINE_NAME = "CRM Principal";
const DEFAULT_PIPELINE_STAGES = [
    { name: "Novo", position: 1, probability: 10 },
    { name: "Contato", position: 2, probability: 25 },
    { name: "Proposta", position: 3, probability: 50 },
    { name: "Negociacao", position: 4, probability: 75 },
    { name: "Fechado", position: 5, probability: 100 },
    { name: "Perdido", position: 6, probability: 0 },
];
const DRY_RUN_ROLLBACK = "__WHATSAPP_INBOUND_CRM_DRY_RUN_ROLLBACK__";

function loadEnvFile(filename) {
    const fullPath = path.resolve(process.cwd(), filename);
    if (!fs.existsSync(fullPath)) {
        return;
    }

    const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }

        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex < 0) {
            continue;
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        if (!key || process.env[key]) {
            continue;
        }

        let value = trimmed.slice(separatorIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        process.env[key] = value;
    }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

function getArgValue(name, fallback = null) {
    const index = process.argv.indexOf(name);
    if (index === -1) {
        return fallback;
    }

    return process.argv[index + 1] ?? fallback;
}

function createPayload({ phoneNumberId, fromPhone, messageId, messageText, profileName }) {
    return {
        object: "whatsapp_business_account",
        entry: [
            {
                id: "crm-integration-test-entry",
                changes: [
                    {
                        field: "messages",
                        value: {
                            metadata: {
                                phone_number_id: phoneNumberId,
                            },
                            contacts: [
                                {
                                    profile: { name: profileName },
                                    wa_id: fromPhone,
                                },
                            ],
                            messages: [
                                {
                                    from: fromPhone,
                                    id: messageId,
                                    timestamp: String(Math.floor(Date.now() / 1000)),
                                    type: "text",
                                    text: {
                                        body: messageText,
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
        ],
    };
}

function parseInboundMessage(payload) {
    const value = payload?.entry?.[0]?.changes?.[0]?.value;
    const contact = value?.contacts?.[0];
    const message = value?.messages?.[0];

    if (!value?.metadata?.phone_number_id || !message?.from || !message?.id) {
        throw new Error("INVALID_TEST_PAYLOAD");
    }

    return {
        phoneNumberId: value.metadata.phone_number_id,
        from: message.from,
        messageId: message.id,
        timestamp: Number.parseInt(message.timestamp, 10),
        text: message.text?.body ?? `[${message.type ?? "text"} message]`,
        type: typeof message.type === "string" ? message.type : "text",
        profileName: contact?.profile?.name ?? null,
        raw: message,
    };
}

function createReport(input) {
    return {
        success: false,
        dryRun: input.dryRun,
        input: {
            orgSlug: input.orgSlug,
            phoneNumberId: input.phoneNumberId,
            fromPhone: input.fromPhone,
            messageId: input.messageId,
        },
        steps: [],
        organizationId: null,
        contactId: null,
        conversationId: null,
        messageId: input.messageId,
        dealId: null,
        activityId: null,
        failedStep: null,
        error: null,
        notes: [],
    };
}

function addStep(report, step, status, details = {}) {
    report.steps.push({
        step,
        status,
        ...details,
    });
}

async function ensureDefaultPipelineAndStage(client, organizationId) {
    const pipeline = await client.pipeline.findFirst({
        where: { organizationId },
        select: { id: true, name: true },
        orderBy: [
            { position: "asc" },
            { createdAt: "asc" },
        ],
    });

    if (pipeline) {
        const firstStage = await client.pipelineStage.findFirst({
            where: { pipelineId: pipeline.id },
            select: { id: true, name: true },
            orderBy: { position: "asc" },
        });

        if (firstStage) {
            return {
                pipelineId: pipeline.id,
                pipelineName: pipeline.name,
                stageId: firstStage.id,
                stageName: firstStage.name,
                pipelineCreated: false,
                stagesCreated: false,
            };
        }

        await client.pipelineStage.createMany({
            data: DEFAULT_PIPELINE_STAGES.map((stage) => ({
                pipelineId: pipeline.id,
                name: stage.name,
                position: stage.position,
                probability: stage.probability,
            })),
        });

        const createdFirstStage = await client.pipelineStage.findFirst({
            where: { pipelineId: pipeline.id },
            select: { id: true, name: true },
            orderBy: { position: "asc" },
        });

        if (!createdFirstStage) {
            throw new Error("PIPELINE_STAGE_CREATE_FAILED");
        }

        return {
            pipelineId: pipeline.id,
            pipelineName: pipeline.name,
            stageId: createdFirstStage.id,
            stageName: createdFirstStage.name,
            pipelineCreated: false,
            stagesCreated: true,
        };
    }

    const createdPipeline = await client.pipeline.create({
        data: {
            organizationId,
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
            name: true,
            stages: {
                select: { id: true, name: true },
                orderBy: { position: "asc" },
                take: 1,
            },
        },
    });

    const firstStage = createdPipeline.stages[0];
    if (!firstStage) {
        throw new Error("PIPELINE_STAGE_CREATE_FAILED");
    }

    return {
        pipelineId: createdPipeline.id,
        pipelineName: createdPipeline.name,
        stageId: firstStage.id,
        stageName: firstStage.name,
        pipelineCreated: true,
        stagesCreated: true,
    };
}

async function ensureCanonicalDeal(client, { organizationId, contactId }) {
    const existingDeal = await client.deal.findFirst({
        where: {
            organizationId,
            contactId,
            status: { notIn: CLOSED_DEAL_STATUSES },
        },
        select: {
            id: true,
            stage: {
                select: {
                    id: true,
                    name: true,
                    pipeline: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
            activities: {
                where: { type: "deal_created_from_whatsapp" },
                select: { id: true },
                orderBy: { createdAt: "asc" },
                take: 1,
            },
        },
        orderBy: { createdAt: "desc" },
    });

    if (existingDeal) {
        return {
            created: false,
            dealId: existingDeal.id,
            activityId: existingDeal.activities[0]?.id ?? null,
            pipelineId: existingDeal.stage.pipeline.id,
            pipelineName: existingDeal.stage.pipeline.name,
            stageId: existingDeal.stage.id,
            stageName: existingDeal.stage.name,
        };
    }

    const defaultStage = await ensureDefaultPipelineAndStage(client, organizationId);
    const deal = await client.deal.create({
        data: {
            organizationId,
            contactId,
            stageId: defaultStage.stageId,
            value: null,
            status: "open",
        },
        select: { id: true },
    });

    const activity = await client.activity.create({
        data: {
            organizationId,
            dealId: deal.id,
            type: "deal_created_from_whatsapp",
            note: "Deal automatically created from first inbound WhatsApp message",
        },
        select: { id: true },
    });

    return {
        created: true,
        dealId: deal.id,
        activityId: activity.id,
        pipelineId: defaultStage.pipelineId,
        pipelineName: defaultStage.pipelineName,
        stageId: defaultStage.stageId,
        stageName: defaultStage.stageName,
        pipelineCreated: defaultStage.pipelineCreated,
        stagesCreated: defaultStage.stagesCreated,
    };
}

async function executeFlow(client, report, payload) {
    const inbound = parseInboundMessage(payload);
    const timestamp = new Date(inbound.timestamp * 1000);
    const sessionWindowUntil = new Date(timestamp.getTime() + 24 * 60 * 60 * 1000);

    const channel = await client.whatsAppChannel.findUnique({
        where: { phoneNumberId: inbound.phoneNumberId },
        select: {
            id: true,
            phoneNumberId: true,
            businessAccountId: true,
            organizationId: true,
            organization: {
                select: {
                    id: true,
                    slug: true,
                    name: true,
                },
            },
        },
    });

    if (!channel) {
        throw new Error("WHATSAPP_CHANNEL_NOT_FOUND");
    }

    report.organizationId = channel.organizationId;
    addStep(report, "resolve_whatsapp_channel", "ok", {
        channelId: channel.id,
        organizationId: channel.organizationId,
        businessAccountId: channel.businessAccountId,
    });

    addStep(report, "resolve_organization", "ok", {
        organizationId: channel.organization.id,
        organizationSlug: channel.organization.slug,
    });

    const contact = await client.contact.upsert({
        where: {
            organizationId_phoneNumberE164: {
                organizationId: channel.organizationId,
                phoneNumberE164: inbound.from,
            },
        },
        create: {
            organizationId: channel.organizationId,
            phoneNumberE164: inbound.from,
            wa_id: inbound.from,
            name: inbound.profileName,
            lastMessageAt: timestamp,
            lastInboundAt: timestamp,
            sessionWindowUntil,
        },
        update: {
            wa_id: inbound.from,
            name: inbound.profileName ?? undefined,
            lastMessageAt: timestamp,
            lastInboundAt: timestamp,
            sessionWindowUntil,
        },
        select: {
            id: true,
        },
    });

    report.contactId = contact.id;
    addStep(report, "upsert_contact", "ok", {
        organizationId: channel.organizationId,
        contactId: contact.id,
    });

    const existingConversation = await client.whatsAppConversation.findFirst({
        where: {
            organizationId: channel.organizationId,
            contactId: contact.id,
            status: { in: ["open", "snoozed"] },
        },
        select: {
            id: true,
        },
    });

    const conversation = existingConversation
        ? await client.whatsAppConversation.update({
            where: { id: existingConversation.id },
            data: {
                status: "open",
                lastMessageAt: timestamp,
                lastMessagePreview: inbound.text,
                unreadCount: { increment: 1 },
            },
            select: { id: true },
        })
        : await client.whatsAppConversation.create({
            data: {
                organizationId: channel.organizationId,
                contactId: contact.id,
                status: "open",
                lastMessageAt: timestamp,
                lastMessagePreview: inbound.text,
                unreadCount: 1,
            },
            select: { id: true },
        });

    report.conversationId = conversation.id;
    addStep(report, "find_or_create_conversation", existingConversation ? "reused" : "created", {
        conversationId: conversation.id,
    });

    const existingMessage = await client.whatsAppMessage.findFirst({
        where: {
            organizationId: channel.organizationId,
            messageId: inbound.messageId,
        },
        select: {
            id: true,
            messageId: true,
        },
    });

    const message = existingMessage
        ? existingMessage
        : await client.whatsAppMessage.create({
            data: {
                organizationId: channel.organizationId,
                conversationId: conversation.id,
                contactId: contact.id,
                messageId: inbound.messageId,
                direction: "inbound",
                type: inbound.type,
                text: inbound.type === "text" ? inbound.text : null,
                status: "received",
                sentAt: timestamp,
                deliveredAt: timestamp,
                metaStatusPayload: JSON.stringify(inbound.raw),
            },
            select: {
                id: true,
                messageId: true,
            },
        });

    report.messageId = message.messageId;
    addStep(report, "persist_whatsapp_message", existingMessage ? "reused" : "created", {
        messageRowId: message.id,
        messageId: message.messageId,
    });

    const canonicalDeal = await ensureCanonicalDeal(client, {
        organizationId: channel.organizationId,
        contactId: contact.id,
    });

    report.dealId = canonicalDeal.dealId;
    report.activityId = canonicalDeal.activityId;
    addStep(report, "ensure_canonical_deal", canonicalDeal.created ? "created" : "reused", {
        dealId: canonicalDeal.dealId,
        pipelineId: canonicalDeal.pipelineId,
        stageId: canonicalDeal.stageId,
        pipelineName: canonicalDeal.pipelineName,
        stageName: canonicalDeal.stageName,
    });

    addStep(report, "ensure_deal_activity", canonicalDeal.activityId ? "ok" : "missing", {
        activityId: canonicalDeal.activityId,
    });

    report.notes.push("Deal schema does not currently include a probability field; pipeline stage probability is used.");
    report.success = true;
}

async function main() {
    const dryRun = process.argv.includes("--dry-run");
    const phoneNumberId = process.env.WHATSAPP_TEST_PHONE_NUMBER_ID ?? process.env.META_PHONE_NUMBER_ID;
    const orgSlug = process.env.WHATSAPP_TEST_ORG_SLUG ?? process.env.AGENCY_ORG_SLUG ?? "inovacortex";
    const fromPhone = process.env.WHATSAPP_TEST_FROM_PHONE ?? "5511990000001";
    const messageId = process.env.WHATSAPP_TEST_MESSAGE_ID
        ?? (dryRun ? "wamid.inovacortex.integration.test.dryrun" : "wamid.inovacortex.integration.test");
    const profileName = process.env.WHATSAPP_TEST_PROFILE_NAME ?? "InovaCortex CRM Test";
    const messageText = process.env.WHATSAPP_TEST_MESSAGE_TEXT ?? "InovaCortex deterministic WhatsApp CRM integration test";

    if (!phoneNumberId) {
        throw new Error("META_PHONE_NUMBER_ID_NOT_CONFIGURED");
    }

    const payload = createPayload({
        phoneNumberId,
        fromPhone,
        messageId,
        messageText,
        profileName,
    });

    const prisma = new PrismaClient({
        log: ["error", "warn"],
    });

    const report = createReport({
        dryRun,
        orgSlug,
        phoneNumberId,
        fromPhone,
        messageId,
    });

    try {
        if (dryRun) {
            let dryRunReport = null;

            try {
                await prisma.$transaction(async (tx) => {
                    await executeFlow(tx, report, payload);
                    dryRunReport = structuredClone(report);
                    throw new Error(DRY_RUN_ROLLBACK);
                });
            } catch (error) {
                if (error instanceof Error && error.message === DRY_RUN_ROLLBACK) {
                    Object.assign(report, dryRunReport ?? report);
                    report.success = true;
                    report.notes.push("Dry run completed inside a transaction and was rolled back.");
                } else {
                    throw error;
                }
            }
        } else {
            await executeFlow(prisma, report, payload);
        }

        console.log(JSON.stringify(report, null, 2));
    } catch (error) {
        report.success = false;
        report.failedStep = report.steps.at(-1)?.step ?? "bootstrap";
        report.error = error instanceof Error ? error.message : String(error);
        console.error(JSON.stringify(report, null, 2));
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

main();
