import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { getRepStats } from "@/lib/sales/stats-engine";
import { getRepAssignments } from "@/lib/sales/assignment-engine";

export async function GET(req: Request, { params }: { params: { slug: string, repId: string } }) {
    const session = await getSession();
    if (!session || session.orgSlug !== params.slug) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const month = new URL(req.url).searchParams.get("month") || new Date().toISOString().slice(0, 7);

    const [stats, assignments] = await Promise.all([
        getRepStats(params.repId, month),
        getRepAssignments(params.repId)
    ]);

    if (!stats) return NextResponse.json({ error: "Rep not found" }, { status: 404 });

    return NextResponse.json({ stats, assignments });
}
