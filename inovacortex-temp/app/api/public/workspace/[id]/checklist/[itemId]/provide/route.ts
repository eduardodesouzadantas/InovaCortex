import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * POST /api/public/workspace/[id]/checklist/[itemId]/provide
 * Client marks a checklist item as "provided".
 * Requires ?t=<workspacePublicToken>
 *
 * On success:
 *  - Updates status to "provided"
 *  - Enqueues integration_verify_needed ActionQueue item (priority +20)
 *  - Emits clientProvidedIntegrationData AuditEvent
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; itemId: string }> }
) {
    const { id: workspaceId, itemId } = await params;
    const token = request.nextUrl.searchParams.get("t");

    // ── Token validation ───────────────────────────────────────────────────────
    const workspace = await (prisma as any).clientWorkspace.findFirst({
        where: { id: workspaceId, workspacePublicToken: token },
        select: { id: true, organizationId: true },
    });
    if (!workspace) {
        return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
    }

    // ── Find checklist item ────────────────────────────────────────────────────
    const item = await (prisma as any).integrationChecklistItem.findFirst({
        where: { id: itemId, workspaceId },
    });
    if (!item) {
        return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
    }
    if (item.status !== "pending") {
        return NextResponse.json({ success: true, status: item.status, alreadyUpdated: true });
    }

    // ── Update status ──────────────────────────────────────────────────────────
    await (prisma as any).integrationChecklistItem.update({
        where: { id: itemId },
        data: { status: "provided" },
    });

    // ── Enqueue integration_verify_needed ─────────────────────────────────────
    const existingAction = await (prisma as any).actionQueue.findFirst({
        where: {
            organizationId: workspace.organizationId,
            type: "integration_verify_needed",
            relatedEntityId: itemId,
            status: "pending",
        },
    });
    if (!existingAction) {
        await (prisma as any).actionQueue.create({
            data: {
                organizationId: workspace.organizationId,
                type: "integration_verify_needed",
                payloadJson: JSON.stringify({ workspaceId, itemId, system: item.system, itemName: item.item }),
                priority: "high",
                relatedEntityType: "integration_checklist_item",
                relatedEntityId: itemId,
                status: "pending",
                approvalRequired: false,
                reason: `Cliente marcou "${item.system} — ${item.item}" como fornecido`,
            },
        });
    }

    // ── Audit event ────────────────────────────────────────────────────────────
    await (prisma as any).auditEvent.create({
        data: {
            organizationId: workspace.organizationId,
            action: "clientProvidedIntegrationData",
            userId: "client:portal",
            resourceType: "integration_checklist_item",
            resourceId: itemId,
            details: JSON.stringify({ workspaceId, system: item.system, item: item.item }),
            ipAddress: request.headers.get("x-forwarded-for") ?? "unknown",
        },
    }).catch(() => null);

    logger.info("Client provided integration data", { workspaceId, itemId, system: item.system });

    return NextResponse.json({ success: true, status: "provided" });
}
