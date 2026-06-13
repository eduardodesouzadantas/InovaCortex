import { mapProviderEmailToDomain } from "../lib/integrations/email/mapper";
import { syncEmailIntegration, type EmailSyncDb, type EmailSyncProviderClient } from "../lib/integrations/email/sync-service";

type EmailIntegrationSeed = {
    id: string;
    organizationId: string;
    provider: string;
    status: string;
    ownerEmail: string;
    accessTokenEncrypted: string | null;
    refreshTokenEncrypted: string | null;
    expiryAt: Date | null;
    lastSyncAt: Date | null;
    lastSyncStatus: string | null;
    lastSyncDurationMs: number | null;
    lastError: string | null;
    updatedAt: Date;
};

type ThreadSeed = {
    id: string;
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

type MessageSeed = {
    id: string;
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

type ContactSeed = {
    id: string;
    organizationId: string;
    email: string | null;
};

type DealSeed = {
    id: string;
    organizationId: string;
    contactId: string;
    status: string;
    createdAt: Date;
};

type EmailSyncState = {
    organization: { subscriptionStatus: string | null };
    integrations: EmailIntegrationSeed[];
    contacts: ContactSeed[];
    deals: DealSeed[];
    threads: ThreadSeed[];
    messages: MessageSeed[];
};

function createMockEmailSyncDb(seed?: {
    integration?: Partial<EmailIntegrationSeed>;
    contacts?: ContactSeed[];
    deals?: DealSeed[];
    threads?: ThreadSeed[];
    messages?: MessageSeed[];
    organization?: Partial<{ subscriptionStatus: string | null }>;
}): { db: EmailSyncDb; state: EmailSyncState } {
    const state = createBaseState(seed);

    const db: EmailSyncDb = {
        emailIntegration: {
            findUnique: jest.fn(async ({ where }) => {
                return state.integrations.find((integration) => integration.organizationId === where.organizationId) ?? null;
            }),
            updateMany: jest.fn(async ({ where, data }) => {
                let count = 0;

                for (const record of state.integrations) {
                    if (record.organizationId !== where.organizationId) {
                        continue;
                    }

                    if (where.status && record.status !== where.status) {
                        continue;
                    }

                    if (where.accessTokenEncrypted && record.accessTokenEncrypted === null) {
                        continue;
                    }

                    const matchesGuard = !where.OR || where.OR.some((clause) => {
                        if (typeof clause.updatedAt !== "undefined") {
                            return record.updatedAt.getTime() < clause.updatedAt.lt.getTime();
                        }

                        if (clause.lastSyncStatus === null) {
                            return record.lastSyncStatus === null;
                        }

                        if (clause.lastSyncStatus && typeof clause.lastSyncStatus.not !== "undefined") {
                            return record.lastSyncStatus !== clause.lastSyncStatus.not;
                        }

                        return record.lastSyncStatus === null;
                    });

                    if (!matchesGuard) {
                        continue;
                    }

                    count += 1;
                    if (typeof data.lastSyncStatus !== "undefined") {
                        record.lastSyncStatus = data.lastSyncStatus;
                    }
                    if (typeof data.lastError !== "undefined") {
                        record.lastError = data.lastError;
                    }
                    record.updatedAt = new Date();
                }

                return { count };
            }),
            update: jest.fn(async ({ where, data }) => {
                const record = state.integrations.find((integration) => integration.organizationId === where.organizationId);
                if (!record) {
                    throw new Error("EMAIL_INTEGRATION_NOT_FOUND");
                }
                if (typeof data.lastSyncAt !== "undefined") {
                    record.lastSyncAt = data.lastSyncAt;
                }
                if (typeof data.lastSyncStatus !== "undefined") {
                    record.lastSyncStatus = data.lastSyncStatus;
                }
                if (typeof data.lastSyncDurationMs !== "undefined") {
                    record.lastSyncDurationMs = data.lastSyncDurationMs;
                }
                if (typeof data.lastError !== "undefined") {
                    record.lastError = data.lastError;
                }
                record.updatedAt = new Date();
                return record;
            }),
        },
        emailThread: {
            findUnique: jest.fn(async ({ where }) => {
                const { organizationId, externalThreadId } = where.organizationId_externalThreadId;
                return state.threads.find((thread) => thread.organizationId === organizationId && thread.externalThreadId === externalThreadId) ?? null;
            }),
            create: jest.fn(async ({ data }) => {
                const next: ThreadSeed = {
                    id: `thread-${state.threads.length + 1}`,
                    organizationId: data.organizationId,
                    contactId: data.contactId,
                    dealId: data.dealId,
                    externalThreadId: data.externalThreadId,
                    subject: data.subject,
                    status: data.status,
                    lastMessageAt: data.lastMessageAt,
                    lastMessagePreview: data.lastMessagePreview,
                    unreadCount: data.unreadCount,
                };
                state.threads.push(next);
                return { id: next.id, contactId: next.contactId };
            }),
            update: jest.fn(async ({ where, data }) => {
                const record = state.threads.find((thread) => thread.id === where.id);
                if (!record) {
                    throw new Error("THREAD_NOT_FOUND");
                }
                if (typeof data.contactId !== "undefined") record.contactId = data.contactId;
                if (typeof data.dealId !== "undefined") record.dealId = data.dealId;
                if (typeof data.subject !== "undefined") record.subject = data.subject;
                if (typeof data.lastMessageAt !== "undefined") record.lastMessageAt = data.lastMessageAt;
                if (typeof data.lastMessagePreview !== "undefined") record.lastMessagePreview = data.lastMessagePreview;
                return { id: record.id, contactId: record.contactId };
            }),
        },
        emailMessage: {
            findUnique: jest.fn(async ({ where }) => {
                return state.messages.find((message) => message.externalMessageId === where.externalMessageId) ?? null;
            }),
            create: jest.fn(async ({ data }) => {
                const next: MessageSeed = {
                    id: `message-${state.messages.length + 1}`,
                    organizationId: data.organizationId,
                    threadId: data.threadId,
                    contactId: data.contactId,
                    externalMessageId: data.externalMessageId,
                    direction: data.direction,
                    fromAddress: data.fromAddress,
                    toAddress: data.toAddress,
                    subject: data.subject,
                    bodyText: data.bodyText,
                    bodyHtml: data.bodyHtml,
                    status: data.status,
                    sentAt: data.sentAt,
                    receivedAt: data.receivedAt,
                    createdAt: data.createdAt,
                };
                state.messages.push(next);
                return next;
            }),
            updateMany: jest.fn(async ({ where, data }) => {
                for (const message of state.messages) {
                    if (
                        message.organizationId === where.organizationId &&
                        message.threadId === where.threadId &&
                        message.contactId === null
                    ) {
                        message.contactId = data.contactId;
                    }
                }
                return { count: 1 };
            }),
        },
        contact: {
            findFirst: jest.fn(async ({ where }) => {
                const candidates = where.OR.map((item) => item.email.equals.toLowerCase());
                return state.contacts.find((contact) =>
                    contact.organizationId === where.organizationId &&
                    contact.email !== null &&
                    candidates.includes(contact.email.toLowerCase()),
                ) ?? null;
            }),
        },
        deal: {
            findFirst: jest.fn(async ({ where }) => {
                const excluded = new Set(where.status.notIn.map((status) => status.toLowerCase()));
                return state.deals
                    .filter((deal) => deal.organizationId === where.organizationId)
                    .filter((deal) => deal.contactId === where.contactId)
                    .filter((deal) => !excluded.has(deal.status.toLowerCase()))
                    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null;
            }),
        },
        organization: {
            findUnique: jest.fn(async ({ where }) => {
                if (where.id !== "org-1") {
                    return null;
                }

                return state.organization;
            }),
        },
        $transaction: async (callback) => callback(db),
    };

    return { db, state };
}

function createBaseState(seed?: {
    integration?: Partial<EmailIntegrationSeed>;
    contacts?: ContactSeed[];
    deals?: DealSeed[];
    threads?: ThreadSeed[];
    messages?: MessageSeed[];
    organization?: Partial<{ subscriptionStatus: string | null }>;
}): EmailSyncState {
    return {
        organization: {
            subscriptionStatus: seed?.organization?.subscriptionStatus ?? "trial",
        },
        integrations: [
            {
                id: "integration-1",
                organizationId: "org-1",
                provider: "google",
                status: "connected",
                ownerEmail: "owner@example.com",
                accessTokenEncrypted: "access-token",
                refreshTokenEncrypted: "refresh-token",
                expiryAt: null,
                lastSyncAt: null,
                lastSyncStatus: null,
                lastSyncDurationMs: null,
                lastError: null,
                updatedAt: new Date("2026-03-18T10:00:00.000Z"),
                ...seed?.integration,
            } as EmailIntegrationSeed,
        ],
        contacts: [...(seed?.contacts ?? [])],
        deals: [...(seed?.deals ?? [])],
        threads: [...(seed?.threads ?? [])],
        messages: [...(seed?.messages ?? [])],
    };
}

function createProviderClient(messages: Array<{
    threadExternalId: string;
    messageExternalId: string;
    subject: string | null;
    from: string;
    to: string;
    body: string;
    bodyHtml?: string | null;
    timestamp: Date;
}>): EmailSyncProviderClient {
    return {
        provider: "google",
        fetchMessages: jest.fn(async () => messages),
    };
}

describe("Email sync", () => {
    test("maps provider email data into normalized domain shape", () => {
        const mapped = mapProviderEmailToDomain({
            threadExternalId: "thread-1",
            messageExternalId: "message-1",
            subject: "  Subject  ",
            from: "Alice <ALICE@EXAMPLE.com>",
            to: "Bob <bob@example.com>, carol@example.com",
            body: "Hello\r\n\r\nWorld",
            bodyHtml: "<div onclick=\"alert(1)\"><script>alert(1)</script>Hi</div>",
            timestamp: new Date("2026-03-18T10:00:00.000Z"),
        });

        expect(mapped.from).toBe("alice@example.com");
        expect(mapped.to).toBe("bob@example.com, carol@example.com");
        expect(mapped.body).toBe("Hello\n\nWorld");
        expect(mapped.bodyHtml).toContain("Hi");
        expect(mapped.bodyHtml).not.toContain("script");
    });

    test("ingests a basic email and creates an orphan thread when no contact exists", async () => {
        const { db, state } = createMockEmailSyncDb();
        const providerClient = createProviderClient([
            {
                threadExternalId: "thread-1",
                messageExternalId: "message-1",
                subject: "Hello",
                from: "lead@example.com",
                to: "owner@example.com",
                body: "First message",
                timestamp: new Date("2026-03-18T10:00:00.000Z"),
            },
        ]);

        const result = await syncEmailIntegration({
            organizationId: "org-1",
            db,
            providerClient,
        });

        expect(result.skipped).toBe(false);
        expect(result.syncedThreads).toBe(1);
        expect(result.syncedMessages).toBe(1);
        expect(state.threads).toHaveLength(1);
        expect(state.messages).toHaveLength(1);
        expect(state.threads[0]?.contactId).toBeNull();
        expect(state.messages[0]?.contactId).toBeNull();
        expect(state.messages[0]?.direction).toBe("inbound");
        expect(state.integrations[0]?.lastSyncStatus).toBe("success");
        expect(state.integrations[0]?.lastSyncDurationMs).not.toBeNull();
        expect(result.lastSyncStatus).toBe("success");
        expect(result.lastSyncDurationMs).toBeGreaterThanOrEqual(0);
    });

    test("dedupes messages when the sync runs twice", async () => {
        const { db, state } = createMockEmailSyncDb();
        const providerClient = createProviderClient([
            {
                threadExternalId: "thread-1",
                messageExternalId: "message-1",
                subject: "Hello",
                from: "lead@example.com",
                to: "owner@example.com",
                body: "First message",
                timestamp: new Date("2026-03-18T10:00:00.000Z"),
            },
        ]);

        await syncEmailIntegration({
            organizationId: "org-1",
            db,
            providerClient,
        });

        await syncEmailIntegration({
            organizationId: "org-1",
            db,
            providerClient,
        });

        expect(state.messages).toHaveLength(1);
        expect(state.threads).toHaveLength(1);
    });

    test("keeps multiple messages in the same thread grouped together", async () => {
        const { db, state } = createMockEmailSyncDb();
        const providerClient = createProviderClient([
            {
                threadExternalId: "thread-1",
                messageExternalId: "message-1",
                subject: "Thread subject",
                from: "lead@example.com",
                to: "owner@example.com",
                body: "First message",
                timestamp: new Date("2026-03-18T10:00:00.000Z"),
            },
            {
                threadExternalId: "thread-1",
                messageExternalId: "message-2",
                subject: "Thread subject",
                from: "owner@example.com",
                to: "lead@example.com",
                body: "Second message",
                timestamp: new Date("2026-03-18T10:05:00.000Z"),
            },
        ]);

        const result = await syncEmailIntegration({
            organizationId: "org-1",
            db,
            providerClient,
        });

        expect(result.syncedThreads).toBe(1);
        expect(result.syncedMessages).toBe(2);
        expect(state.threads).toHaveLength(1);
        expect(state.messages).toHaveLength(2);
        expect(state.threads[0]?.lastMessageAt?.toISOString()).toBe("2026-03-18T10:05:00.000Z");
    });

    test("links email data to Contact and Deal when email addresses match", async () => {
        const { db, state } = createMockEmailSyncDb({
            contacts: [
                {
                    id: "contact-1",
                    organizationId: "org-1",
                    email: "lead@example.com",
                },
            ],
            deals: [
                {
                    id: "deal-1",
                    organizationId: "org-1",
                    contactId: "contact-1",
                    status: "open",
                    createdAt: new Date("2026-03-17T10:00:00.000Z"),
                },
            ],
        });
        const providerClient = createProviderClient([
            {
                threadExternalId: "thread-1",
                messageExternalId: "message-1",
                subject: "Hello",
                from: "lead@example.com",
                to: "owner@example.com",
                body: "Contact matched",
                timestamp: new Date("2026-03-18T10:00:00.000Z"),
            },
        ]);

        await syncEmailIntegration({
            organizationId: "org-1",
            db,
            providerClient,
        });

        expect(state.threads[0]?.contactId).toBe("contact-1");
        expect(state.threads[0]?.dealId).toBe("deal-1");
        expect(state.messages[0]?.contactId).toBe("contact-1");
    });

    test("respects tenant isolation when a matching email exists in another tenant", async () => {
        const { db, state } = createMockEmailSyncDb({
            contacts: [
                {
                    id: "contact-other",
                    organizationId: "org-2",
                    email: "lead@example.com",
                },
            ],
        });
        const providerClient = createProviderClient([
            {
                threadExternalId: "thread-1",
                messageExternalId: "message-1",
                subject: "Hello",
                from: "lead@example.com",
                to: "owner@example.com",
                body: "Cross-tenant guard",
                timestamp: new Date("2026-03-18T10:00:00.000Z"),
            },
        ]);

        await syncEmailIntegration({
            organizationId: "org-1",
            db,
            providerClient,
        });

        expect(state.threads[0]?.contactId).toBeNull();
        expect(state.messages[0]?.contactId).toBeNull();
    });
});
