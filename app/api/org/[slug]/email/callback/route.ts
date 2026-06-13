import { NextRequest, NextResponse } from "next/server";
import { logger, withApiLogging } from "@/lib/logger";
import { getOrganizationAccountStatus } from "@/lib/billing/account-status";
import {
    exchangeEmailOAuthCode,
    parseEmailOAuthState,
    saveEmailOAuthIntegration,
} from "@/lib/integrations/email-oauth";
import { syncEmailIntegration } from "@/lib/integrations/email/sync-service";

export const runtime = "nodejs";

function redirectToEmailPage(requestUrl: string, slug: string, searchParams: Record<string, string>): NextResponse {
    const url = new URL(`/org/${slug}/admin/email`, requestUrl);
    for (const [key, value] of Object.entries(searchParams)) {
        url.searchParams.set(key, value);
    }
    return NextResponse.redirect(url);
}

async function GETHandler(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
        return redirectToEmailPage(request.url, slug, {
            error: `oauth_${error}`,
        });
    }

    if (!code || !state) {
        return redirectToEmailPage(request.url, slug, {
            error: "missing_oauth_data",
        });
    }

    try {
        const oauthState = parseEmailOAuthState(state);

        if (oauthState.organizationSlug !== slug) {
            return redirectToEmailPage(request.url, slug, {
                error: "tenant_mismatch",
            });
        }

        if ((await getOrganizationAccountStatus(oauthState.organizationId)) === "suspended") {
            return redirectToEmailPage(request.url, slug, {
                error: "account_suspended",
            });
        }

        const exchangeResult = await exchangeEmailOAuthCode({
            provider: oauthState.provider,
            code,
            orgSlug: slug,
        });

        const integration = await saveEmailOAuthIntegration(oauthState.organizationId, exchangeResult);

        try {
            await syncEmailIntegration({
                organizationId: oauthState.organizationId,
            });
        } catch (syncError) {
            logger.warn("[Email OAuth] Initial sync failed after connect", {
                orgId: oauthState.organizationId,
                provider: integration.provider,
                error: syncError instanceof Error ? syncError.message : String(syncError),
            });
        }

        return redirectToEmailPage(request.url, slug, {
            connected: "1",
            provider: integration.provider,
            email: integration.ownerEmail,
        });
    } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : "oauth_failed";
        return redirectToEmailPage(request.url, slug, {
            error: message.toLowerCase().replace(/\s+/g, "_"),
        });
    }
}

export const GET = withApiLogging("/api/org/[slug]/email/callback", "GET", GETHandler);
