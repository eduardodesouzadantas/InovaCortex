import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const CLOSED_DEAL_STATUSES = ["closed_won", "closed_lost", "archived"];

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

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function addStep(report, step, status, details = {}) {
    report.steps.push({
        step,
        status,
        ...details,
    });
}

async function waitForRecord(loader, predicate, attempts = 5, delayMs = 400) {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const value = await loader();
        if (predicate(value)) {
            return value;
        }

        if (attempt < attempts) {
            await sleep(delayMs);
        }
    }

    return loader();
}

async function main() {
    const baseUrl = (getArgValue("--base-url", process.env.WHATSAPP_WEBHOOK_TEST_BASE_URL ?? "http://localhost:3000") ?? "http://localhost:3000").replace(/\/+$/, "");
    const phoneNumberId = process.env.WHATSAPP_TEST_PHONE_NUMBER_ID ?? process.env.META_PHONE_NUMBER_ID;
    const appSecret = process.env.META_APP_SECRET ?? "";
    const fromPhone = process.env.WHATSAPP_TEST_FROM_PHONE ?? "5511990000002";
    const messageId = process.env.WHATSAPP_TEST_MESSAGE_ID ?? "wamid.inovacortex.meta.webhook.test";
    const profileName = process.env.WHATSAPP_TEST_PROFILE_NAME ?? "InovaCortex Meta Webhook Test";
    const messageText = process.env.WHATSAPP_TEST_MESSAGE_TEXT ?? "InovaCortex Meta webhook canonical CRM integration test";

    if (!phoneNumberId) {
        throw new Error("META_PHONE_NUMBER_ID_NOT_CONFIGURED");
    }

    if (!appSecret.trim()) {
        throw new Error("META_APP_SECRET_NOT_CONFIGURED");
    }

    const payload = {
        object: "whatsapp_business_account",
        entry: [
            {
                id: "meta-webhook-test-entry",
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

    const rawBody = JSON.stringify(payload);
    const signature = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
    const prisma = new PrismaClient({ log: ["error", "warn"] });

    const report = {
        success: false,
        baseUrl,
        input: {
            phoneNumberId,
            fromPhone,
            messageId,
        },
        steps: [],
        organizationId: null,
        contactId: null,
        conversationId: null,
        messageId,
        dealId: null,
        activityId: null,
        failedStep: null,
        error: null,
        webhook: null,
    };

    try {
        const response = await fetch(`${baseUrl}/api/webhooks/meta`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-hub-signature-256": signature,
            },
            body: rawBody,
        });

        const responseText = await response.text();
        let responseBody = responseText;

        try {
            responseBody = JSON.parse(responseText);
        } catch {
            // Keep raw text body when it's not JSON.
        }

        report.webhook = {
            status: response.status,
            body: responseBody,
        };

        if (!response.ok) {
            addStep(report, "post_meta_webhook", "failed", {
                status: response.status,
                body: responseBody,
            });
            throw new Error("WEBHOOK_REQUEST_FAILED");
        }

        addStep(report, "post_meta_webhook", "ok", {
            status: response.status,
        });

        const channel = await prisma.whatsAppChannel.findUnique({
            where: { phoneNumberId },
            select: {
                id: true,
                organizationId: true,
            },
        });

        if (!channel) {
            addStep(report, "resolve_whatsapp_channel", "failed", { phoneNumberId });
            throw new Error("WHATSAPP_CHANNEL_NOT_FOUND");
        }

        report.organizationId = channel.organizationId;
        addStep(report, "resolve_whatsapp_channel", "ok", {
            channelId: channel.id,
            organizationId: channel.organizationId,
        });

        const contact = await waitForRecord(
            () => prisma.contact.findUnique({
                where: {
                    organizationId_phoneNumberE164: {
                        organizationId: channel.organizationId,
                        phoneNumberE164: fromPhone,
                    },
                },
                select: { id: true },
            }),
            (value) => Boolean(value?.id),
        );

        if (!contact) {
            addStep(report, "upsert_contact", "failed", {
                organizationId: channel.organizationId,
                fromPhone,
            });
            throw new Error("CONTACT_NOT_FOUND");
        }

        report.contactId = contact.id;
        addStep(report, "upsert_contact", "ok", {
            contactId: contact.id,
        });

        const conversation = await waitForRecord(
            () => prisma.whatsAppConversation.findFirst({
                where: {
                    organizationId: channel.organizationId,
                    contactId: contact.id,
                },
                select: { id: true },
                orderBy: { updatedAt: "desc" },
            }),
            (value) => Boolean(value?.id),
        );

        if (!conversation) {
            addStep(report, "find_or_create_conversation", "failed", {
                organizationId: channel.organizationId,
                contactId: contact.id,
            });
            throw new Error("CONVERSATION_NOT_FOUND");
        }

        report.conversationId = conversation.id;
        addStep(report, "find_or_create_conversation", "ok", {
            conversationId: conversation.id,
        });

        const message = await waitForRecord(
            () => prisma.whatsAppMessage.findFirst({
                where: {
                    organizationId: channel.organizationId,
                    messageId,
                },
                select: { id: true, messageId: true },
            }),
            (value) => Boolean(value?.id),
        );

        if (!message) {
            addStep(report, "persist_whatsapp_message", "failed", {
                organizationId: channel.organizationId,
                messageId,
            });
            throw new Error("WHATSAPP_MESSAGE_NOT_FOUND");
        }

        addStep(report, "persist_whatsapp_message", "ok", {
            messageRowId: message.id,
            messageId: message.messageId,
        });

        const deal = await waitForRecord(
            () => prisma.deal.findFirst({
                where: {
                    organizationId: channel.organizationId,
                    contactId: contact.id,
                    status: { notIn: CLOSED_DEAL_STATUSES },
                },
                select: {
                    id: true,
                    stageId: true,
                },
                orderBy: { createdAt: "desc" },
            }),
            (value) => Boolean(value?.id),
        );

        if (!deal) {
            addStep(report, "ensure_canonical_deal", "failed", {
                organizationId: channel.organizationId,
                contactId: contact.id,
            });
            throw new Error("DEAL_NOT_FOUND");
        }

        report.dealId = deal.id;
        addStep(report, "ensure_canonical_deal", "ok", {
            dealId: deal.id,
            stageId: deal.stageId,
        });

        const activity = await waitForRecord(
            () => prisma.activity.findFirst({
                where: {
                    organizationId: channel.organizationId,
                    dealId: deal.id,
                    type: "deal_created_from_whatsapp",
                },
                select: { id: true },
                orderBy: { createdAt: "desc" },
            }),
            (value) => Boolean(value?.id),
        );

        if (!activity) {
            addStep(report, "ensure_deal_activity", "failed", {
                organizationId: channel.organizationId,
                dealId: deal.id,
            });
            throw new Error("ACTIVITY_NOT_FOUND");
        }

        report.activityId = activity.id;
        addStep(report, "ensure_deal_activity", "ok", {
            activityId: activity.id,
        });

        report.success = true;
        console.log(JSON.stringify(report, null, 2));
    } catch (error) {
        report.failedStep = report.steps.at(-1)?.step ?? "bootstrap";
        report.error = error instanceof Error ? error.message : String(error);
        console.error(JSON.stringify(report, null, 2));
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

main();
