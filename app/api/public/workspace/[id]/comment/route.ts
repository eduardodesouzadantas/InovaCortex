import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/public/workspace/[id]/comment
 * Client submits a short comment (optionally linked to a task).
 * Requires ?t=<workspacePublicToken>
 *
 * Body: { body: string, taskId?: string }
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: workspaceId } = await params;
    const token = request.nextUrl.searchParams.get("t");

    // ── Token validation ───────────────────────────────────────────────────────
    const workspace = await (prisma as any).clientWorkspace.findFirst({
        where: { id: workspaceId, workspacePublicToken: token },
        select: { id: true, organizationId: true },
    });
    if (!workspace) {
        return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
    }

    // ── Parse body ─────────────────────────────────────────────────────────────
    let body: { body?: string; taskId?: string } = {};
    try { body = await request.json(); } catch { }

    const text = body.body?.trim() ?? "";
    if (!text || text.length > 1000) {
        return NextResponse.json({ error: "Mensagem inválida (máx 1000 chars)." }, { status: 400 });
    }

    const taskId = body.taskId ?? null;
    // Validate task belongs to this workspace if provided
    if (taskId) {
        const task = await (prisma as any).implementationTask.findFirst({
            where: { id: taskId, workspaceId },
        });
        if (!task) {
            return NextResponse.json({ error: "Tarefa não encontrada neste workspace." }, { status: 404 });
        }
    }

    // ── Create comment ─────────────────────────────────────────────────────────
    const comment = await (prisma as any).workspaceComment.create({
        data: {
            orgId: workspace.organizationId,
            workspaceId,
            taskId,
            authorType: "client",
            body: text,
        },
    });

    await (prisma as any).auditEvent.create({
        data: {
            organizationId: workspace.organizationId,
            action: "clientCommentPosted",
            userId: "client:portal",
            resourceType: "workspace_comment",
            resourceId: comment.id,
            details: JSON.stringify({ workspaceId, taskId, bodyLength: text.length }),
            ipAddress: request.headers.get("x-forwarded-for") ?? "unknown",
        },
    }).catch(() => null);

    return NextResponse.json({ success: true, commentId: comment.id });
}
