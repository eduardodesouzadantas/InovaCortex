const encoder = new TextEncoder();

export type RealtimeEventRecord = {
    id: string;
    organizationId: string;
    type: string;
    severity?: string | null;
    message?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    payloadJson?: string | null;
    createdAt: Date;
    dedupeKey?: string | null;
};

type BufferedEvent = {
    id: string;
    record: RealtimeEventRecord;
    frame: Uint8Array;
};

type Subscriber = {
    id: string;
    orgId: string;
    controller: ReadableStreamDefaultController<Uint8Array>;
    closed: boolean;
    connectedAt: number;
    lastDomainEventAt: number;
    heartbeatInterval?: ReturnType<typeof setInterval>;
    inactivityTimeout?: ReturnType<typeof setTimeout>;
};

const MAX_BUFFERED_EVENTS = 100;
const MAX_OPEN_CONNECTIONS = 100;
const MAX_OPEN_CONNECTIONS_PER_ORG = 10;
const HEARTBEAT_MS = 20_000;
const MAX_INACTIVE_MS = 60_000;

const subscribersByOrg = new Map<string, Map<string, Subscriber>>();
const bufferedEventsByOrg = new Map<string, BufferedEvent[]>();

function sseFrame(data: string, options?: { event?: string; id?: string }) {
    const lines: string[] = [];
    if (options?.id) lines.push(`id: ${options.id}`);
    if (options?.event) lines.push(`event: ${options.event}`);
    for (const line of data.split("\n")) {
        lines.push(`data: ${line}`);
    }
    lines.push("", "");
    return encoder.encode(lines.join("\n"));
}

function snapshotFrame(record: RealtimeEventRecord) {
    return sseFrame(JSON.stringify(record), { id: record.id });
}

function connectionCountForOrg(orgId: string): number {
    return subscribersByOrg.get(orgId)?.size ?? 0;
}

function totalConnectionCount(): number {
    let total = 0;
    for (const subscribers of subscribersByOrg.values()) {
        total += subscribers.size;
    }
    return total;
}

function ensureOrgSubscribers(orgId: string) {
    let subscribers = subscribersByOrg.get(orgId);
    if (!subscribers) {
        subscribers = new Map<string, Subscriber>();
        subscribersByOrg.set(orgId, subscribers);
    }
    return subscribers;
}

function closeSubscriber(subscriber: Subscriber) {
    if (subscriber.closed) return;
    subscriber.closed = true;
    if (subscriber.heartbeatInterval) clearInterval(subscriber.heartbeatInterval);
    if (subscriber.inactivityTimeout) clearTimeout(subscriber.inactivityTimeout);
    const subscribers = subscribersByOrg.get(subscriber.orgId);
    subscribers?.delete(subscriber.id);
    if (subscribers && subscribers.size === 0) {
        subscribersByOrg.delete(subscriber.orgId);
    }
    try {
        subscriber.controller.close();
    } catch {
        // Stream already closed by client/runtime.
    }
}

function resetInactivityTimeout(subscriber: Subscriber) {
    if (subscriber.inactivityTimeout) clearTimeout(subscriber.inactivityTimeout);
    subscriber.inactivityTimeout = setTimeout(() => {
        closeSubscriber(subscriber);
    }, MAX_INACTIVE_MS);
}

function sendFrame(subscriber: Subscriber, frame: Uint8Array, isDomainEvent = false) {
    if (subscriber.closed) return;
    try {
        subscriber.controller.enqueue(frame);
        if (isDomainEvent) {
            subscriber.lastDomainEventAt = Date.now();
        }
    } catch {
        closeSubscriber(subscriber);
        return;
    }
    resetInactivityTimeout(subscriber);
}

function replayBufferedEvents(subscriber: Subscriber, lastEventId: string | null) {
    const buffered = bufferedEventsByOrg.get(subscriber.orgId) ?? [];
    if (buffered.length === 0) return;

    const startIndex = lastEventId
        ? buffered.findIndex((event) => event.id === lastEventId)
        : -1;
    const replay = startIndex >= 0 ? buffered.slice(startIndex + 1) : [];

    for (const event of replay) {
        sendFrame(subscriber, event.frame, true);
    }
}

export function canOpenRealtimeConnection(orgId: string) {
    if (totalConnectionCount() >= MAX_OPEN_CONNECTIONS) {
        return { ok: false as const, reason: "global_limit" as const };
    }
    if (connectionCountForOrg(orgId) >= MAX_OPEN_CONNECTIONS_PER_ORG) {
        return { ok: false as const, reason: "org_limit" as const };
    }
    return { ok: true as const };
}

export function createRealtimeEventStream(orgId: string, signal: AbortSignal, lastEventId: string | null) {
    return new ReadableStream<Uint8Array>({
        start(controller) {
            const subscriber: Subscriber = {
                id: crypto.randomUUID(),
                orgId,
                controller,
                closed: false,
                connectedAt: Date.now(),
                lastDomainEventAt: Date.now(),
            };

            ensureOrgSubscribers(orgId).set(subscriber.id, subscriber);

            sendFrame(subscriber, sseFrame(JSON.stringify({ status: "ok" }), { event: "connected" }));
            replayBufferedEvents(subscriber, lastEventId);

            subscriber.heartbeatInterval = setInterval(() => {
                if (subscriber.closed) return;
                const idleFor = Date.now() - subscriber.lastDomainEventAt;
                if (idleFor >= MAX_INACTIVE_MS) {
                    closeSubscriber(subscriber);
                    return;
                }
                sendFrame(
                    subscriber,
                    sseFrame(JSON.stringify({ ts: new Date().toISOString() }), { event: "heartbeat" }),
                );
            }, HEARTBEAT_MS);

            resetInactivityTimeout(subscriber);
            signal.addEventListener("abort", () => closeSubscriber(subscriber), { once: true });
        },
        cancel() {
            const subscribers = subscribersByOrg.get(orgId);
            if (!subscribers) return;
            for (const subscriber of subscribers.values()) {
                if (!subscriber.closed) {
                    closeSubscriber(subscriber);
                }
            }
        },
    });
}

export function publishRealtimeEvent(record: RealtimeEventRecord) {
    const frame = snapshotFrame(record);
    const buffered = bufferedEventsByOrg.get(record.organizationId) ?? [];
    buffered.push({ id: record.id, record, frame });
    if (buffered.length > MAX_BUFFERED_EVENTS) {
        buffered.splice(0, buffered.length - MAX_BUFFERED_EVENTS);
    }
    bufferedEventsByOrg.set(record.organizationId, buffered);

    const subscribers = subscribersByOrg.get(record.organizationId);
    if (!subscribers) return;

    for (const subscriber of subscribers.values()) {
        sendFrame(subscriber, frame, true);
    }
}
