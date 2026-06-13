import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getGoogleAuthUrl } from "@/lib/integrations/google-calendar";

async function GETHandler(req: Request) {
    const session = await getSession();
    if (!session || !can(session.role, "manageSettings")) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    // Encode orgId in state so callback can retrieve it
    const state = Buffer.from(JSON.stringify({ orgId: session.orgId, userId: session.userId })).toString("base64url");
    const url = getGoogleAuthUrl(state);

    return NextResponse.redirect(url);
}

export const GET = withApiLogging("/api/admin/integrations/google/start", "GET", GETHandler);
