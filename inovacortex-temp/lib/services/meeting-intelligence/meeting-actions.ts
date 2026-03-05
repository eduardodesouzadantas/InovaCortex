import { Orchestrator } from "@/lib/orchestrator/orchestrator";

/**
 * Enqueues lifecycle actions for a confirmed meeting using the Orchestrator Queue
 */
export async function enqueueMeetingLifecycle(orgId: string, meeting: any, ctx: any) {
    const startAt = new Date(meeting.startAt);

    // Lembrete - 24h
    const reminder24h = new Date(startAt.getTime() - 24 * 60 * 60 * 1000);
    if (reminder24h > new Date()) {
        await Orchestrator.enqueue({
            type: "send_whatsapp",
            priority: "medium",
            relatedEntityType: "meeting",
            relatedEntityId: meeting.id,
            payloadJson: {
                templateKey: "meeting_reminder_24h",
                meetingId: meeting.id,
                scheduledFor: reminder24h.toISOString()
            },
            approvalRequired: false // internal reminders can be auto
        }, { ...ctx, orgId });
    }

    // Lembrete - 1h
    const reminder1h = new Date(startAt.getTime() - 1 * 60 * 60 * 1000);
    if (reminder1h > new Date()) {
        await Orchestrator.enqueue({
            type: "send_whatsapp",
            priority: "high",
            relatedEntityType: "meeting",
            relatedEntityId: meeting.id,
            payloadJson: {
                templateKey: "meeting_reminder_1h",
                meetingId: meeting.id,
                scheduledFor: reminder1h.toISOString()
            },
            approvalRequired: false
        }, { ...ctx, orgId });
    }

    // Briefing for closer - 10m before
    const briefing10m = new Date(startAt.getTime() - 10 * 60 * 1000);
    if (briefing10m > new Date()) {
        await Orchestrator.enqueue({
            type: "generate_presales",
            priority: "critical",
            relatedEntityType: "meeting",
            relatedEntityId: meeting.id,
            payloadJson: {
                instruction: "Gerar Meeting Briefing para Closer",
                meetingId: meeting.id,
                scheduledFor: briefing10m.toISOString()
            },
            approvalRequired: false
        }, { ...ctx, orgId });
    }

    // Follow-up 2h after
    const followup2h = new Date(startAt.getTime() + 2 * 60 * 60 * 1000);
    if (followup2h > new Date()) {
        await Orchestrator.enqueue({
            type: "send_whatsapp",
            priority: "medium",
            relatedEntityType: "meeting",
            relatedEntityId: meeting.id,
            payloadJson: {
                templateKey: "meeting_followup_2h",
                meetingId: meeting.id,
                scheduledFor: followup2h.toISOString()
            },
            approvalRequired: true // external followup needs review
        }, { ...ctx, orgId });
    }

    // Follow-up 48h after (if no action)
    const followup48h = new Date(startAt.getTime() + 48 * 60 * 60 * 1000);
    if (followup48h > new Date()) {
        await Orchestrator.enqueue({
            type: "send_whatsapp",
            priority: "low",
            relatedEntityType: "meeting",
            relatedEntityId: meeting.id,
            payloadJson: {
                templateKey: "meeting_followup_48h",
                meetingId: meeting.id,
                scheduledFor: followup48h.toISOString()
            },
            approvalRequired: true
        }, { ...ctx, orgId });
    }
}
