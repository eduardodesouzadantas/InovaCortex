import { prisma } from "@/lib/prisma";
import { calculateMeetingScore } from "./meeting-score";
import { enqueueMeetingLifecycle } from "./meeting-actions";
import { createOrUpdateEventWithMeet } from "@/lib/integrations/google-calendar";
import { OrchestratorContext } from "@/lib/orchestrator/types";
import crypto from "crypto";

export interface MeetingPayload {
    email: string;
    organizationId: string;
    startAt: string;
    endAt: string;
    timezone: string;
    meetingUrl?: string;
    externalEventId?: string;
}

export async function processNewMeeting(payload: MeetingPayload, ctx: OrchestratorContext) {
    const { email, organizationId, startAt, endAt, timezone, meetingUrl, externalEventId } = payload;

    // 1. Identify Lead and most recent Assessment
    const assessment = await (prisma as any).assessment.findFirst({
        where: { organizationId, leadEmail: email },
        orderBy: { createdAt: "desc" }
    });

    let roi = null;
    if (assessment) {
        roi = await (prisma as any).rOIEstimate.findUnique({
            where: { assessmentId: assessment.id }
        });
    }

    // 2. Score the Meeting
    const scoreData = calculateMeetingScore(assessment || {}, roi || {});

    // 3. Persist MeetingSession
    const session = await (prisma as any).meetingSession.create({
        data: {
            organizationId,
            assessmentId: assessment?.id,
            leadEmail: email,
            startAt: new Date(startAt),
            endAt: new Date(endAt),
            timezone,
            status: "scheduled",
            revenueScore: scoreData.potentialRevenue,
            closeProbability: scoreData.closeProbability,
            priorityTier: scoreData.priorityTier,
            meetingUrl,
            externalEventId
        }
    });

    // 4. Audit: session created
    await (prisma as any).auditEvent.create({
        data: {
            organizationId,
            action: "meetingScheduled",
            userId: ctx.userId || "system",
            resourceType: "meeting_session",
            resourceId: session.id,
            details: `Lead: ${email} | Tier: ${scoreData.priorityTier}`,
            ipAddress: "system"
        }
    });

    // 5. Google Calendar integration (if connected)
    const calendarIntegration = await (prisma as any).calendarIntegration.findUnique({
        where: { organizationId }
    });

    if (calendarIntegration?.status === "connected") {
        // Deterministic requestId: sha1(orgId:externalEventId)
        const requestId = crypto.createHash("sha1")
            .update(`${organizationId}:${externalEventId ?? session.id}`)
            .digest("hex");

        const calResult = await createOrUpdateEventWithMeet(organizationId, {
            calendarId: calendarIntegration.calendarId || "primary",
            summary: `Reunião com ${email} — InovaCortex`,
            description: [
                `Lead: ${email}`,
                `Tier: ${scoreData.priorityTier}`,
                `Prob. de fechamento: ${Math.round(scoreData.closeProbability * 100)}%`,
                `Receita potencial: R$${scoreData.potentialRevenue.toFixed(2)}`
            ].join("\n"),
            startAt,
            endAt,
            timezone,
            attendees: [email],
            requestId,
        });

        if (calResult) {
            await (prisma as any).meetingSession.update({
                where: { id: session.id },
                data: {
                    meetingUrl: calResult.meetingUrl,
                    googleEventId: calResult.googleEventId,
                }
            });
            await (prisma as any).auditEvent.create({
                data: {
                    organizationId,
                    action: "calendarEventCreated",
                    userId: ctx.userId || "system",
                    resourceType: "meeting_session",
                    resourceId: session.id,
                    details: `Google Event: ${calResult.googleEventId} | Meet: ${calResult.meetingUrl}`,
                    ipAddress: "system"
                }
            });
            // Patch returned object so callers get the fresh URLs
            session.meetingUrl = calResult.meetingUrl;
            session.googleEventId = calResult.googleEventId;
        }
    } else {
        await (prisma as any).auditEvent.create({
            data: {
                organizationId,
                action: "calendarNotConnected",
                userId: ctx.userId || "system",
                resourceType: "meeting_session",
                resourceId: session.id,
                details: "Google Calendar not connected — skipping event creation.",
                ipAddress: "system"
            }
        });
    }

    // 6. Enqueue Lifecycle Actions
    await enqueueMeetingLifecycle(organizationId, session, ctx);

    await (prisma as any).auditEvent.create({
        data: {
            organizationId,
            action: "meetingLifecycleEnqueued",
            userId: ctx.userId || "system",
            resourceType: "meeting_session",
            resourceId: session.id,
            ipAddress: "system"
        }
    });

    return session;
}
