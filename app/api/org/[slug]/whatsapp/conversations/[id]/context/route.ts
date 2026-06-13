import { NextResponse } from "next/server";

import { requireOrgContext } from "@/lib/auth/org-context";
import {
    resolveTenantRouteError,
    tenantErrorResponse,
    tenantNotFoundResponse,
} from "@/lib/auth/tenant-route";
import { withApiLogging } from "@/lib/logger";
import { getConversationCommercialContext } from "@/lib/whatsapp/conversation-service";

async function GETHandler(
    _request: Request,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    try {
        const { slug, id: conversationId } = await params;
        const { orgId, role, userId } = await requireOrgContext(slug);

        const context = await getConversationCommercialContext({
            organizationId: orgId,
            orgSlug: slug,
            role,
            userId,
            conversationId,
        });

        return NextResponse.json({
            success: true,
            data: context,
        });
    } catch (error) {
        if (error instanceof Error && error.message === "CONVERSATION_NOT_FOUND") {
            return tenantNotFoundResponse("Conversation not found");
        }
        if (error instanceof Error && error.message.startsWith("FORBIDDEN")) {
            return tenantErrorResponse("FORBIDDEN", { message: "Closer can only access assigned conversations" });
        }
        return resolveTenantRouteError(error, "Failed to load conversation commercial context");
    }
}

export const GET = withApiLogging("/api/org/[slug]/whatsapp/conversations/[id]/context", "GET", GETHandler);
