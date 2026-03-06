import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";
import { getLiveKPIs } from "@/lib/kpi-engine";

export const dynamic = "force-dynamic";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;

    const org = await prisma.organization.findUnique({
        where: { slug },
    });

    if (!org) {
        return NextResponse.json({ error: "Org not found" }, { status: 404 });
    }

    let auth;
    try {
        auth = await requireOrgContext(slug);
    } catch (e) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const kpis = await getLiveKPIs(org.id);
        return NextResponse.json(kpis);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
