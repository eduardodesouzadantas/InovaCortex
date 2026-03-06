/**
 * POST /api/admin/orchestrator/brain-cycle
 * V17: Runs the full BrainCycle for the org:
 *  - recalibrates all session probabilities
 *  - updates expectedRevenue
 *  - re-prioritizes ActionQueue
 *  - escalates stale proposals
 *  - returns pipeline health
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { runBrainCycle } from "@/lib/services/revenue/brain-cycle";

export async function POST() {
    const session = await getSession();
    if (!session || !can(session.role, "manageSettings")) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const result = await runBrainCycle(session.orgId);
    return NextResponse.json({ ok: true, ...result });
}
