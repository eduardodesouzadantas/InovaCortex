import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";
import { getLeaderboard } from "@/lib/sales/stats-engine";

const getOrg = async (slug: string) =>
    prisma.organization.findUnique({ where: { slug }, select: { id: true } });

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const session = await getSession();
    if (!session || session.orgSlug !== (await params).slug) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const org = await getOrg((await params).slug);
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);

    const leaderboard = await getLeaderboard(org.id, month);
    return NextResponse.json({ leaderboard, month });
}
