/**
 * app/api/org/[slug]/outbound/recommend/route.ts
 * V21: POST — Generate 25 stub prospects.
 * app/api/org/[slug]/outbound/sequences/route.ts
 * V21: POST — Start/resume outbound sequence.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { recommendProspects } from "@/lib/outbound/outbound-engine";

interface Params { params: { slug: string } }

export async function POST(req: NextRequest, { params }: Params) {
    const session = await getServerSession(authOptions as any).catch(() => null);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { prisma } = await import("@/lib/prisma");
    const org = await (prisma as any).organization.findUnique({
        where: { slug: params.slug }, select: { id: true },
    }).catch(() => null);
    if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

    try {
        const result = await recommendProspects(org.id, 25);
        return NextResponse.json({ message: "Prospects gerados", ...result });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 });
    }
}
