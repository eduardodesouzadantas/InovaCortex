import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { assignLead, autoAssign } from "@/lib/sales/assignment-engine";

const getOrg = async (slug: string) =>
    prisma.organization.findUnique({ where: { slug }, select: { id: true } });

export async function POST(req: Request, { params }: { params: { slug: string } }) {
    const session = await getSession();
    if (!session || session.orgSlug !== params.slug) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const org = await getOrg(params.slug);
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { assessmentId, salesRepId, auto, classification } = await req.json();

    if (auto && classification) {
        const result = await autoAssign({ assessmentId, orgId: org.id, classification });
        return NextResponse.json({ assignment: result, mode: "auto" });
    }

    if (!assessmentId || !salesRepId) {
        return NextResponse.json({ error: "assessmentId and salesRepId required" }, { status: 400 });
    }

    const assignment = await assignLead({ assessmentId, salesRepId, assignedByUserId: session.userId });
    return NextResponse.json({ assignment, mode: "manual" }, { status: 201 });
}
