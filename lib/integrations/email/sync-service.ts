import { prisma as defaultDb } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { emitWebhookEvent } from "@/lib/public-api/webhooks";
import { setRequestContext } from "@/lib/observability/request-context";
import { isEmailOAuthProviderConfigured } from "@/lib/integrations/email-oauth";
import { type EmailOAuthProvider } from "@/lib/integrations/email-oauth-types";
import { getOrganizationAccountStatus } from "@/lib/billing/account-status";
import {
    mapProviderEmailToDomain,
    normalizeEmailAddress,
    parseEmailAddressList,
    type ProviderEmailRecord,
} from "./mapper";
import { createGoogleEmailSyncProvider } from "./provider/google";

const EMAIL_SYNC_INITIAL_LOOKBACK_DAYS = 30;
const EMAIL_SYNC_OVERLAP_MINUTES = 5;
const EMAIL_SYNC_RUNNING_STALE_MS = 30 * 60 * 1000;
const CLOSED_DEAL_STATUSES = ["closed_won", "closed_lost", "archived"];
const EMAIL_SYNC_ERROR_MAX_LENGTH = 240;

type EmailSyncStatus = "success" | "failed" | "skipped";

export type EmailSyncProviderClient = {
    provider: EmailOAuthProvider;
    fetchMessages: (input: { since: Date | null }) => Promise<ProviderEmailRecord[]>;
};

type EmailIntegrationRecord = {
    id: string;
    provider: string;
    status: string;
    ownerEmail: string;
    accessTokenEncrypted: string | null;
    refreshTokenEncrypted: string | null;
    expiryAt: Date | null;
    lastSyncAt: Date | null;
    lastSyncStatus: string | null;
    lastSyncDurationMs: number | null;
    updatedAt: Date;
};

export type EmailSyncDb = {
    organization: {
        findUnique: (args: {
            where: { id: string };
            select: {
                subscriptionStatus: true;
            };
        }) => Promise<{ subscriptionStatus: string | null } | null>;
    };
    emailIntegration: {
        findUnique: (args: {
            where: { organizationId: string };
            select: {
                id: true;
                provider: true;
                status: true;
                ownerEmail: true;
                accessTokenEncrypted: true;
                refreshTokenEncrypted: true;
                expiryAt: true;
                lastSyncAt: true;
                lastSyncStatus: true;
                lastSyncDurationMs: true;
                updatedAt: true;
            };
        }) => Promise<EmailIntegrationRecord | null>;
        updateMany: (args: {
            where: {
                organizationId: string;
                status?: string;
                accessTokenEncrypted?: { not: null };
                OR?: Array<{
                    lastSyncStatus?: { not: string } | null;
                    updatedAt?: { lt: Date };
                }>;
            };
            data: {
                lastSyncStatus?: string | null;
                lastError?: string | null;
            };
        }) => Promise<{ count: number }>;
        update: (args: {
            where: { organizationId: string };
            data: {
                lastSyncAt?: Date | null;
                lastSyncStatus?: string | null;
                lastSyncDurationMs?: number | null;
                lastError?: string | null;
            };
        }) => Promise<unknown>;
    };
    emailThread: {
        findUnique: (args: {
            where: {
                organizationId_externalThreadId: {
                    organizationId: string;
                    externalThreadId: string;
                };
            };
            select: {
                id: true;
                contactId: true;
                dealId: true;
                lastMessageAt: true;
                subject: true;
                lastMessagePreview: true;
            };
        }) => Promise<{
            id: string;
            contactId: string | null;
            dealId: string | null;
            lastMessageAt: Date | null;
            subject: string | null;
            lastMessagePreview: string | null;
        } | null>;
        create: (args: {
            data: {
                organizationId: string;
                contactId: string | null;
                dealId: string | null;
                externalThreadId: string;
                subject: string | null;
                status: string;
                lastMessageAt: Date | null;
                lastMessagePreview: string | null;
                unreadCount: number;
            };
        }) => Promise<{ id: string; contactId: string | null }>;
        update: (args: {
            where: { id: string };
            data: {
                contactId?: string | null;
                dealId?: string | null;
                subject?: string | null;
                lastMessageAt?: Date | null;
                lastMessagePreview?: string | null;
            };
        }) => Promise<{ id: string; contactId: string | null }>;
    };
    emailMessage: {
        findUnique: (args: {
            where: { externalMessageId: string };
            select: { id: true };
        }) => Promise<{ id: string } | null>;
        create: (args: {
            data: {
                organizationId: string;
                threadId: string;
                contactId: string | null;
                externalMessageId: string;
                direction: "inbound" | "outbound";
                fromAddress: string;
                toAddress: string;
                subject: string | null;
                bodyText: string | null;
                bodyHtml: string | null;
                status: string;
                sentAt: Date | null;
                receivedAt: Date | null;
                createdAt: Date;
            };
        }) => Promise<unknown>;
        updateMany: (args: {
            where: {
                organizationId: string;
                threadId: string;
                contactId: null;
            };
            data: {
                contactId: string;
            };
        }) => Promise<unknown>;
    };
    contact: {
        findFirst: (args: {
            where: {
                organizationId: string;
                OR: Array<{
                    email: {
                        equals: string;
                        mode: "insensitive";
                    };
                }>;
            };
            select: {
                id: true;
                email: true;
            };
        }) => Promise<{ id: string; email: string | null } | null>;
    };
    deal: {
        findFirst: (args: {
            where: {
                organizationId: string;
                contactId: string;
                status: {
                    notIn: string[];
                };
            };
            select: {
                id: true;
            };
            orderBy: {
                createdAt: "desc";
            };
        }) => Promise<{ id: string } | null>;
    };
    $transaction: <T>(callback: (tx: EmailSyncDb) => Promise<T>) => Promise<T>;
};

