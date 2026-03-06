import { processNewMeeting, MeetingPayload } from "./meeting-processor";
import { OrchestratorContext } from "@/lib/orchestrator/types";
import { prisma } from "@/lib/prisma";

export const MeetingIntelligenceService = {
    handleMeetingScheduled: async (payload: MeetingPayload, ctx: OrchestratorContext) => {
        return processNewMeeting(payload, ctx);
    },

    handleMeetingCanceled: async (payload: { externalEventId: string; organizationId: string }, ctx: OrchestratorContext) => {
        const session = await (prisma as any).meetingSession.findFirst({
            where: { externalEventId: payload.externalEventId, organizationId: payload.organizationId }
        });
        if (session) {
            await (prisma as any).meetingSession.update({
                where: { id: session.id },
                data: { status: "canceled" }
            });
            await (prisma as any).auditEvent.create({
                data: {
                    organizationId: payload.organizationId,
                    action: "meetingCanceled",
                    userId: ctx.userId || "system",
                    resourceType: "meeting_session",
                    resourceId: session.id,
                    ipAddress: "system"
                }
            });
        }
    },

    handleMeetingRescheduled: async (payload: MeetingPayload, ctx: OrchestratorContext) => {
        // Treat as a new session (old one was already canceled by the webhook route)
        const session = await processNewMeeting(payload, ctx);
        if (session) {
            await (prisma as any).auditEvent.create({
                data: {
                    organizationId: payload.organizationId,
                    action: "meetingRescheduled",
                    userId: ctx.userId || "system",
                    resourceType: "meeting_session",
                    resourceId: session.id,
                    ipAddress: "system"
                }
            });
        }
        return session;
    }
};

