/**
 * lib/system-events.ts
 * V27: CEO Real-Time Command Center Event Logger
 * V34: Extended with WhatsApp event-driven notifications
 *
 * Logs critical platform events to the database to be streamed
 * asynchronously to the CEO Command Center via SSE.
 * Also dispatches WhatsApp push notifications for key events.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { publishRealtimeEvent } from '@/lib/realtime/event-stream';

export type SystemEventType =
    | 'lead_created'
    | 'assessment_completed'
    | 'meeting_scheduled'
    | 'meeting_missed'
    | 'proposal_sent'
    | 'proposal_viewed'
    | 'proposal_accepted'
    | 'contract_signed'
    | 'payment_received'
    | 'workspace_provisioned'
    | 'task_completed'
    | 'profit_leak_detected'
    | 'growth_signal_detected'
    | 'outbound_reply'
    | 'content_published'
    | 'agent_budget_alert'
    | 'rep_performance_alert'
    | 'sla_breach'
    | 'leak_owner_alert'
    | 'deal_stale_alert'
    | 'client_disabled';

// Events that trigger WhatsApp push notifications (subset)
const NOTIFIABLE_EVENTS = new Set<SystemEventType>([
    'proposal_viewed',
    'profit_leak_detected',
    'payment_received',
    'meeting_missed',
    'growth_signal_detected'
]);

export interface LogSystemEventParams {
    organizationId: string;
    type: SystemEventType;
    entityType: string;
    entityId: string;
    payload: Record<string, any>;
}

export interface CreateSystemEventParams {
    organizationId: string;
    type: string;
    severity?: string;
    message?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    payloadJson?: string;
    dedupeKey?: string | null;
}

export async function createSystemEvent(params: CreateSystemEventParams) {
    const event = await (prisma as any).systemEvent.create({
        data: {
            organizationId: params.organizationId,
            type: params.type,
            severity: params.severity ?? "info",
            message: params.message ?? null,
            entityType: params.entityType ?? null,
            entityId: params.entityId ?? null,
            payloadJson: params.payloadJson ?? "{}",
            dedupeKey: params.dedupeKey ?? null,
        },
    });

    publishRealtimeEvent({
        id: event.id,
        organizationId: event.organizationId,
        type: event.type,
        severity: event.severity,
        message: event.message,
        entityType: event.entityType,
        entityId: event.entityId,
        payloadJson: event.payloadJson,
        createdAt: event.createdAt,
        dedupeKey: event.dedupeKey ?? null,
    });

    return event;
}

export async function logSystemEvent(params: LogSystemEventParams) {
    try {
        const event = await createSystemEvent({
            organizationId: params.organizationId,
            type: params.type,
            entityType: params.entityType,
            entityId: params.entityId,
            payloadJson: JSON.stringify(params.payload),
        });

        logger.info(`[SYSTEM_EVENT] ${params.type}`, {
            orgId: params.organizationId,
            entity: params.entityType,
            id: params.entityId,
        });

        // Fire-and-forget WhatsApp notification for notifiable events
        if (NOTIFIABLE_EVENTS.has(params.type)) {
            import('@/lib/whatsapp/event-dispatcher')
                .then(({ dispatchEventNotification }) =>
                    dispatchEventNotification(params.type, params.organizationId, params.payload)
                )
                .catch(err => logger.error(`WhatsApp notify failed for ${params.type}: ${err.message}`));
        }

        return event;
    } catch (error: any) {
        logger.error(`Failed to log system event ${params.type}: ${error.message}`);
        // We do not throw to prevent breaking the parent workflow.
        return null;
    }
}
