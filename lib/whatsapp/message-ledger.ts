import type {
    WhatsAppMessageFailureClass,
    WhatsAppMessageLifecycleStatus,
    WhatsAppRetryDecision,
} from "./pipeline-contract";

type JsonRecord = Record<string, unknown>;

export type WhatsAppMessageLedgerEventSource =
    | "outbound_send"
    | "provider_webhook"
    | "retry_scheduler"
    | "retry_worker"
    | "legacy_message_log";

export type WhatsAppMessageLedgerRetryOutcome =
    | "scheduled"
    | "duplicate_pending"
    | "sent"
    | "retryable_failure"
    | "terminal_failure"
    | "stale"
    | "skipped";

export interface WhatsAppMessageLedgerEvent {
    at: string;
    source: WhatsAppMessageLedgerEventSource;
    externalMessageId: string | null;
    lifecycleStatus: string;
    providerStatus: string | null;
    failureClass: WhatsAppMessageFailureClass | null;
    queueId: string | null;
    note: string | null;
}

export interface WhatsAppMessageLedgerRetryRecord {
    queueId: string;
    sourceExternalMessageId: string | null;
    targetExternalMessageId: string | null;
    scheduledAt: string;
    dueAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    outcome: WhatsAppMessageLedgerRetryOutcome;
    reason: string | null;
    attemptCount: number;
}

export interface WhatsAppMessageStatusLedger {
    version: 1;
    currentStatus: string | null;
    currentFailureClass: WhatsAppMessageFailureClass | null;
    currentExternalMessageId: string | null;
    lastEventAt: string | null;
    knownExternalMessageIds: string[];
    retry: {
        pendingQueueId: string | null;
        lastDecision: WhatsAppRetryDecision | null;
        totalScheduled: number;
        totalExecuted: number;
        totalSucceeded: number;
        totalFailed: number;
        jobs: WhatsAppMessageLedgerRetryRecord[];
    };
    events: WhatsAppMessageLedgerEvent[];
}

export interface WhatsAppMessageMetadataEnvelope {
    metadata: JsonRecord;
    ledger: WhatsAppMessageStatusLedger;
}

const MAX_LEDGER_EVENTS = 20;
const MAX_LEDGER_RETRY_JOBS = 10;

function isRecord(value: unknown): value is JsonRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((item) => normalizeString(item))
        .filter((item): item is string => item !== null);
}

