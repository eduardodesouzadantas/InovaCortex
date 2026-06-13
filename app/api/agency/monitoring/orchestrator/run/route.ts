import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { runOrchestratorQueue } from "@/lib/agency/monitoring/orchestrator-handlers";

async function POSTHandler(request: NextRequest) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!access.auth?.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const result = await runOrchestratorQueue(access.auth.organizationId);
    return NextResponse.json(result);
}

export const POST = withApiLogging("/api/agency/monitoring/orchestrator/run", "POST", POSTHandler);
