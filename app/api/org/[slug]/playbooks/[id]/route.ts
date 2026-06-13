import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { orgContextErrorResponse, requireOrgContext } from "@/lib/auth/org-context";
import { hasRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

async function PATCHHandler(req: NextRequest, { params }: { params: Promise<{ slug: string, id: string }> }) {
    try {
        const { slug, id } = await params;
        const { orgId, role } = await requireOrgContext(slug);
        if (!hasRole(role, "admin")) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }

        const { status, policyJson, trigger, approvalMode, tags } = await req.json();

        const pb = await prisma.playbook.updateMany({
            where: { id, organizationId: orgId },
            data: {
                ...(status && { status }),
                ...(policyJson && { policyJson }),
                ...(trigger && { trigger }),
                ...(approvalMode && { approvalMode }),
                ...(tags && { tags }),
            },
        });

        if (pb.count === 0) return NextResponse.json({ error: "Playbook not found" }, { status: 404 });

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof Error && ["UNAUTHENTICATED", "ORG_NOT_FOUND", "FORBIDDEN"].includes(error.message)) {
            return orgContextErrorResponse(error);
        }
        return NextResponse.json({ error: "Failed to update playbook" }, { status: 500 });
    }
}

export const PATCH = withApiLogging("/api/org/[slug]/playbooks/[id]", "PATCH", PATCHHandler);
