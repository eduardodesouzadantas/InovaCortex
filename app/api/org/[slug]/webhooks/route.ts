import { NextResponse } from "next/server";

import { withApiLogging } from "@/lib/logger";
import { requireOrgContext } from "@/lib/auth/org-context";
import { getOrganizationAccountStatus, ORGANIZATION_BILLING_SUSPENDED_MESSAGE } from "@/lib/billing/account-status";
import {
    assertTenantRole,
    invalidTenantInputResponse,
    resolveTenantRouteError,
} from "@/lib/auth/tenant-route";
import {
    createWebhookEndpoint,
    listWebhookEndpoints,
    parseWebhookSubscribedEvents,
} from "@/lib/public-api/webhooks";

async function GETHandler(
    _request: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    try {
        const { slug } = await params;
        const ctx = await requireOrgContext(slug);
        assertTenantRole(ctx.role, "admin");

        const data = await listWebhookEndpoints(ctx.orgId);

        return NextResponse.json({
            success: true,
            webhooks: data.webhooks,
            supportedEvents: data.supportedEvents,
        }, { status: 200 });
    } catch (error) {
        return resolveTenantRouteError(error, "Failed to list webhook endpoints");
    }
}

async function POSTHandler(
    request: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    try {
        const { slug } = await params;
        const ctx = await requireOrgContext(slug);
        assertTenantRole(ctx.role, "admin");

        if ((await getOrganizationAccountStatus(ctx.orgId)) === "suspended") {
            return NextResponse.json({
                success: false,
                error: "FORBIDDEN",
                message: ORGANIZATION_BILLING_SUSPENDED_MESSAGE,
            }, { status: 403 });
        }

        const body = await request.json().catch(() => null) as Record<string, unknown> | null;
        if (!body) {
            return invalidTenantInputResponse("Invalid JSON");
        }

        if ((await getOrganizationAccountStatus(ctx.orgId)) === "suspended") {
            return NextResponse.json({
                success: false,
                error: "FORBIDDEN",
                message: ORGANIZATION_BILLING_SUSPENDED_MESSAGE,
            }, { status: 403 });
        }

        const url = typeof body.url === "string" ? body.url : "";
        const isActive = typeof body.isActive === "boolean" ? body.isActive : undefined;

        let subscribedEvents;
        try {
            subscribedEvents = parseWebhookSubscribedEvents(body.subscribedEvents);
        } catch (error) {
            return invalidTenantInputResponse(
                error instanceof Error && error.message === "WEBHOOK_EVENTS_REQUIRED"
                    ? "Select at least one webhook event"
                    : "Invalid subscribed events",
            );
        }

        const created = await createWebhookEndpoint({
            organizationId: ctx.orgId,
            url,
            isActive,
            subscribedEvents,
        });

        return NextResponse.json({
            success: true,
            webhook: created.webhook,
            secret: created.secret,
        }, { status: 201 });
    } catch (error) {
        if (error instanceof Error && error.message === "WEBHOOK_URL_REQUIRED") {
            return invalidTenantInputResponse("Webhook URL is required");
        }
        if (error instanceof Error && error.message === "WEBHOOK_URL_INVALID") {
            return invalidTenantInputResponse("Webhook URL is invalid");
        }
        if (error instanceof Error && error.message === "WEBHOOK_URL_INSECURE") {
            return invalidTenantInputResponse("Webhook URL must use HTTPS in production");
        }
        if (error instanceof Error && error.message === "WEBHOOK_EVENTS_REQUIRED") {
            return invalidTenantInputResponse("Select at least one webhook event");
        }
        return resolveTenantRouteError(error, "Failed to create webhook endpoint");
    }
}

export const GET = withApiLogging("/api/org/[slug]/webhooks", "GET", GETHandler);
export const POST = withApiLogging("/api/org/[slug]/webhooks", "POST", POSTHandler);
