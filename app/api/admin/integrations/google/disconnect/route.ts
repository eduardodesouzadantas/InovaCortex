import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { disconnectGoogleCalendar } from "@/lib/integrations/google-calendar";

async function POSTHandler() {
    const session = await getSession();
    if (!session || !can(session.role, "manageSettings")) {
        return new NextResponse("Unauthorized", { status: 401 });
    }
    await disconnectGoogleCalendar(session.orgId);
    return NextResponse.json({ success: true });
}

export const POST = withApiLogging("/api/admin/integrations/google/disconnect", "POST", POSTHandler);
