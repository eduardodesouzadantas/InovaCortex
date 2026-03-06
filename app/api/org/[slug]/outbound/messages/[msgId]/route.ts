/**
 * app/api/org/[slug]/outbound/messages/[msgId]/route.ts
 * V21: PATCH — Mark OutboundMessage as sent (manual confirmation).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";

interface Params { params: Promise<{ slug: string; msgId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
    const { slug, msgId } = await params;
    let ctx;
    try { ctx = await requireOrgContext(slug); }
    catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

    let body: { status: string };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { prisma } = await import("@/lib/prisma");
    await (prisma as any).outboundMessage.updateMany({
        where: { id: msgId, orgId: ctx.orgId },
        data: { status: body.status ?? "sent", sentAt: new Date() },
    });

    return NextResponse.json({ message: "Mensagem atualizada", status: body.status });
}
