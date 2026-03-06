import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertRole } from "@/lib/auth/rbac";
import { setSystemSetting } from "@/lib/cockpit";

export const runtime = "nodejs";

/**
 * POST /api/admin/cockpit/toggle
 * Toggle an AI system on or off.
 * Body: { key: string, enabled: boolean }
 * RBAC: owner | admin only
 */
export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try { assertRole(session.role, "admin"); }
    catch { return NextResponse.json({ error: "Forbidden — admin required" }, { status: 403 }); }

    const { key, enabled } = await request.json();

    const ALLOWED_KEYS = [
        "ai.content_engine",
        "ai.presales",
        "ai.funnel_engine",
        "ai.authority",
    ];

    if (!ALLOWED_KEYS.includes(key)) {
        return NextResponse.json({ error: `Invalid key: ${key}` }, { status: 400 });
    }

    await setSystemSetting(session.orgId, key, !!enabled, session.userId);

    return NextResponse.json({ success: true, key, enabled });
}
