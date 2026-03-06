import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { getRepStats } from "@/lib/sales/stats-engine";
import { getRepAssignments } from "@/lib/sales/assignment-engine";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string, repId: string }> }) {
    const session = await getSession();
    if (!session || session.orgSlug !== (await params).slug) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const month = new URL(req.url).searchParams.get("month") || new Date().toISOString().slice(0, 7);

    const [stats, assignments] = await Promise.all([
        getRepStats((await params).repId, month),
        getRepAssignments((await params).repId)
    ]);

    if (!stats) return NextResponse.json({ error: "Rep not found" }, { status: 404 });

    return NextResponse.json({ stats, assignments });
}
