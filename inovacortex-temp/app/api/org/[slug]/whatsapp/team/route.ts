import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";
import { calculateTeamPerformance } from "@/lib/whatsapp/engines/metrics-engine";

export async function GET(
    request: Request,
    { params }: { params: { slug: string } }
) {
    try {
        const { orgId } = await requireOrgContext(params.slug);

        const performance = await calculateTeamPerformance(orgId);

        return NextResponse.json({ team: performance }, { status: 200 });
    } catch (e: any) {
        if (e.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