export type EmailSyncResult = {
    organizationId: string;
    provider: EmailOAuthProvider | "skipped";
    syncedThreads: number;
    syncedMessages: number;
    matchedContacts: number;
    linkedDeals: number;
    skipped: boolean;
    reason?: string;
    lastSyncAt: string | null;
    lastSyncStatus: EmailSyncStatus;
    lastSyncDurationMs: number;
};

function resolveSinceDate(lastSyncAt: Date | null, overrideSince?: Date | null): Date | null {
    if (overrideSince) {
        return overrideSince;
    }

    if (lastSyncAt) {
        return new Date(lastSyncAt.getTime() - EMAIL_SYNC_OVERLAP_MINUTES * 60 * 1000);
    }

    const initialSince = new Date();
    initialSince.setDate(initialSince.getDate() - EMAIL_SYNC_INITIAL_LOOKBACK_DAYS);
    return initialSince;
}

function sanitizeSyncErrorMessage(error: unknown): string {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const sanitized = rawMessage
        .replace(/Bearer\s+[A-Za-z0-9\-._~+/=]+/gi, "Bearer [redacted]")
        .replace(/(access_token|refresh_token|token|secret)=([^&\s]+)/gi, "$1=[redacted]")
        .replace(/[\r\n]+/g, " ")
        .trim();

    if (!sanitized) {
        return "EMAIL_SYNC_FAILED";
    }

    return sanitized.slice(0, EMAIL_SYNC_ERROR_MAX_LENGTH);
}

async function persistSyncOutcome(db: EmailSyncDb, organizationId: string, outcome: {
    lastSyncStatus: EmailSyncStatus;
    lastSyncDurationMs: number;
    lastSyncAt?: Date | null;
    lastError?: string | null;
}): Promise<void> {
    const data: {
        lastSyncAt?: Date | null;
        lastSyncStatus?: string | null;
        lastSyncDurationMs?: number | null;
        lastError?: string | null;
    } = {
        lastSyncStatus: outcome.lastSyncStatus,
        lastSyncDurationMs: outcome.lastSyncDurationMs,
        lastError: outcome.lastError ?? null,
    };

    if (typeof outcome.lastSyncAt !== "undefined") {
        data.lastSyncAt = outcome.lastSyncAt;
    }

    await db.emailIntegration.update({
        where: { organizationId },
        data,
    }).catch(() => null);
}

async function acquireRunningSyncLock(db: EmailSyncDb, organizationId: string): Promise<boolean> {
    const staleBefore = new Date(Date.now() - EMAIL_SYNC_RUNNING_STALE_MS);
    const result = await db.emailIntegration.updateMany({
        where: {
            organizationId,
            status: "connected",
            accessTokenEncrypted: { not: null },
            OR: [
                { lastSyncStatus: { not: "running" } },
                { lastSyncStatus: null },
                { updatedAt: { lt: staleBefore } },
            ],
        },
        data: {
            lastSyncStatus: "running",
            lastError: null,
        },
    });

    return result.count > 0;
}

async function markSkippedSync(
    db: EmailSyncDb,
    organizationId: string,
    startedAt: number,
    reason: string,
): Promise<void> {
    await persistSyncOutcome(db, organizationId, {
        lastSyncStatus: "skipped",
        lastSyncDurationMs: Date.now() - startedAt,
        lastError: reason,
    });
}

