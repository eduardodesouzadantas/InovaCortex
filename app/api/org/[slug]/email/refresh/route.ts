import { NextRequest, NextResponse } from "next/server";
import { logger, withApiLogging } from "@/lib/logger";
import { isApiRouteError } from "@/lib/http/route-errors";
import { orgContextErrorResponse, requireOrgContextFromRequest } from "@/lib/auth/org-context";
import { getOrganizationAccountStatus, ORGANIZATION_BILLING_SUSPENDED_MESSAGE } from "@/lib/billing/account-status";
import { assertTenantRole, resolveTenantRouteError } from "@/lib/auth/tenant-route";
import { getEmailIntegrationView } from "@/lib/integrations/email-oauth";
import { syncEmailIntegration } from "@/lib/integrations/email/sync-service";

export const runtime = "nodejs";

function buildSkippedRefreshResponse(
    reason: string,
    integration: Awaited<ReturnType<typeof getEmailIntegrationView>>,
): NextResponse {
    const status = reason === "provider_not_configured" ? 424 : 409;

    return NextResponse.json(
        {
            success: false,
            error: reason === "sync_in_progress" ? "EMAIL_SYNC_IN_PROGRESS" : "EMAIL_SYNC_REFRESH_SKIPPED",
            message:
                reason === "sync_in_progress"
                    ? "A sincronização já está em andamento."
                    : "A sincronização não pôde ser executada neste momento.",
            data: {
                integration,
                reason,
            },
        },
        { status },
    );
}

async function POSTHandler(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    try {
        const { slug } = await params;
        const ctx = await requireOrgContextFromRequest(request, slug).catch((error) => error);
        if (ctx instanceof Error) {
            return orgContextErrorResponse(ctx);
        }

        assertTenantRole(ctx.role, "admin");

        if ((await getOrganizationAccountStatus(ctx.orgId)) === "suspended") {
            return NextResponse.json({
                success: false,
                error: "FORBIDDEN",
                message: ORGANIZATION_BILLING_SUSPENDED_MESSAGE,
            }, { status: 403 });
        }

        const integrationBefore = await getEmailIntegrationView(ctx.orgId);
        if (!integrationBefore || integrationBefore.status !== "connected") {
            return NextResponse.json(
                {
                    success: false,
                    error: "EMAIL_INTEGRATION_NOT_CONNECTED",
                    message: "Conecte um email antes de solicitar um refresh manual.",
                },
                { status: 409 },
            );
        }

        if (integrationBefore.provider !== "google") {
            return NextResponse.json(
                {
                    success: false,
                    error: "EMAIL_PROVIDER_NOT_SUPPORTED",
                    message: "Refresh manual disponível apenas para Google nesta fase.",
                },
                { status: 424 },
            );
        }

        let result;
        try {
            result = await syncEmailIntegration({
                organizationId: ctx.orgId,
            });
        } catch (syncError) {
            const message = syncError instanceof Error ? syncError.message : String(syncError);
            logger.warn("[Email Sync Manual] Refresh failed", {
                orgId: ctx.orgId,
                provider: integrationBefore.provider,
                error: message,
            });

            return NextResponse.json(
                {
                    success: false,
                    error: "EMAIL_SYNC_REFRESH_FAILED",
                    message: "Não foi possível atualizar o inbox agora.",
                },
                { status: 502 },
            );
        }

        const integrationAfter = await getEmailIntegrationView(ctx.orgId);

        if (result.skipped) {
            logger.info("[Email Sync Manual] Refresh skipped", {
                orgId: ctx.orgId,
                provider: integrationBefore.provider,
                reason: result.reason,
            });

            return buildSkippedRefreshResponse(result.reason ?? "unknown", integrationAfter ?? integrationBefore);
        }

        logger.info("[Email Sync Manual] Refresh completed", {
            orgId: ctx.orgId,
            provider: result.provider,
            syncedThreads: result.syncedThreads,
            syncedMessages: result.syncedMessages,
            matchedContacts: result.matchedContacts,
            linkedDeals: result.linkedDeals,
            durationMs: result.lastSyncDurationMs,
        });

        return NextResponse.json({
            success: true,
            data: {
                result,
                integration: integrationAfter,
            },
        });
    } catch (error) {
        if (isApiRouteError(error)) {
            throw error;
        }
        return resolveTenantRouteError(error, "Failed to refresh email integration");
    }
}

export const POST = withApiLogging("/api/org/[slug]/email/refresh", "POST", POSTHandler);
