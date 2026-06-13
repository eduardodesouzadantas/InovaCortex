import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth/rbac";
import { orgContextErrorResponse, requireOrgContext } from "@/lib/auth/org-context";

/** GET /api/org/[slug]/memory/status */
async function GETHandler(request: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const ctx = await requireOrgContext(slug).catch((error) => error);
    if (ctx instanceof Error) return orgContextErrorResponse(ctx);
    if (!hasRole(ctx.role, "admin")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const [docCount, chunkCount, indexedCount, lastChunk, memoryItems] = await Promise.all([
        (prisma as any).knowledgeDocument.count({ where: { organizationId: ctx.orgId } }),
        (prisma as any).knowledgeChunk.count({ where: { organizationId: ctx.orgId } }),
        (prisma as any).knowledgeChunk.count({ where: { organizationId: ctx.orgId, embedding: { not: null } } }),
        (prisma as any).knowledgeChunk.findFirst({
            where: { organizationId: ctx.orgId, embedding: { not: null } },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true }
        }),
        (prisma as any).aIChatMemoryItem.count({ where: { organizationId: ctx.orgId } })
    ]);

    return NextResponse.json({ docCount, chunkCount, indexedCount, lastIndexed: lastChunk?.createdAt || null, memoryItems });
}

export const GET = withApiLogging("/api/org/[slug]/memory/status", "GET", GETHandler);
