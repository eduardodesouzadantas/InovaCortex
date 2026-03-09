/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
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

export async function runAuthorityActionHandler(
    orgId: string,
    userId: string | null,
    body: {
        action?: string;
        workspaceId?: string;
        type?: string;
        anonLevel?: string;
        assetId?: string;
        status?: string;
        publishedUrl?: string;
    },
): Promise<NextResponse> {
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
                    orgId,
                );
                return NextResponse.json({ success: true, asset });
            }

            case "status": {
                const { assetId, status, publishedUrl } = body;
                if (!assetId || !status) {
                    return NextResponse.json({ error: "assetId and status required" }, { status: 400 });
                }

                if (status === "published") {
                    const asset = await (prisma as any).authorityAsset.findFirst({
                        where: { id: assetId, organizationId: orgId },
                    });
                    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
                    if (asset.status !== "approved") {
                        return NextResponse.json(
                            { error: "Asset precisa ser aprovado antes de publicar." },
                            { status: 400 },
                        );
                    }
                }

                const updated = await updateAuthorityStatus(
                    assetId,
                    status as AuthorityStatus,
                    userId ?? undefined,
                    publishedUrl,
                );
                return NextResponse.json({ success: true, asset: updated });
            }

            case "use": {
                const { assetId } = body;
                if (!assetId) return NextResponse.json({ error: "assetId required" }, { status: 400 });
                await recordAssetUsage(assetId);
                return NextResponse.json({ success: true });
            }

            default:
                return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
    } catch (error) {
        logger.error("Authority action failed", { action, error: String(error), orgId });
        return NextResponse.json(
            { error: String(error).includes("Insufficient data") ? "Dados insuficientes neste workspace." : "Falha na geracao." },
            { status: 500 },
        );
    }
}

export async function listAuthorityAssetsHandler(
    orgId: string,
    query: {
        type?: string | null;
        status?: string | null;
        page?: number;
    },
): Promise<NextResponse> {
    const type = (query.type as AuthorityAssetType | undefined) ?? undefined;
    const status = query.status ?? undefined;
    const page = Math.max(1, Number(query.page ?? 1));
    const take = 20;

    const where: any = { organizationId: orgId };
    if (type) where.type = type;
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

    const proofLibrary = await getProofLibrary(orgId, type);

    return NextResponse.json({
        assets,
        total,
        page,
        totalPages: Math.ceil(total / take),
        stats: proofLibrary.stats,
        publishedCount: assets.filter((asset: any) => asset.status === "published").length,
    });
}
