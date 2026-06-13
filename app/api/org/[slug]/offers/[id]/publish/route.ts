import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { orgContextErrorResponse, requireOrgContext } from "@/lib/auth/org-context";
import { hasRole } from "@/lib/auth/rbac";
import { publishOffer } from "@/lib/offers/publish";

async function POSTHandler(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string; id: string }> }
) {
    try {
        const { slug, id } = await params;
        const { orgId, role } = await requireOrgContext(slug);
        if (!hasRole(role, "admin")) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }

        const published = await publishOffer(id, orgId);
        return NextResponse.json(published);
    } catch (error) {
        if (error instanceof Error && ["UNAUTHENTICATED", "ORG_NOT_FOUND", "FORBIDDEN"].includes(error.message)) {
            return orgContextErrorResponse(error);
        }
        const detail = error instanceof Error ? error.message : "Publish failed";
        return NextResponse.json({ error: detail }, { status: 500 });
    }
}

export const POST = withApiLogging("/api/org/[slug]/offers/[id]/publish", "POST", POSTHandler);
