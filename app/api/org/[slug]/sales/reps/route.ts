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

// GET - list reps
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const p = await params;
        const { orgId } = await requireOrgContext(p.slug);
        const reps = await (prisma as any).salesRep.findMany({
            where: { organizationId: orgId },
            include: {
                _count: { select: { assignments: { where: { status: "active" } } } },
                targets: { where: { month: new Date().toISOString().slice(0, 7) }, take: 1 }
            },
            orderBy: [{ role: "asc" }, { name: "asc" }]
        });
        return NextResponse.json({ reps });
    } catch (e: unknown) {
        return authErrorResponse(e) ?? NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

// POST - create rep
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const p = await params;
        const { orgId, role } = await requireOrgContext(p.slug);
        assertRole(role, "admin");

        const body = await req.json();
        const rep = await (prisma as any).salesRep.create({
            data: {
                organizationId: orgId,
                name: body.name,
                phone: body.phone,
                email: body.email,
                role: body.role || "SDR"
            }
        });
        return NextResponse.json({ rep }, { status: 201 });
    } catch (e: unknown) {
        return authErrorResponse(e) ?? NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
