import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { MeetingIntelligenceService } from "@/lib/services/meeting-intelligence";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

async function POSTHandler(req: Request) {
    try {
        const session = await getSession();
        if (!session || !can(session.role, "manageSettings")) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();

        const ctx = {
            orgId: session.orgId,
            userId: session.userId,
            ...body.context
        };

        const result = await MeetingIntelligenceService.handleMeetingScheduled({
            email: body.email || "lead@example.com",
            organizationId: session.orgId,
            startAt: body.startAt || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now mockup
            endAt: body.endAt || new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
            timezone: "America/Sao_Paulo",
            meetingUrl: "https://zoom.us/j/mock123",
            externalEventId: `evt_${Date.now()}`
        }, ctx);

        return NextResponse.json({ success: true, session: result });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export const POST = withApiLogging("/api/admin/meetings/test", "POST", POSTHandler);
