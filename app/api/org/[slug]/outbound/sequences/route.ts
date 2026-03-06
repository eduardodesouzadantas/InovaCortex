/**
 * app/api/org/[slug]/outbound/sequences/route.ts
 * V21: POST — Start outbound sequence for a prospect.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import { startOutboundSequence } from "@/lib/outbound/outbound-engine";

interface Params { params: Promise<{ slug: string }> }

export async function POST(req: NextRequest, { params }: Params) {
    const { slug } = await params;
    let ctx;
    try { ctx = await requireOrgContext(slug); }
    catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

    let body: { prospectId: string };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    if (!body.prospectId) return NextResponse.json({ error: "prospectId required" }, { status: 400 });

    const { prisma } = await import("@/lib/prisma");

    try {
        const result = await startOutboundSequence(ctx.orgId, body.prospectId);
        return NextResponse.json({ message: "Sequência iniciada", ...result });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 });
    }
}
