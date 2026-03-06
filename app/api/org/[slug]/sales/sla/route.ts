import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { scanSLABreaches, groupBreachesByRep } from "@/lib/sales/sla-engine";

const getOrg = async (slug: string) =>
    prisma.organization.findUnique({ where: { slug }, select: { id: true } });

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const session = await getSession();
    if (!session || session.orgSlug !== (await params).slug) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const org = await getOrg((await params).slug);
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const hours = parseInt(searchParams.get("hours") || "48");

    const breaches = await scanSLABreaches(org.id, hours);
    const byRep = groupBreachesByRep(breaches);
    return NextResponse.json({ breaches, byRep, total: breaches.length });
}
