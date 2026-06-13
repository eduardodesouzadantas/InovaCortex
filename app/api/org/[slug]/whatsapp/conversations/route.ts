import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { orgContextErrorResponse, requireOrgContextFromRequest } from "@/lib/auth/org-context";
import { buildPaginationMeta } from "@/lib/http/pagination";
import { profileRequest } from "@/lib/request-profiler";
import { listWhatsAppConversations } from "@/lib/whatsapp/conversation-service";

async function GETHandler(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    return profileRequest({ route: "/api/org/[slug]/whatsapp/conversations", method: "GET", targetMs: 500 }, async () => {
        try {
            const { slug } = await params;
            const { orgId, role, userId } = await requireOrgContextFromRequest(request, slug);
            const { searchParams } = new URL(request.url);

            const result = await listWhatsAppConversations({
                organizationId: orgId,
                role,
                userId,
                searchParams,
            });

            return NextResponse.json({
                conversations: result.conversations,
                pagination: buildPaginationMeta({ ...result.pagination, total: result.total }),
            }, { status: 200 });
        } catch (error: unknown) {
            if (error instanceof Error && ["UNAUTHENTICATED", "ORG_NOT_FOUND", "FORBIDDEN"].includes(error.message)) {
                return orgContextErrorResponse(error);
            }
            throw error;
        }
    });
}

export const GET = withApiLogging("/api/org/[slug]/whatsapp/conversations", "GET", GETHandler);
