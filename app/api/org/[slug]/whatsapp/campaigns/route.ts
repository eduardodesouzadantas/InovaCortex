import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { orgId } = await requireOrgContext((await params).slug);

        const campaigns = await prisma.whatsAppCampaign.findMany({
            where: { organizationId: orgId },
            include: {
                template: {
                    select: { name: true }
                },
                _count: {
                    select: { sends: true }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json({ campaigns }, { status: 200 });
    } catch (e: any) {
        if (e.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { orgId } = await requireOrgContext((await params).slug);
        const { name, templateId, segmentQuery, throttlePolicy } = await request.json();

        const campaign = await prisma.whatsAppCampaign.create({
            data: {
                organizationId: orgId,
                name,
                templateId,
                segmentQuery: JSON.stringify(segmentQuery || {}),
                throttlePolicy: JSON.stringify(throttlePolicy || { msgsPerMinute: 10 }),
                status: "draft"
            }
        });

        return NextResponse.json({ campaign }, { status: 200 });
    } catch (e: any) {
        if (e.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
