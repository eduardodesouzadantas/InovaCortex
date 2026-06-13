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
    applyConversationAction,
    type ConversationAction,
} from "@/lib/whatsapp/conversation-service";

type ConversationPatchBody = {
    action?: ConversationAction;
};

function parseAction(value: unknown): ConversationAction | null {
    if (value === "close" || value === "reopen" || value === "block_contact") {
        return value;
    }
    return null;
}

async function PATCHHandler(
    request: Request,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    try {
        const { slug, id: conversationId } = await params;
        const { orgId, role, userId } = await requireOrgContext(slug);
        const body = await request.json().catch(() => null) as ConversationPatchBody | null;

        if (!body) {
            return invalidTenantInputResponse("Invalid JSON");
        }

        const action = parseAction(body.action);
        if (!action) {
            return invalidTenantInputResponse("Invalid action. Allowed: close, reopen, block_contact");
        }

        const result = await applyConversationAction({
            organizationId: orgId,
            role,
            userId,
            conversationId,
            action,
        });

        return NextResponse.json({ ok: true, ...result }, { status: 200 });
    } catch (error) {
        if (error instanceof Error && error.message === "CONVERSATION_NOT_FOUND") {
            return tenantNotFoundResponse("Conversation not found");
        }
        if (error instanceof Error && error.message === "CONTACT_OPTED_OUT") {
            return NextResponse.json({ error: "Blocked contacts cannot be reopened" }, { status: 409 });
        }
        if (error instanceof Error && error.message.startsWith("FORBIDDEN")) {
            const message = error.message.includes("viewer")
                ? "Viewer role cannot mutate conversations"
                : "Closer can only mutate assigned conversations";
            return tenantErrorResponse("FORBIDDEN", { message });
        }
        return resolveTenantRouteError(error, "Failed to update conversation");
    }
}

export const PATCH = withApiLogging("/api/org/[slug]/whatsapp/conversations/[id]", "PATCH", PATCHHandler);
