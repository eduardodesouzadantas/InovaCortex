import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const org = await prisma.organization.findUnique({ where: { slug: (await params).slug } });
        if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

        const playbooks = await prisma.playbook.findMany({
            where: { organizationId: org.id },
            include: {
                runs: {
                    orderBy: { createdAt: "desc" },
                    take: 5,
                },
            },
        });

        return NextResponse.json({ playbooks });
    } catch (error: any) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
