import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";

/** GET /api/org/[slug]/memory/status */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
    const session = await getSession();
    if (!session || session.orgSlug !== (await params).slug) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (!hasRole(session.role, "admin")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const org = await prisma.organization.findUnique({ where: { slug: (await params).slug }, select: { id: true } });
    if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [docCount, chunkCount, indexedCount, lastChunk, memoryItems] = await Promise.all([
        (prisma as any).knowledgeDocument.count({ where: { organizationId: org.id } }),
        (prisma as any).knowledgeChunk.count({ where: { organizationId: org.id } }),
        (prisma as any).knowledgeChunk.count({ where: { organizationId: org.id, embedding: { not: null } } }),
        (prisma as any).knowledgeChunk.findFirst({
            where: { organizationId: org.id, embedding: { not: null } },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true }
        }),
        (prisma as any).aIChatMemoryItem.count({ where: { organizationId: org.id } })
    ]);

    return NextResponse.json({ docCount, chunkCount, indexedCount, lastIndexed: lastChunk?.createdAt || null, memoryItems });
}
