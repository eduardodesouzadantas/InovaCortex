import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { orgContextErrorResponse, requireOrgContext } from "@/lib/auth/org-context";
import { prisma } from "@/lib/prisma";

async function GETHandler(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params;
        const { orgId } = await requireOrgContext(slug);

        const approvals = await prisma.playbookApproval.findMany({
            where: { organizationId: orgId, status: "pending" },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ approvals });
    } catch (error) {
        if (error instanceof Error && ["UNAUTHENTICATED", "ORG_NOT_FOUND", "FORBIDDEN"].includes(error.message)) {
            return orgContextErrorResponse(error);
        }
        return NextResponse.json({ error: "Failed to fetch approvals" }, { status: 500 });
    }
}

export const GET = withApiLogging("/api/org/[slug]/playbooks/approvals", "GET", GETHandler);
