
import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const window = searchParams.get("window") || "30d";

    try {
        const ctx = await requireOrgContext(slug);
        assertRole(ctx.role, "admin");

        const snapshots = await (prisma as any).performanceSnapshot.findMany({
            where: { organizationId: ctx.orgId, window },
            orderBy: { createdAt: "desc" },
            take: 14
        });

        return NextResponse.json(snapshots);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: err.message === "FORBIDDEN" ? 403 : 401 });
    }
}
