import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { loadAgencyPlaybookExecutions, storeAgencyPlaybookExecutions, type AgencySuccessPlaybookStatus, type AgencySuccessPlaybookExecution } from "@/lib/agency/surface-overview";
import { writeAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";

function mapActionToStatus(action: string): AgencySuccessPlaybookStatus | null {
    switch (action) {
        case "suggested":
            return "suggested";
        case "start":
        case "in-progress":
            return "in-progress";
        case "blocked":
            return "blocked";
        case "completed":
        case "complete":
            return "completed";
        default:
            return null;
    }
}

interface PlaybookStatusInput {
    playbookId: string;
    action: string;
    owner?: string;
    observedImpact?: string | null;
}

async function processPlaybookStatusUpdate(
    orgId: string,
    actorUserId: string | null,
    input: PlaybookStatusInput,
): Promise<{ success: true; data: AgencySuccessPlaybookExecution }> {
    const status = mapActionToStatus(input.action);
    if (!status) {
        throw new Error("INVALID_ACTION");
    }

    if (!input.playbookId || !input.playbookId.trim()) {
        throw new Error("MISSING_PLAYBOOK_ID");
    }

    const owner = input.owner?.trim() || actorUserId || "agency";
    const executions = await loadAgencyPlaybookExecutions(orgId);
    const existing = executions[input.playbookId];
    const now = new Date().toISOString();

    const nextState: AgencySuccessPlaybookExecution = {
        status,
        owner,
        createdAt: existing?.createdAt ?? now,
        startedAt: existing?.startedAt ?? (status === "in-progress" ? now : undefined),
        completedAt: existing?.completedAt ?? (status === "completed" ? now : undefined),
        observedImpact: input.observedImpact ?? existing?.observedImpact ?? null,
    };

    if (status === "blocked") {
        nextState.startedAt = existing?.startedAt ?? now;
    }

    if (status === "completed") {
        nextState.startedAt = existing?.startedAt ?? now;
    }

    if (status === "suggested") {
        nextState.startedAt = undefined;
        nextState.completedAt = undefined;
    }

    executions[input.playbookId] = nextState;
    await storeAgencyPlaybookExecutions(orgId, executions);

    await writeAuditEvent({
        organizationId: orgId,
        action: "agencyPlaybook:statusChanged",
        details: {
            playbookId: input.playbookId,
            action: status,
            previousStatus: existing?.status ?? "suggested",
            nextStatus: status,
            owner,
            observedImpact: nextState.observedImpact,
            actorUserId,
            timestamp: now,
        },
        strict: false,
        context: {
            orgId,
            playbookId: input.playbookId,
            actorUserId: actorUserId ?? "unknown",
        },
    });

    return { success: true, data: nextState };
}

export async function GET(request: NextRequest) {
    const access = await requireAdminApiAccess(request, { requiredRole: "admin", allowLegacyTokenFallback: true });
    if (!access.ok) {
        return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const url = new URL(request.url);
    const playbookId = url.searchParams.get("playbookId");
    const action = url.searchParams.get("action") ?? "start";
    const owner = url.searchParams.get("owner") ?? access.auth?.userId ?? undefined;
    const observedImpact = url.searchParams.get("observedImpact") ?? undefined;

    try {
        const result = await processPlaybookStatusUpdate(access.auth?.organizationId ?? "", access.auth?.userId ?? null, {
            playbookId: playbookId ?? "",
            action,
            owner,
            observedImpact,
        });

        return NextResponse.json(result);
    } catch (error: any) {
        if (error.message === "INVALID_ACTION" || error.message === "MISSING_PLAYBOOK_ID") {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
        return NextResponse.json({ success: false, error: "UNKNOWN_ERROR" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const access = await requireAdminApiAccess(request, { requiredRole: "admin", allowLegacyTokenFallback: true });
    if (!access.ok) {
        return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    let body: PlaybookStatusInput;
    try {
        body = await request.json();
    } catch (error) {
        return NextResponse.json({ success: false, error: "INVALID_JSON" }, { status: 400 });
    }

    try {
        const result = await processPlaybookStatusUpdate(access.auth?.organizationId ?? "", access.auth?.userId ?? null, {
            playbookId: body.playbookId ?? "",
            action: body.action ?? "",
            owner: body.owner,
            observedImpact: body.observedImpact,
        });

        return NextResponse.json(result);
    } catch (error: any) {
        if (error.message === "INVALID_ACTION" || error.message === "MISSING_PLAYBOOK_ID") {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
        return NextResponse.json({ success: false, error: "UNKNOWN_ERROR" }, { status: 500 });
    }
}
