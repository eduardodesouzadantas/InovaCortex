
import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ slug: string, id: string }> }
) {
    const { slug, id } = await params;

    try {
        const ctx = await requireOrgContext(slug);
        assertRole(ctx.role, "admin");

        const body = await req.json();
        const { name, email, phone, role, active } = body;

        const updated = await (prisma as any).salesRep.update({
            where: { id, organizationId: ctx.orgId },
            data: {
                ...(name && { name }),
                ...(email && { email }),
                ...(phone && { phone }),
                ...(role && { role }),
                ...(typeof active === "boolean" && { active })
            }
        });

        return NextResponse.json(updated);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 403 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ slug: string, id: string }> }
) {
    const { slug, id } = await params;

    try {
        const ctx = await requireOrgContext(slug);
        assertRole(ctx.role, "owner");

        await (prisma as any).salesRep.delete({
            where: { id, organizationId: ctx.orgId }
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 403 });
    }
}
