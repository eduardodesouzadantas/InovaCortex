/**
 * app/api/org/[slug]/outbound/messages/[msgId]/route.ts
 * V21: PATCH — Mark OutboundMessage as sent (manual confirmation).
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

interface Params { params: { slug: string; msgId: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
    const session = await getServerSession(authOptions as any).catch(() => null);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: { status: string };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { prisma } = await import("@/lib/prisma");
    const org = await (prisma as any).organization.findUnique({
        where: { slug: params.slug }, select: { id: true },
    }).catch(() => null);
    if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

    await (prisma as any).outboundMessage.updateMany({
        where: { id: params.msgId, orgId: org.id },
        data: { status: body.status ?? "sent", sentAt: new Date() },
    });

    return NextResponse.json({ message: "Mensagem atualizada", status: body.status });
}
