import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storeUpload, UploadType } from "@/lib/upload";
import { logger, withApiLogging } from "@/lib/logger";

export const runtime = "nodejs";
// Default body parser is not present in App Router; we use request.formData() directly.

const ALLOWED_TYPES: UploadType[] = ["logo", "brand", "copy", "credentials", "other"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/public/workspace/[id]/upload
 * Accepts multipart/form-data: file + type fields.
 * Requires ?t=<workspacePublicToken>
 */
async function POSTHandler(
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

    // ── Parse multipart ────────────────────────────────────────────────────────
    let formData: FormData;
    try {
        formData = await request.formData();
    } catch {
        return NextResponse.json({ error: "Erro ao ler os dados do upload." }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    const type = (formData.get("type") as string | null) ?? "other";

    if (!file) {
        return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(type as UploadType)) {
        return NextResponse.json({ error: `Tipo inválido: ${type}` }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "Arquivo muito grande (máx 10 MB)." }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // ── Store file ─────────────────────────────────────────────────────────────
    try {
        const result = await storeUpload({
            orgId: workspace.organizationId,
            workspaceId,
            type: type as UploadType,
            filename: file.name,
            buffer,
            mimeType: file.type,
        });

        await (prisma as any).auditEvent.create({
            data: {
                organizationId: workspace.organizationId,
                action: "clientUploadedFile",
                userId: "client:portal",
                resourceType: "workspace_upload",
                resourceId: result.id,
                details: JSON.stringify({ workspaceId, type, filename: result.filename, stub: result.stub }),
                ipAddress: request.headers.get("x-forwarded-for") ?? "unknown",
            },
        }).catch(() => null);

        return NextResponse.json({ success: true, id: result.id, url: result.url, filename: result.filename });

    } catch (err: any) {
        logger.error("Upload failed", { error: err.message, workspaceId });
        return NextResponse.json({ error: "Erro ao salvar o arquivo." }, { status: 500 });
    }
}

export const POST = withApiLogging("/api/public/workspace/[id]/upload", "POST", POSTHandler);
