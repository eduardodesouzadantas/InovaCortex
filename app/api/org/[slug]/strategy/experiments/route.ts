import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { orgContextErrorResponse, requireOrgContext } from "@/lib/auth/org-context";
import { hasRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

async function GETHandler(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const slug = (await params).slug;
        const { orgId } = await requireOrgContext(slug);

        const experiments = await prisma.experimentPlan.findMany({
            where: { organizationId: orgId },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(experiments);
    } catch (error) {
        return orgContextErrorResponse(error);
    }
}

async function POSTHandler(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const slug = (await params).slug;
        const { orgId, role } = await requireOrgContext(slug);
        if (!hasRole(role, "admin")) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }

        const body = await req.json() as {
            hypothesis: string;
            metricKey: string;
            planJson: unknown;
        };

        const experiment = await prisma.experimentPlan.create({
            data: {
                organizationId: orgId,
                hypothesis: body.hypothesis,
                metricKey: body.metricKey,
                planJson: JSON.stringify(body.planJson),
                status: "draft",
            },
        });

        return NextResponse.json(experiment);
    } catch (error) {
        return orgContextErrorResponse(error);
    }
}

export const GET = withApiLogging("/api/org/[slug]/strategy/experiments", "GET", GETHandler);
export const POST = withApiLogging("/api/org/[slug]/strategy/experiments", "POST", POSTHandler);
