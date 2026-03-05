
import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;

    try {
        const ctx = await requireOrgContext(slug);
        assertRole(ctx.role, "admin");

        const body = await req.json();
        const { name, email, phone, role } = body;

        if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

        const rep = await (prisma as any).salesRep.create({
            data: {
                organizationId: ctx.orgId,
                name,
                email,
                phone,
                role: role || "sales",
                active: true
            }
        });

        return NextResponse.json(rep);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 403 });
    }
}

export async function GET(
    req: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;

    try {
        const ctx = await requireOrgContext(slug);
        assertRole(ctx.role, "viewer");

        const reps = await (prisma as any).salesRep.findMany({
            where: { organizationId: ctx.orgId },
            orderBy: { name: "asc" }
        });

        return NextResponse.json(reps);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 403 });
    }
}
