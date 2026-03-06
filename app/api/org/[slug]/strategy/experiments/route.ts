import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const slug = (await params).slug;

    const org = await prisma.organization.findUnique({
        where: { slug },
        select: { id: true }
    });

    if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

    const experiments = await prisma.experimentPlan.findMany({
        where: { organizationId: org.id },
        orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(experiments);
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const slug = (await params).slug;
    const body = await req.json();

    const org = await prisma.organization.findUnique({
        where: { slug },
        select: { id: true }
    });

    if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

    const experiment = await prisma.experimentPlan.create({
        data: {
            organizationId: org.id,
            hypothesis: body.hypothesis,
            metricKey: body.metricKey,
            planJson: JSON.stringify(body.planJson),
            status: "draft"
        }
    });

    return NextResponse.json(experiment);
}
