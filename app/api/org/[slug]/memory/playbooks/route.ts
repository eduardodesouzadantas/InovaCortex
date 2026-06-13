import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth/rbac";
import { orgContextErrorResponse, requireOrgContext } from "@/lib/auth/org-context";

/** GET /api/org/[slug]/memory/playbooks */
async function GETHandler(request: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const ctx = await requireOrgContext(slug).catch((error) => error);
    if (ctx instanceof Error) return orgContextErrorResponse(ctx);
    if (!hasRole(ctx.role, "admin")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const [playbooks, wonMeetings] = await Promise.all([
        (prisma as any).aIChatMemoryItem.findMany({
            where: {
                organizationId: ctx.orgId,
                type: { in: ["win_reason", "objection", "script", "playbook", "lesson"] }
            },
            orderBy: { createdAt: "desc" },
            take: 50
        }),
        (prisma as any).meetingPerformance.findMany({
            where: { organizationId: ctx.orgId, outcome: "won" },
            orderBy: { closedValue: "desc" },
            take: 5
        })
    ]);

    return NextResponse.json({ playbooks, wonMeetings });
}

export const GET = withApiLogging("/api/org/[slug]/memory/playbooks", "GET", GETHandler);
