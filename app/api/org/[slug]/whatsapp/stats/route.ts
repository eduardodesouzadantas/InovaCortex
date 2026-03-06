import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";
import { calculateInboxStats } from "@/lib/whatsapp/engines/metrics-engine";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { orgId } = await requireOrgContext((await params).slug);
        const stats = await calculateInboxStats(orgId);
        return NextResponse.json(stats, { status: 200 });
    } catch (e: any) {
        if (e.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        console.error("GET /stats Error:", e);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
