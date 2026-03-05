/**
 * app/api/org/[slug]/outbound/sequences/route.ts
 * V21: POST — Start outbound sequence for a prospect.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { startOutboundSequence } from "@/lib/outbound/outbound-engine";

interface Params { params: { slug: string } }

export async function POST(req: NextRequest, { params }: Params) {
    const session = await getServerSession(authOptions as any).catch(() => null);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: { prospectId: string };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    if (!body.prospectId) return NextResponse.json({ error: "prospectId required" }, { status: 400 });

    const { prisma } = await import("@/lib/prisma");
    const org = await (prisma as any).organization.findUnique({
        where: { slug: params.slug }, select: { id: true },
    }).catch(() => null);
    if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

    try {
        const result = await startOutboundSequence(org.id, body.prospectId);
        return NextResponse.json({ message: "Sequência iniciada", ...result });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 });
    }
}
