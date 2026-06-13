import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { orgContextErrorResponse, requireOrgContext } from "@/lib/auth/org-context";
import { prisma } from "@/lib/prisma";

async function GETHandler(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params;
        const { orgId } = await requireOrgContext(slug);

        const playbooks = await prisma.playbook.findMany({
            where: { organizationId: orgId },
            include: {
                runs: {
                    orderBy: { createdAt: "desc" },
                    take: 5,
                },
            },
        });

        return NextResponse.json({ playbooks });
    } catch (error) {
        if (error instanceof Error && ["UNAUTHENTICATED", "ORG_NOT_FOUND", "FORBIDDEN"].includes(error.message)) {
            return orgContextErrorResponse(error);
        }
        return NextResponse.json({ error: "Failed to fetch playbooks" }, { status: 500 });
    }
}

export const GET = withApiLogging("/api/org/[slug]/playbooks", "GET", GETHandler);
