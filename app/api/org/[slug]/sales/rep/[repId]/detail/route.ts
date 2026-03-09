import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";
import { getRepStats } from "@/lib/sales/stats-engine";
import { getRepAssignments } from "@/lib/sales/assignment-engine";

function authErrorResponse(e: unknown) {
    const message = e instanceof Error ? e.message : "";
    if (message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "ORG_NOT_FOUND") return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    if (typeof message === "string" && message.startsWith("FORBIDDEN")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string; repId: string }> }) {
    try {
        const p = await params;
        const { orgId } = await requireOrgContext(p.slug);

        const rep = await (prisma as any).salesRep.findFirst({
            where: { id: p.repId, organizationId: orgId },
            select: { id: true }
        });
        if (!rep) return NextResponse.json({ error: "Rep not found" }, { status: 404 });

        const month = new URL(req.url).searchParams.get("month") || new Date().toISOString().slice(0, 7);
        const [stats, assignments] = await Promise.all([
            getRepStats(p.repId, month),
            getRepAssignments(p.repId)
        ]);

        if (!stats) return NextResponse.json({ error: "Rep not found" }, { status: 404 });
        return NextResponse.json({ stats, assignments });
    } catch (e: unknown) {
        return authErrorResponse(e) ?? NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
