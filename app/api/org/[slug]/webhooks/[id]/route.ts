import { NextResponse } from "next/server";

import { withApiLogging } from "@/lib/logger";
import { requireOrgContext } from "@/lib/auth/org-context";
import { getOrganizationAccountStatus, ORGANIZATION_BILLING_SUSPENDED_MESSAGE } from "@/lib/billing/account-status";
import {
    assertTenantRole,
    invalidTenantInputResponse,
    resolveTenantRouteError,
    tenantNotFoundResponse,
} from "@/lib/auth/tenant-route";
import {
    deleteWebhookEndpoint,
    parseWebhookSubscribedEvents,
    updateWebhookEndpoint,
} from "@/lib/public-api/webhooks";

async function PATCHHandler(
    request: Request,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    try {
        const { slug, id } = await params;
        const ctx = await requireOrgContext(slug);
        assertTenantRole(ctx.role, "admin");

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

        let subscribedEvents;
        if (typeof body.subscribedEvents !== "undefined") {
            try {
                subscribedEvents = parseWebhookSubscribedEvents(body.subscribedEvents);
            } catch (error) {
                return invalidTenantInputResponse(
                    error instanceof Error && error.message === "WEBHOOK_EVENTS_REQUIRED"
                        ? "Select at least one webhook event"
                        : "Invalid subscribed events",
                );
            }
        }

        const updated = await updateWebhookEndpoint({
            organizationId: ctx.orgId,
            endpointId: id,
            url: typeof body.url === "string" ? body.url : undefined,
            isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
            subscribedEvents,
            rotateSecret: body.rotateSecret === true,
        });

        return NextResponse.json({
            success: true,
            webhook: updated.webhook,
            ...(updated.secret ? { secret: updated.secret } : {}),
        }, { status: 200 });
    } catch (error) {
        if (error instanceof Error && error.message === "WEBHOOK_ENDPOINT_NOT_FOUND") {
            return tenantNotFoundResponse("Webhook endpoint not found");
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
        if (error instanceof Error && error.message === "WEBHOOK_NO_CHANGES") {
            return invalidTenantInputResponse("Provide at least one field to update");
        }
        return resolveTenantRouteError(error, "Failed to update webhook endpoint");
    }
}

async function DELETEHandler(
    _request: Request,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    try {
        const { slug, id } = await params;
        const ctx = await requireOrgContext(slug);
        assertTenantRole(ctx.role, "admin");

        await deleteWebhookEndpoint({
            organizationId: ctx.orgId,
            endpointId: id,
        });

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        if (error instanceof Error && error.message === "WEBHOOK_ENDPOINT_NOT_FOUND") {
            return tenantNotFoundResponse("Webhook endpoint not found");
        }
        return resolveTenantRouteError(error, "Failed to delete webhook endpoint");
    }
}

export const PATCH = withApiLogging("/api/org/[slug]/webhooks/[id]", "PATCH", PATCHHandler);
export const DELETE = withApiLogging("/api/org/[slug]/webhooks/[id]", "DELETE", DELETEHandler);