function normalizeIsoDate(value: unknown): string | null {
    const raw = normalizeString(value);
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function cloneRecord(value: JsonRecord): JsonRecord {
    return JSON.parse(JSON.stringify(value)) as JsonRecord;
}

function defaultLedger(): WhatsAppMessageStatusLedger {
    return {
        version: 1,
        currentStatus: null,
        currentFailureClass: null,
        currentExternalMessageId: null,
        lastEventAt: null,
        knownExternalMessageIds: [],
        retry: {
            pendingQueueId: null,
            lastDecision: null,
            totalScheduled: 0,
            totalExecuted: 0,
            totalSucceeded: 0,
            totalFailed: 0,
            jobs: [],
        },
        events: [],
    };
}

function normalizeRetryDecision(value: unknown): WhatsAppRetryDecision | null {
    if (!isRecord(value)) {
        return null;
    }

    return {
        eligible: value.eligible === true,
        delaySeconds: typeof value.delaySeconds === "number" && Number.isFinite(value.delaySeconds) ? value.delaySeconds : null,
        reason: normalizeString(value.reason),
    };
}

function normalizeLedgerEvent(value: unknown): WhatsAppMessageLedgerEvent | null {
    if (!isRecord(value)) {
        return null;
    }

    const at = normalizeIsoDate(value.at);
    const source = normalizeString(value.source);
    const lifecycleStatus = normalizeString(value.lifecycleStatus);
    if (!at || !source || !lifecycleStatus) {
        return null;
    }

    return {
        at,
        source: source as WhatsAppMessageLedgerEventSource,
        externalMessageId: normalizeString(value.externalMessageId),
        lifecycleStatus,
        providerStatus: normalizeString(value.providerStatus),
        failureClass: normalizeString(value.failureClass) as WhatsAppMessageFailureClass | null,
        queueId: normalizeString(value.queueId),
        note: normalizeString(value.note),
    };
}

function normalizeRetryRecord(value: unknown): WhatsAppMessageLedgerRetryRecord | null {
    if (!isRecord(value)) {
        return null;
    }

    const queueId = normalizeString(value.queueId);
    const scheduledAt = normalizeIsoDate(value.scheduledAt);
    const outcome = normalizeString(value.outcome);
    if (!queueId || !scheduledAt || !outcome) {
        return null;
    }

    return {
        queueId,
        sourceExternalMessageId: normalizeString(value.sourceExternalMessageId),
        targetExternalMessageId: normalizeString(value.targetExternalMessageId),
        scheduledAt,
        dueAt: normalizeIsoDate(value.dueAt),
        startedAt: normalizeIsoDate(value.startedAt),
        completedAt: normalizeIsoDate(value.completedAt),
        outcome: outcome as WhatsAppMessageLedgerRetryOutcome,
        reason: normalizeString(value.reason),
        attemptCount: typeof value.attemptCount === "number" && Number.isFinite(value.attemptCount) ? Math.max(0, Math.floor(value.attemptCount)) : 0,
    };
}

function normalizeLedger(value: unknown): WhatsAppMessageStatusLedger {
    if (!isRecord(value)) {
        return defaultLedger();
    }

    const retry = isRecord(value.retry) ? value.retry : {};
    const jobs = Array.isArray(retry.jobs)
        ? retry.jobs
            .map((item) => normalizeRetryRecord(item))
            .filter((item): item is WhatsAppMessageLedgerRetryRecord => item !== null)
            .slice(-MAX_LEDGER_RETRY_JOBS)
        : [];

    const events = Array.isArray(value.events)
        ? value.events
            .map((item) => normalizeLedgerEvent(item))
            .filter((item): item is WhatsAppMessageLedgerEvent => item !== null)
            .slice(-MAX_LEDGER_EVENTS)
        : [];

    return {
        version: 1,
        currentStatus: normalizeString(value.currentStatus),
        currentFailureClass: normalizeString(value.currentFailureClass) as WhatsAppMessageFailureClass | null,
        currentExternalMessageId: normalizeString(value.currentExternalMessageId),
        lastEventAt: normalizeIsoDate(value.lastEventAt),
        knownExternalMessageIds: normalizeStringArray(value.knownExternalMessageIds),
        retry: {
            pendingQueueId: normalizeString(retry.pendingQueueId),
            lastDecision: normalizeRetryDecision(retry.lastDecision),
            totalScheduled: typeof retry.totalScheduled === "number" && Number.isFinite(retry.totalScheduled) ? Math.max(0, Math.floor(retry.totalScheduled)) : 0,
            totalExecuted: typeof retry.totalExecuted === "number" && Number.isFinite(retry.totalExecuted) ? Math.max(0, Math.floor(retry.totalExecuted)) : 0,
            totalSucceeded: typeof retry.totalSucceeded === "number" && Number.isFinite(retry.totalSucceeded) ? Math.max(0, Math.floor(retry.totalSucceeded)) : 0,
            totalFailed: typeof retry.totalFailed === "number" && Number.isFinite(retry.totalFailed) ? Math.max(0, Math.floor(retry.totalFailed)) : 0,
            jobs,
        },
        events,
    };
}

export function readMessageMetadataEnvelope(raw: string | null | undefined): WhatsAppMessageMetadataEnvelope {
    if (!raw) {
        return {
            metadata: {},
            ledger: defaultLedger(),
        };
    }

    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!isRecord(parsed)) {
            return {
                metadata: {},
                ledger: defaultLedger(),
            };
        }

        const metadata = cloneRecord(parsed);
        const ledger = normalizeLedger(metadata.statusLedger);
        delete metadata.statusLedger;

        return { metadata, ledger };
    } catch {
        return {
            metadata: {},
            ledger: defaultLedger(),
        };
    }
}

export function writeMessageMetadataEnvelope(envelope: WhatsAppMessageMetadataEnvelope): string {
    const payload: JsonRecord = {
        ...cloneRecord(envelope.metadata),
        statusLedger: envelope.ledger,
    };

    return JSON.stringify(payload);
}

export function updateMessageMetadataEnvelope(
    raw: string | null | undefined,
    updater: (envelope: WhatsAppMessageMetadataEnvelope) => WhatsAppMessageMetadataEnvelope,
): string {
    const current = readMessageMetadataEnvelope(raw);
    const next = updater({
        metadata: cloneRecord(current.metadata),
        ledger: JSON.parse(JSON.stringify(current.ledger)) as WhatsAppMessageStatusLedger,
    });

    return writeMessageMetadataEnvelope(next);
}

