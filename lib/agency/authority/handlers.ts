/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { z } from "zod";
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
import { fromZodError, isAIUnavailableError, toAIUnavailableError } from "@/lib/http/route-errors";

const authorityGenerateSchema = z.object({
    action: z.literal("generate"),
    workspaceId: z.string().trim().min(1),
    type: z.string().trim().min(1),
    anonLevel: z.string().trim().optional(),
});

const authorityStatusSchema = z.object({
    action: z.literal("status"),
    assetId: z.string().trim().min(1),
    status: z.string().trim().min(1),
    publishedUrl: z.string().trim().url().optional().or(z.literal("").transform(() => undefined)),
});

const authorityUseSchema = z.object({
    action: z.literal("use"),
    assetId: z.string().trim().min(1),
});

export async function runAuthorityActionHandler(
    orgId: string,
    userId: string | null,
    body: unknown,
): Promise<NextResponse> {
    if (!body || typeof body !== "object") {
        const parsedBody = z.object({ action: z.string() }).safeParse(body);
        if (!parsedBody.success) {
            throw fromZodError(parsedBody.error);
        }
    }

    const action = (body as { action?: unknown }).action;

    try {
        switch (action) {
            case "generate": {
                const parsed = authorityGenerateSchema.safeParse(body);
                if (!parsed.success) {
                    throw fromZodError(parsed.error);
                }
                const { workspaceId, type, anonLevel } = parsed.data;

                const workspace = await (prisma as any).clientWorkspace.findFirst({
                    where: { id: workspaceId, organizationId: orgId },
                    select: { id: true },
                });
                if (!workspace) {
                    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
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
                const parsed = authorityStatusSchema.safeParse(body);
                if (!parsed.success) {
                    throw fromZodError(parsed.error);
                }
                const { assetId, status, publishedUrl } = parsed.data;

                if (status === "published") {
                    const asset = await (prisma as any).authorityAsset.findFirst({
                        where: { id: assetId, organizationId: orgId },
                        select: { id: true, status: true },
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
                const parsed = authorityUseSchema.safeParse(body);
                if (!parsed.success) {
                    throw fromZodError(parsed.error);
                }
                const { assetId } = parsed.data;
                const asset = await (prisma as any).authorityAsset.findFirst({
                    where: { id: assetId, organizationId: orgId },
                    select: { id: true },
                });
                if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
                await recordAssetUsage(assetId);
                return NextResponse.json({ success: true });
            }

            default:
                {
                    const invalidAction = z.object({ action: z.enum(["generate", "status", "use"]) }).safeParse(body);
                    if (!invalidAction.success) {
                        throw fromZodError(invalidAction.error);
                    }
                }
                return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
    } catch (error) {
        logger.error("Authority action failed", { action, error: String(error), orgId });
        if (isAIUnavailableError(error)) {
            throw toAIUnavailableError(error);
        }
        if (String(error).includes("Insufficient data")) {
            return NextResponse.json(
                { error: "Dados insuficientes neste workspace.", code: "INVALID_WORKSPACE_DATA" },
                { status: 422 },
            );
        }
        throw error;
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
