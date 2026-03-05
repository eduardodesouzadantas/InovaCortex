import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";

const getOrg = async (slug: string) =>
    prisma.organization.findUnique({ where: { slug }, select: { id: true } });

// GET — list reps
export async function GET(req: Request, { params }: { params: { slug: string } }) {
    const session = await getSession();
    if (!session || session.orgSlug !== params.slug) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const org = await getOrg(params.slug);
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const reps = await (prisma as any).salesRep.findMany({
        where: { organizationId: org.id },
        include: {
            _count: { select: { assignments: { where: { status: "active" } } } },
            targets: { where: { month: new Date().toISOString().slice(0, 7) }, take: 1 }
        },
        orderBy: [{ role: "asc" }, { name: "asc" }]
    });
    return NextResponse.json({ reps });
}

// POST — create rep
export async function POST(req: Request, { params }: { params: { slug: string } }) {
    const session = await getSession();
    if (!session || !hasRole(session.role, "admin")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const org = await getOrg(params.slug);
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const rep = await (prisma as any).salesRep.create({
        data: { organizationId: org.id, name: body.name, phone: body.phone, email: body.email, role: body.role || "SDR" }
    });
    return NextResponse.json({ rep }, { status: 201 });
}
