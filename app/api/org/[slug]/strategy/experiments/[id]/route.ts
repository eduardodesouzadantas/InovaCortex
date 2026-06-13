import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { orgContextErrorResponse, requireOrgContext } from "@/lib/auth/org-context";
import { hasRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

async function PATCHHandler(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string; id: string }> }
) {
    try {
        const { slug, id } = await params;
        const { orgId, role } = await requireOrgContext(slug);
        if (!hasRole(role, "admin")) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }

        const { status } = await req.json() as { status?: string };
        const existing = await prisma.experimentPlan.findFirst({
            where: { id, organizationId: orgId },
            select: { id: true },
        });
        if (!existing) {
            return NextResponse.json({ error: "Experiment not found" }, { status: 404 });
        }

        const updated = await prisma.experimentPlan.update({
            where: { id: existing.id },
            data: { status },
        });
        return NextResponse.json(updated);
    } catch (error) {
        if (error instanceof Error && ["UNAUTHENTICATED", "ORG_NOT_FOUND", "FORBIDDEN"].includes(error.message)) {
            return orgContextErrorResponse(error);
        }
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
}

export const PATCH = withApiLogging("/api/org/[slug]/strategy/experiments/[id]", "PATCH", PATCHHandler);
