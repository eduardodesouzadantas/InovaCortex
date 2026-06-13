import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { createOrUpdateEventWithMeet } from "@/lib/integrations/google-calendar";
import crypto from "crypto";

async function POSTHandler() {
    const session = await getSession();
    if (!session || !can(session.role, "manageSettings")) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const now = new Date();
    const end = new Date(now.getTime() + 30 * 60000);

    const result = await createOrUpdateEventWithMeet(session.orgId, {
        calendarId: "primary",
        summary: "InovaCortex — Teste de Integração Google Calendar",
        description: "Este evento foi criado automaticamente para testar a integração com o Google Calendar e Google Meet.",
        startAt: now.toISOString(),
        endAt: end.toISOString(),
        timezone: "America/Sao_Paulo",
        attendees: [],
        requestId: crypto.createHash("sha1").update(`test-${session.orgId}-${Date.now()}`).digest("hex"),
    });

    if (!result) {
        return NextResponse.json({ success: false, error: "Falha ao criar evento. Verifique os logs de integração." }, { status: 500 });
    }

    return NextResponse.json({ success: true, meetingUrl: result.meetingUrl, googleEventId: result.googleEventId });
}

export const POST = withApiLogging("/api/admin/integrations/google/test", "POST", POSTHandler);
