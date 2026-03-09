import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";

function authErrorResponse(e: unknown) {
    const message = e instanceof Error ? e.message : "";
    if (message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "ORG_NOT_FOUND") return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    if (typeof message === "string" && message.startsWith("FORBIDDEN")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
    try {
        const p = await params;
        const { orgId, role } = await requireOrgContext(p.slug);
        assertRole(role, "admin");

        const repId = p.id;
        const repInOrg = await (prisma as any).salesRep.findFirst({
            where: { id: repId, organizationId: orgId },
            select: { id: true }
        });
        if (!repInOrg) return NextResponse.json({ error: "Rep not found" }, { status: 404 });

        const body = await req.json();
        const rep = await (prisma as any).salesRep.update({
            where: { id: repId },
            data: {
                name: body.name,
                phone: body.phone,
                email: body.email,
                role: body.role,
                active: body.active
            }
        });

        return NextResponse.json({ rep });
    } catch (e: unknown) {
        return authErrorResponse(e) ?? NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
