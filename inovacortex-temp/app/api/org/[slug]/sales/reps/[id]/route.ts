import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";

export async function PATCH(req: Request, { params }: { params: { slug: string, id: string } }) {
    const session = await getSession();
    if (!session || !hasRole(session.role, "admin")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const body = await req.json();
    const rep = await (prisma as any).salesRep.update({
        where: { id: params.id },
        data: {
            name: body.name,
            phone: body.phone,
            email: body.email,
            role: body.role,
            active: body.active
        }
    });

    return NextResponse.json({ rep });
}
