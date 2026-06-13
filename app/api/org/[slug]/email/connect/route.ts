import { NextRequest, NextResponse } from "next/server";
import { withApiLogging } from "@/lib/logger";
import { assertTenantRole, resolveTenantRouteError } from "@/lib/auth/tenant-route";
import { isApiRouteError } from "@/lib/http/route-errors";
import { orgContextErrorResponse, requireOrgContextFromRequest } from "@/lib/auth/org-context";
import { getOrganizationAccountStatus, ORGANIZATION_BILLING_SUSPENDED_MESSAGE } from "@/lib/billing/account-status";
import {
    buildEmailOAuthStartUrl,
    createEmailOAuthState,
    isEmailOAuthProviderConfigured,
    parseEmailOAuthConnectInput,
} from "@/lib/integrations/email-oauth";

export const runtime = "nodejs";

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

        const body = await request.json().catch(() => ({}));
        const { provider } = parseEmailOAuthConnectInput(body);

        if (!isEmailOAuthProviderConfigured(provider)) {
            return NextResponse.json(
                {
                    success: false,
                    error: "EMAIL_OAUTH_NOT_CONFIGURED",
                    code: "FAILED_DEPENDENCY",
                    details: { provider },
                },
                { status: 424 },
            );
        }

        const state = createEmailOAuthState({
            organizationId: ctx.orgId,
            organizationSlug: slug,
            userId: ctx.userId,
            provider,
        });

        const authorizationUrl = buildEmailOAuthStartUrl({
            provider,
            state,
            orgSlug: slug,
        });

        return NextResponse.json({
            success: true,
            data: {
                authorizationUrl,
                provider,
            },
        });
    } catch (error) {
        if (isApiRouteError(error)) {
            throw error;
        }
        return resolveTenantRouteError(error, "Failed to start email OAuth connection");
    }
}

export const POST = withApiLogging("/api/org/[slug]/email/connect", "POST", POSTHandler);
