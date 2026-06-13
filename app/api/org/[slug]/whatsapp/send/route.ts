import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import {
    invalidTenantInputResponse,
    resolveTenantRouteError,
    tenantErrorResponse,
    tenantNotFoundResponse,
} from "@/lib/auth/tenant-route";
import {
    parseOutboundSendBody,
    sendOutboundWhatsAppMessage,
} from "@/lib/whatsapp/outbound-service";

async function POSTHandler(
    request: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    try {
        const { orgId, role, userId } = await requireOrgContext((await params).slug);
        const body = await request.json().catch(() => null);
        const parsed = parseOutboundSendBody(body);

        if ("code" in parsed) {
            return invalidTenantInputResponse(parsed.message, parsed.details);
        }

        const result = await sendOutboundWhatsAppMessage({
            organizationId: orgId,
            role,
            userId,
            request: parsed,
        });

        if (!result.ok) {
            if (result.code === "CONVERSATION_NOT_FOUND") {
                return tenantNotFoundResponse(result.message);
            }
            if (result.code === "FORBIDDEN") {
                return tenantErrorResponse("FORBIDDEN", { message: result.message });
            }
            return NextResponse.json({
                success: false,
                error: result.code,
                message: result.message,
                details: result.details,
            }, { status: result.status });
        }

        return NextResponse.json({
            success: true,
            message: result.result.message,
            deal: result.result.deal,
            sideEffects: result.result.sideEffects,
        }, { status: 200 });
    } catch (error) {
        return resolveTenantRouteError(error, "Failed to send WhatsApp message");
    }
}

export const POST = withApiLogging("/api/org/[slug]/whatsapp/send", "POST", POSTHandler);
