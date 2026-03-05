import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";

export async function GET(
    request: Request,
    { params }: { params: { slug: string } }
) {
    try {
        const { orgId } = await requireOrgContext(params.slug);

        const templates = await prisma.whatsAppTemplate.findMany({
            where: { organizationId: orgId },
            orderBy: { name: "asc" }
        });

        return NextResponse.json({ templates }, { status: 200 });
    } catch (e: any) {
        if (e.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
