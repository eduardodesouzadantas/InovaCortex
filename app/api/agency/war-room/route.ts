import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { writeAuditEvent } from "@/lib/audit";
import { apiError, apiSuccess, resolveRequestId } from "@/lib/http/api-response";
import { generateWarRoomSnapshot } from "@/lib/agency/war-room/war-room-engine";
import { handleApiError } from "@/lib/core/errors/global-error-handler";
import { logError, logInfo } from "@/lib/core/observability/logger";

export const runtime = "nodejs";

const REQUEST_TIMEOUT_MS = 10000;

type Level = "low" | "medium" | "high" | "critical";
type FocusAction = {
    source: "risk" | "opportunity" | "alert";
    title: string;
    owner: string;
    priority: Level;
    recommendation: string;
};

function levelScore(level: string): number {
    if (level === "critical") return 4;
    if (level === "high") return 3;
    if (level === "medium") return 2;
    return 1;
}

function normalizeLevel(level: string): Level {
    if (level === "critical" || level === "high" || level === "medium" || level === "low") {
        return level;
    }
    return "medium";
}

function buildFocusActions(snapshot: Awaited<ReturnType<typeof generateWarRoomSnapshot>>): FocusAction[] {
    const actions: FocusAction[] = [];

    for (const risk of snapshot.risks.slice(0, 3)) {
        actions.push({
            source: "risk",
            title: risk.title,
            owner: risk.slug,
            priority: normalizeLevel(risk.severity),
            recommendation: risk.recommendedAction,
        });
    }

    for (const opportunity of snapshot.opportunities.slice(0, 2)) {
        actions.push({
            source: "opportunity",
            title: opportunity.title,
            owner: opportunity.slug,
            priority: normalizeLevel(opportunity.priority),
            recommendation: opportunity.recommendedAction,
        });
    }

    if (actions.length < 5) {
        for (const alert of snapshot.alerts.slice(0, 3)) {
            actions.push({
                source: "alert",
                title: alert.title,
                owner: alert.source,
                priority: normalizeLevel(alert.severity),
                recommendation: "investigate_now",
            });
        }
    }

    actions.sort((a, b) => levelScore(b.priority) - levelScore(a.priority));
    return actions.slice(0, 5);
}

function buildExecutiveHeadline(snapshot: Awaited<ReturnType<typeof generateWarRoomSnapshot>>): string {
    if (snapshot.summary.systemHealth === "critical") {
        return "Operational risk is elevated. Prioritize immediate interventions.";
    }
    if (snapshot.summary.criticalAlerts > 0) {
        return "Core operation is stable, but there are critical alerts requiring executive action.";
    }
    if (snapshot.summary.highPriorityOpportunities > 0) {
        return "Operation is healthy with near-term growth opportunities ready for execution.";
    }
    return "Operation is stable and under control across core agency systems.";
}

async function withTimeout<T>(
    task: Promise<T>,
    timeoutMs: number,
    timeoutError: Error,
): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(timeoutError), timeoutMs);
    });

    try {
        return await Promise.race([task, timeoutPromise]);
    } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
    }
}

export async function GET(request: NextRequest) {
    const requestId = resolveRequestId(request);
    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) {
        return apiError(
            request,
            { code: "AUTH_ERROR", message: access.error ?? "Unauthorized" },
            { status: access.status, requestId },
        );
    }
    if (!access.auth?.organizationId || !access.auth.userId) {
        return apiError(request, { code: "FORBIDDEN", message: "Forbidden" }, { status: 403, requestId });
    }

    const actorUserId = access.auth.userId;
    const agencyOrganizationId = access.auth.organizationId;

    try {
        const snapshot = await withTimeout(
            generateWarRoomSnapshot({
                agencyOrganizationId,
                actorUserId,
                requestId,
            }),
            REQUEST_TIMEOUT_MS,
            new Error("WAR_ROOM_TIMEOUT"),
        );

        const actionsNow = buildFocusActions(snapshot);
        const payload = {
            ...snapshot,
            executiveBrief: {
                generatedAt: new Date().toISOString(),
                headline: buildExecutiveHeadline(snapshot),
                operationStatus: snapshot.summary.systemHealth,
                atRiskCount: snapshot.risks.length,
                opportunityCount: snapshot.opportunities.length,
                immediateActionCount: actionsNow.length,
            },
            focusNow: {
                atRisk: snapshot.risks.slice(0, 4),
                opportunities: snapshot.opportunities.slice(0, 4),
                immediateActions: actionsNow,
            },
        };

        await writeAuditEvent({
            organizationId: agencyOrganizationId,
            action: "agency_war_room_viewed",
            details: {
                actorUserId,
                requestId,
                riskCount: snapshot.risks.length,
                opportunityCount: snapshot.opportunities.length,
                alertCount: snapshot.alerts.length,
                tenantCount: snapshot.summary.activeTenants,
                timestamp: new Date().toISOString(),
            },
            strict: false,
            context: {
                actorUserId,
                requestId,
            },
        });

        logInfo("war_room_fetch_completed", {
            module: "war-room-api",
            route: "/api/agency/war-room",
            requestId,
            actorUserId,
            tenantCount: snapshot.summary.activeTenants,
            riskCount: snapshot.risks.length,
            opportunityCount: snapshot.opportunities.length,
            alertCount: snapshot.alerts.length,
            immediateActionCount: actionsNow.length,
            timestamp: new Date().toISOString(),
        });

        return apiSuccess(request, payload, { status: 200, requestId });
    } catch (error) {
        const timeout = error instanceof Error && error.message === "WAR_ROOM_TIMEOUT";
        const errorMessage = error instanceof Error ? error.message : String(error);
        const prismaCode =
            typeof error === "object" && error !== null && "code" in error
                ? String((error as { code?: unknown }).code ?? "")
                : "";
        const databaseUnavailable =
            prismaCode === "P2037"
            || /too many database connections opened|remaining connection slots/i.test(errorMessage);

        logError("war_room_fetch_failed", {
            module: "war-room-api",
            route: "/api/agency/war-room",
            requestId,
            actorUserId,
            timeout,
            databaseUnavailable,
            prismaCode: prismaCode || null,
            error: errorMessage,
            timestamp: new Date().toISOString(),
        });

        if (timeout) {
            return NextResponse.json(
                { ok: false, error: "war_room_timeout", requestId },
                { status: 504 },
            );
        }
        if (databaseUnavailable) {
            return NextResponse.json(
                { ok: false, error: "war_room_unavailable", reason: "database_connection_limit", requestId },
                { status: 503 },
            );
        }
        return handleApiError(request, error, {
            requestId,
            status: 500,
            fallbackCode: "INTERNAL_ERROR",
            fallbackMessage: "Internal Error",
            logContext: {
                route: "/api/agency/war-room",
                actorUserId,
            },
        });
    }
}
