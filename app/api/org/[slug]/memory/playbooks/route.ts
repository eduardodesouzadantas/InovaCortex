import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";

/** GET /api/org/[slug]/memory/playbooks */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
    const session = await getSession();
    if (!session || session.orgSlug !== (await params).slug) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (!hasRole(session.role, "admin")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const org = await prisma.organization.findUnique({ where: { slug: (await params).slug }, select: { id: true } });
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [playbooks, wonMeetings] = await Promise.all([
        (prisma as any).aIChatMemoryItem.findMany({
            where: {
                organizationId: org.id,
                type: { in: ["win_reason", "objection", "script", "playbook", "lesson"] }
            },
            orderBy: { createdAt: "desc" },
            take: 50
        }),
        (prisma as any).meetingPerformance.findMany({
            where: { organizationId: org.id, outcome: "won" },
            orderBy: { closedValue: "desc" },
            take: 5
        })
    ]);

    return NextResponse.json({ playbooks, wonMeetings });
}
