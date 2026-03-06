import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";
import { retrieve } from "@/lib/memory/retrieve";

/** POST /api/org/[slug]/memory/search */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
    const session = await getSession();
    if (!session || session.orgSlug !== (await params).slug) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (!hasRole(session.role, "admin")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const org = await prisma.organization.findUnique({ where: { slug: (await params).slug }, select: { id: true } });
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { query, topK = 8 } = await request.json();
    if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

    const results = await retrieve(org.id, query, topK);
    return NextResponse.json({ results });
}
