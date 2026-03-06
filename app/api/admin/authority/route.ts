import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import {
    generateAuthorityAsset,
    updateAuthorityStatus,
    getProofLibrary,
    recordAssetUsage,
    type AuthorityStatus,
} from "@/lib/authority-engine";
import { type AuthorityAssetType, type AnonLevel } from "@/lib/authority-templates";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * POST /api/admin/authority
 * Actions: generate | status | use
 */
export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try { assertRole(session.role, "admin"); }
    catch { return NextResponse.json({ error: "Forbidden — admin required" }, { status: 403 }); }

    const body = await request.json();
    const { action } = body;

    try {
        switch (action) {
            case "generate": {
                const { workspaceId, type, anonLevel } = body;
                if (!workspaceId || !type) {
                    return NextResponse.json({ error: "workspaceId and type required" }, { status: 400 });
                }
                const asset = await generateAuthorityAsset(
                    type as AuthorityAssetType,
                    workspaceId,
                    (anonLevel as AnonLevel) ?? "full",
                    session.orgId,
                );
                return NextResponse.json({ success: true, asset });
            }

            case "status": {
                const { assetId, status, publishedUrl } = body;
                // Guard: cannot publish without approval
                if (status === "published") {
                    const asset = await (prisma as any).authorityAsset.findFirst({
                        where: { id: assetId, organizationId: session.orgId }
                    });
                    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
                    if (asset.status !== "approved") {
                        return NextResponse.json({ error: "Asset precisa ser aprovado antes de publicar." }, { status: 400 });
                    }
                }
                const updated = await updateAuthorityStatus(
                    assetId, status as AuthorityStatus, session.userId, publishedUrl
                );
                return NextResponse.json({ success: true, asset: updated });
            }

            case "use": {
                // Record that an asset was referenced in a proposal or content
                const { assetId } = body;
                await recordAssetUsage(assetId);
                return NextResponse.json({ success: true });
            }

            default:
                return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
    } catch (err) {
        logger.error("Authority action failed", { action, error: String(err), orgId: session.orgId });
        return NextResponse.json(
            { error: String(err).includes("Insufficient data") ? "Dados insuficientes neste workspace." : "Falha na geração." },
            { status: 500 }
        );
    }
}

/**
 * GET /api/admin/authority
 * Returns proof library (approved/published assets) + aggregate stats.
 * Optionally filtered by type.
 */
export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as AuthorityAssetType | null ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const take = 20;

    const where: any = { organizationId: session.orgId };
    if (type) where.type = type;
    if (status) where.status = status;
    else where.status = "internal"; // Default: show all (overridden below for list)

    // For the full list, show all statuses
    delete where.status;
    if (status) where.status = status;

    const [assets, total] = await Promise.all([
        (prisma as any).authorityAsset.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * take,
            take,
        }),
        (prisma as any).authorityAsset.count({ where }),
    ]);

    const proofLibrary = await getProofLibrary(session.orgId, type);

    return NextResponse.json({
        assets,
        total,
        page,
        totalPages: Math.ceil(total / take),
        stats: proofLibrary.stats,
        publishedCount: assets.filter((a: any) => a.status === "published").length,
    });
}
