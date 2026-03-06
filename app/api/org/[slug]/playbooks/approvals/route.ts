import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const org = await prisma.organization.findUnique({ where: { slug: (await params).slug } });
        if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

        const approvals = await prisma.playbookApproval.findMany({
            where: { organizationId: org.id, status: "pending" },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ approvals });
    } catch (error: any) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
