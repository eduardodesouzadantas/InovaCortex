import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import {
    resolveTenantRouteError,
    tenantErrorResponse,
    tenantNotFoundResponse,
} from "@/lib/auth/tenant-route";
import { buildPaginationMeta } from "@/lib/http/pagination";
import { listConversationMessages } from "@/lib/whatsapp/conversation-service";

async function GETHandler(
    request: Request,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    try {
        const { slug, id: conversationId } = await params;
        const { orgId, role, userId } = await requireOrgContext(slug);

        const result = await listConversationMessages({
            organizationId: orgId,
            role,
            userId,
            conversationId,
            searchParams: new URL(request.url).searchParams,
        });

        return NextResponse.json({
            messages: result.messages,
            pagination: buildPaginationMeta({ ...result.pagination, total: result.total }),
        }, { status: 200 });
    } catch (error) {
        if (error instanceof Error && error.message === "CONVERSATION_NOT_FOUND") {
            return tenantNotFoundResponse("Conversation not found");
        }
        if (error instanceof Error && error.message.startsWith("FORBIDDEN")) {
            return tenantErrorResponse("FORBIDDEN", { message: "Closer can only access assigned conversations" });
        }
        return resolveTenantRouteError(error, "Failed to load conversation messages");
    }
}

export const GET = withApiLogging("/api/org/[slug]/whatsapp/conversations/[id]/messages", "GET", GETHandler);