function resolveContactCandidateEmails(email: ProviderEmailRecord, ownerEmail: string): string[] {
    const owner = normalizeEmailAddress(ownerEmail);
    const from = normalizeEmailAddress(email.from);
    const recipients = parseEmailAddressList(email.to);
    const ordered = from === owner ? recipients : [from, ...recipients];

    return Array.from(new Set(ordered.map(normalizeEmailAddress).filter(Boolean)));
}

async function findMatchingContact(db: EmailSyncDb, organizationId: string, candidates: string[]): Promise<{ id: string; email: string | null } | null> {
    if (candidates.length === 0) {
        return null;
    }

    return db.contact.findFirst({
        where: {
            organizationId,
            OR: candidates.map((candidate) => ({
                email: {
                    equals: candidate,
                    mode: "insensitive",
                },
            })),
        },
        select: {
            id: true,
            email: true,
        },
    });
}

async function findLatestActiveDeal(db: EmailSyncDb, organizationId: string, contactId: string): Promise<{ id: string } | null> {
    return db.deal.findFirst({
        where: {
            organizationId,
            contactId,
            status: {
                notIn: CLOSED_DEAL_STATUSES,
            },
        },
        select: {
            id: true,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
}

function resolveMessageDirection(email: ProviderEmailRecord, ownerEmail: string): "inbound" | "outbound" {
    return normalizeEmailAddress(email.from) === normalizeEmailAddress(ownerEmail) ? "outbound" : "inbound";
}

export async function syncEmailIntegration(input: {
    organizationId: string;
    db?: EmailSyncDb;
    providerClient?: EmailSyncProviderClient;
    since?: Date | null;
}): Promise<EmailSyncResult> {
    const db = input.db ?? (defaultDb as unknown as EmailSyncDb);
    const startedAt = Date.now();
    setRequestContext({
        organizationId: input.organizationId,
        operation: "email_sync",
    });

    const integration = await db.emailIntegration.findUnique({
        where: { organizationId: input.organizationId },
        select: {
            id: true,
            provider: true,
            status: true,
            ownerEmail: true,
            accessTokenEncrypted: true,
            refreshTokenEncrypted: true,
            expiryAt: true,
            lastSyncAt: true,
            lastSyncStatus: true,
            lastSyncDurationMs: true,
            updatedAt: true,
        },
    });

    const accountStatus = await getOrganizationAccountStatus(input.organizationId, db as unknown as Parameters<typeof getOrganizationAccountStatus>[1]);
    if (accountStatus === "suspended") {
        if (integration) {
            await markSkippedSync(db, input.organizationId, startedAt, "account_suspended");
        }

        return {
            organizationId: input.organizationId,
            provider: "skipped",
            syncedThreads: 0,
            syncedMessages: 0,
            matchedContacts: 0,
            linkedDeals: 0,
            skipped: true,
            reason: "account_suspended",
            lastSyncAt: integration?.lastSyncAt ? integration.lastSyncAt.toISOString() : null,
            lastSyncStatus: "skipped",
            lastSyncDurationMs: Date.now() - startedAt,
        };
    }

    if (!integration || integration.status !== "connected" || !integration.accessTokenEncrypted) {
        if (integration) {
            await markSkippedSync(db, input.organizationId, startedAt, "integration_not_connected");
        }

        return {
            organizationId: input.organizationId,
            provider: "skipped",
            syncedThreads: 0,
            syncedMessages: 0,
            matchedContacts: 0,
            linkedDeals: 0,
            skipped: true,
            reason: "integration_not_connected",
            lastSyncAt: integration?.lastSyncAt ? integration.lastSyncAt.toISOString() : null,
            lastSyncStatus: "skipped",
            lastSyncDurationMs: Date.now() - startedAt,
        };
    }

    if (integration.provider !== "google") {
        await markSkippedSync(db, input.organizationId, startedAt, "unsupported_provider");

        return {
            organizationId: input.organizationId,
            provider: "skipped",
            syncedThreads: 0,
            syncedMessages: 0,
            matchedContacts: 0,
            linkedDeals: 0,
            skipped: true,
            reason: "unsupported_provider",
            lastSyncAt: integration.lastSyncAt ? integration.lastSyncAt.toISOString() : null,
            lastSyncStatus: "skipped",
            lastSyncDurationMs: Date.now() - startedAt,
        };
    }

    if (!input.providerClient && !isEmailOAuthProviderConfigured("google")) {
        await markSkippedSync(db, input.organizationId, startedAt, "provider_not_configured");

        return {
            organizationId: input.organizationId,
            provider: "skipped",
            syncedThreads: 0,
            syncedMessages: 0,
            matchedContacts: 0,
            linkedDeals: 0,
            skipped: true,
            reason: "provider_not_configured",
            lastSyncAt: integration.lastSyncAt ? integration.lastSyncAt.toISOString() : null,
            lastSyncStatus: "skipped",
            lastSyncDurationMs: Date.now() - startedAt,
        };
    }

    if (!(await acquireRunningSyncLock(db, input.organizationId))) {
        logger.info("[Email Sync] Skipping email sync because another run is already in progress", {
            orgId: input.organizationId,
            provider: integration.provider,
        });

        return {
            organizationId: input.organizationId,
            provider: "skipped",
            syncedThreads: 0,
            syncedMessages: 0,
            matchedContacts: 0,
            linkedDeals: 0,
            skipped: true,
            reason: "sync_in_progress",
            lastSyncAt: integration.lastSyncAt ? integration.lastSyncAt.toISOString() : null,
            lastSyncStatus: "skipped",
            lastSyncDurationMs: Date.now() - startedAt,
        };
    }

    const providerClient = input.providerClient ?? createGoogleEmailSyncProvider({
        accessToken: integration.accessTokenEncrypted,
        refreshToken: integration.refreshTokenEncrypted,
        expiryAt: integration.expiryAt,
    });

    const since = resolveSinceDate(integration.lastSyncAt, input.since);
    logger.info("[Email Sync] Starting email sync", {
        orgId: input.organizationId,
        provider: integration.provider,
        since: since ? since.toISOString() : null,
    });
    const providerEmails = await providerClient.fetchMessages({ since });
    const sortedEmails = [...providerEmails].sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());

    let syncedThreads = 0;
    let syncedMessages = 0;
    let matchedContacts = 0;
    let linkedDeals = 0;

    try {
        for (const rawEmail of sortedEmails) {
            let messageReceivedEvent: {
                channel: "email";
                contact: { id: string; email: string | null } | null;
                thread: { id: string; externalThreadId: string; subject: string | null };
                message: {
                    id: string;
                    externalMessageId: string;
                    direction: "inbound" | "outbound";
                    fromAddress: string;
                    toAddress: string;
                    subject: string | null;
                    bodyText: string | null;
                    bodyHtml: string | null;
                    status: string;
                    sentAt: Date | null;
                    receivedAt: Date | null;
                    createdAt: Date;
                };
            } | null = null;

            await db.$transaction(async (tx) => {
                const email = mapProviderEmailToDomain(rawEmail);
                const direction = resolveMessageDirection(email, integration.ownerEmail);
                const candidates = resolveContactCandidateEmails(email, integration.ownerEmail);
                const contact = await findMatchingContact(tx, input.organizationId, candidates);
                const deal = contact ? await findLatestActiveDeal(tx, input.organizationId, contact.id) : null;
                const existingThread = await tx.emailThread.findUnique({
                    where: {
                        organizationId_externalThreadId: {
                            organizationId: input.organizationId,
                            externalThreadId: email.threadExternalId,
                        },
                    },
                    select: {
                        id: true,
                        contactId: true,
                        dealId: true,
                        lastMessageAt: true,
                        subject: true,
                        lastMessagePreview: true,
                    },
                });

                const resolvedContactId = contact?.id ?? existingThread?.contactId ?? null;
                const resolvedDealId = deal?.id ?? existingThread?.dealId ?? null;
                const shouldPromoteThread = !existingThread || (existingThread.lastMessageAt?.getTime() ?? 0) <= email.timestamp.getTime();
                const threadPreview = email.preview;
                let threadId = existingThread?.id ?? null;

                if (!existingThread) {
                    const createdThread = await tx.emailThread.create({
                        data: {
                            organizationId: input.organizationId,
                            contactId: resolvedContactId,
                            dealId: resolvedDealId,
                            externalThreadId: email.threadExternalId,
                            subject: email.subject,
                            status: "open",
                            lastMessageAt: email.timestamp,
                            lastMessagePreview: threadPreview,
                            unreadCount: 0,
                        },
                    });
                    threadId = createdThread.id;
                    syncedThreads += 1;
                } else {
                    const updates: {
                        contactId?: string | null;
                        dealId?: string | null;
                        subject?: string | null;
                        lastMessageAt?: Date | null;
                        lastMessagePreview?: string | null;
                    } = {};

                    if (!existingThread.contactId && resolvedContactId) {
                        updates.contactId = resolvedContactId;
                    }

                    if (!existingThread.dealId && resolvedDealId) {
                        updates.dealId = resolvedDealId;
                    }

                    if (!existingThread.subject && email.subject) {
                        updates.subject = email.subject;
                    }

                    if (shouldPromoteThread) {
                        updates.lastMessageAt = email.timestamp;
                        updates.lastMessagePreview = threadPreview;
                    }

                    if (Object.keys(updates).length > 0) {
                        await tx.emailThread.update({
                            where: { id: existingThread.id },
                            data: updates,
                        });
                    }
                }

                if (!threadId) {
                    throw new Error("EMAIL_THREAD_ID_NOT_RESOLVED");
                }

                if (contact && existingThread?.contactId !== contact.id) {
                    await tx.emailMessage.updateMany({
                        where: {
                            organizationId: input.organizationId,
                            threadId,
                            contactId: null,
                        },
                        data: {
                            contactId: contact.id,
                        },
                    });
                    matchedContacts += 1;
                } else if (contact && !existingThread) {
                    matchedContacts += 1;
                }

                if (deal && existingThread?.dealId !== deal.id) {
                    linkedDeals += 1;
                } else if (deal && !existingThread) {
                    linkedDeals += 1;
                }

                const existingMessage = await tx.emailMessage.findUnique({
                    where: {
                        externalMessageId: email.messageExternalId,
                    },
                    select: {
                        id: true,
                    },
                });

                if (existingMessage) {
                    return;
                }

                await tx.emailMessage.create({
                    data: {
                        organizationId: input.organizationId,
                        threadId,
                        contactId: resolvedContactId,
                        externalMessageId: email.messageExternalId,
                        direction,
                        fromAddress: email.from,
                        toAddress: email.to,
                        subject: email.subject,
                        bodyText: email.body,
                        bodyHtml: email.bodyHtml,
                        status: direction === "inbound" ? "received" : "sent",
                        sentAt: direction === "outbound" ? email.timestamp : null,
                        receivedAt: direction === "inbound" ? email.timestamp : null,
                        createdAt: email.timestamp,
                    },
                });

                syncedMessages += 1;

                if (direction === "inbound") {
                    messageReceivedEvent = {
                        channel: "email",
                        contact: contact ? {
                            id: contact.id,
                            email: contact.email,
                        } : null,
                        thread: {
                            id: threadId,
                            externalThreadId: email.threadExternalId,
                            subject: email.subject,
                        },
                        message: {
                            id: `email:${email.messageExternalId}`,
                            externalMessageId: email.messageExternalId,
                            direction,
                            fromAddress: email.from,
                            toAddress: email.to,
                            subject: email.subject,
                            bodyText: email.body,
                            bodyHtml: email.bodyHtml,
                            status: "received",
                            sentAt: null,
                            receivedAt: email.timestamp,
                            createdAt: email.timestamp,
                        },
                    };
                }
            });

            if (messageReceivedEvent) {
                void emitWebhookEvent({
                    organizationId: input.organizationId,
                    eventType: "message.received",
                    data: messageReceivedEvent,
                });
            }
        }

        const finishedAt = new Date();
        const durationMs = Date.now() - startedAt;

        await persistSyncOutcome(db, input.organizationId, {
            lastSyncStatus: "success",
            lastSyncDurationMs: durationMs,
            lastSyncAt: finishedAt,
            lastError: null,
        });

        logger.info("[Email Sync] Completed email sync", {
            orgId: input.organizationId,
            provider: integration.provider,
            threads: syncedThreads,
            messages: syncedMessages,
            durationMs,
        });

        return {
            organizationId: input.organizationId,
            provider: "google",
            syncedThreads,
            syncedMessages,
            matchedContacts,
            linkedDeals,
            skipped: false,
            lastSyncAt: finishedAt.toISOString(),
            lastSyncStatus: "success",
            lastSyncDurationMs: durationMs,
        };
    } catch (error) {
        const message = sanitizeSyncErrorMessage(error);
        const durationMs = Date.now() - startedAt;

        await persistSyncOutcome(db, input.organizationId, {
            lastSyncStatus: "failed",
            lastSyncDurationMs: durationMs,
            lastError: message,
        });

        logger.warn("[Email Sync] Failed to sync emails", {
            orgId: input.organizationId,
            provider: integration.provider,
            error: message,
            durationMs,
        });

        throw error;
    }
}
