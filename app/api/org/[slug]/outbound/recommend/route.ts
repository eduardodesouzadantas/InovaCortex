/**
 * app/api/org/[slug]/outbound/recommend/route.ts
 * V21: POST — Generate 25 stub prospects.
 * app/api/org/[slug]/outbound/sequences/route.ts
 * V21: POST — Start/resume outbound sequence.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import { recommendProspects } from "@/lib/outbound/outbound-engine";

interface Params { params: Promise<{ slug: string }> }

export async function POST(req: NextRequest, { params }: Params) {
    const { slug } = await params;
    let ctx;
    try { ctx = await requireOrgContext(slug); }
    catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

    const { prisma } = await import("@/lib/prisma");

    try {
        const result = await recommendProspects(ctx.orgId, 25);
        return NextResponse.json({ message: "Prospects gerados", ...result });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 });
    }
}
