import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { slug: string, id: string } }) {
    try {
        const org = await prisma.organization.findUnique({ where: { slug: params.slug } });
        if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

        const { status, policyJson, trigger, approvalMode, tags } = await req.json();

        const pb = await prisma.playbook.updateMany({
            where: { id: params.id, organizationId: org.id },
            data: {
                ...(status && { status }),
                ...(policyJson && { policyJson }),
                ...(trigger && { trigger }),
                ...(approvalMode && { approvalMode }),
                ...(tags && { tags }),
            },
        });

        if (pb.count === 0) return NextResponse.json({ error: "Playbook not found" }, { status: 404 });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