export function appendLedgerEvent(
    ledger: WhatsAppMessageStatusLedger,
    event: {
        at: Date;
        source: WhatsAppMessageLedgerEventSource;
        externalMessageId: string | null;
        lifecycleStatus: WhatsAppMessageLifecycleStatus | string;
        providerStatus?: string | null;
        failureClass?: WhatsAppMessageFailureClass | null;
        queueId?: string | null;
        note?: string | null;
    },
): WhatsAppMessageStatusLedger {
    const entry: WhatsAppMessageLedgerEvent = {
        at: event.at.toISOString(),
        source: event.source,
        externalMessageId: event.externalMessageId,
        lifecycleStatus: event.lifecycleStatus,
        providerStatus: event.providerStatus ?? null,
        failureClass: event.failureClass ?? null,
        queueId: event.queueId ?? null,
        note: event.note ?? null,
    };

    ledger.events = [...ledger.events, entry].slice(-MAX_LEDGER_EVENTS);
    ledger.lastEventAt = entry.at;
    if (event.externalMessageId && !ledger.knownExternalMessageIds.includes(event.externalMessageId)) {
        ledger.knownExternalMessageIds = [...ledger.knownExternalMessageIds, event.externalMessageId].slice(-MAX_LEDGER_EVENTS);
    }

    return ledger;
}

export function upsertRetryJobRecord(
    ledger: WhatsAppMessageStatusLedger,
    input: {
        queueId: string;
        sourceExternalMessageId: string | null;
        targetExternalMessageId?: string | null;
        scheduledAt: Date;
        dueAt?: Date | null;
        startedAt?: Date | null;
        completedAt?: Date | null;
        outcome: WhatsAppMessageLedgerRetryOutcome;
        reason?: string | null;
        attemptCount: number;
    },
): WhatsAppMessageStatusLedger {
    const nextRecord: WhatsAppMessageLedgerRetryRecord = {
        queueId: input.queueId,
        sourceExternalMessageId: input.sourceExternalMessageId,
        targetExternalMessageId: input.targetExternalMessageId ?? null,
        scheduledAt: input.scheduledAt.toISOString(),
        dueAt: input.dueAt ? input.dueAt.toISOString() : null,
        startedAt: input.startedAt ? input.startedAt.toISOString() : null,
        completedAt: input.completedAt ? input.completedAt.toISOString() : null,
        outcome: input.outcome,
        reason: input.reason ?? null,
        attemptCount: Math.max(0, Math.floor(input.attemptCount)),
    };

    const existingIndex = ledger.retry.jobs.findIndex((job) => job.queueId === input.queueId);
    if (existingIndex >= 0) {
        ledger.retry.jobs[existingIndex] = nextRecord;
    } else {
        ledger.retry.jobs = [...ledger.retry.jobs, nextRecord].slice(-MAX_LEDGER_RETRY_JOBS);
    }

    return ledger;
}

export function findRetryJobRecord(
    ledger: WhatsAppMessageStatusLedger,
    queueId: string,
): WhatsAppMessageLedgerRetryRecord | null {
    return ledger.retry.jobs.find((job) => job.queueId === queueId) ?? null;
}

export function hasKnownExternalMessageId(
    ledger: WhatsAppMessageStatusLedger,
    externalMessageId: string,
): boolean {
    return ledger.currentExternalMessageId === externalMessageId
        || ledger.knownExternalMessageIds.includes(externalMessageId);
}

export function setCurrentLedgerState(
    ledger: WhatsAppMessageStatusLedger,
    input: {
        lifecycleStatus: string;
        failureClass?: WhatsAppMessageFailureClass | null;
        externalMessageId?: string | null;
        eventAt: Date;
    },
): WhatsAppMessageStatusLedger {
    ledger.currentStatus = input.lifecycleStatus;
    ledger.currentFailureClass = input.failureClass ?? null;
    ledger.lastEventAt = input.eventAt.toISOString();

    if (input.externalMessageId) {
        ledger.currentExternalMessageId = input.externalMessageId;
        if (!ledger.knownExternalMessageIds.includes(input.externalMessageId)) {
            ledger.knownExternalMessageIds = [...ledger.knownExternalMessageIds, input.externalMessageId].slice(-MAX_LEDGER_EVENTS);
        }
    }

    return ledger;
}
