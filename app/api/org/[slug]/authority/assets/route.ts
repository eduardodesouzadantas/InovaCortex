/**
 * app/api/org/[slug]/authority/assets/route.ts
 * PATCH: ProofAsset status mutations (review / approve / publish).
 */

import { requireOrgContext } from "@/lib/auth/org-context";
import {
    assertTenantRole,
    invalidTenantInputResponse,
    resolveTenantRouteError,
    tenantNotFoundResponse,
} from "@/lib/auth/tenant-route";
import { recalcProofStats } from "@/lib/authority/proof-engine";
import { logger, withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

interface Params {
    params: Promise<{ slug: string }>;
}

async function PATCHHandler(req: NextRequest, { params }: Params) {
    const { slug } = await params;
    const ctx = await requireOrgContext(slug).catch((error) => error);
    if (ctx instanceof Error) {
        return resolveTenantRouteError(ctx, "Failed to resolve authority asset context");
    }
    try {
        assertTenantRole(ctx.role, "admin");
    } catch (error) {
        return resolveTenantRouteError(error, "Failed to authorize authority asset update");
    }

    let body: { action?: string; assetId?: string };
    try {
        body = await req.json();
    } catch {
        return invalidTenantInputResponse("Invalid JSON");
    }

    const { assetId, action } = body;
    if (!assetId || !action) {
        return invalidTenantInputResponse("assetId and action required");
    }

    const { prisma } = await import("@/lib/prisma");
    const asset = await prisma.proofAsset.findFirst({
        where: { id: assetId, orgId: ctx.orgId },
        select: { id: true, orgId: true, status: true, anonLevel: true, workspaceId: true },
    });

    if (!asset) {
        return tenantNotFoundResponse("Asset not found");
    }

    try {
        switch (action) {
            case "review": {
                await prisma.proofAsset.update({
                    where: { id: assetId },
                    data: { status: "reviewed" },
                });
                return NextResponse.json({ message: "Enviado para revisão", status: "reviewed" });
            }
            case "approve": {
                await prisma.proofAsset.update({
                    where: { id: assetId },
                    data: { status: "approved" },
                });
                await recalcProofStats(asset.orgId);
                return NextResponse.json({ message: "Aprovado! Stats recalculadas.", status: "approved" });
            }
            case "publish": {
                if (asset.status !== "approved") {
                    return NextResponse.json({ error: "Somente ativos aprovados podem ser publicados" }, { status: 422 });
                }

                if (asset.anonLevel === "none") {
                    const workspace = await prisma.clientWorkspace.findFirst({
                        where: { id: asset.workspaceId, organizationId: ctx.orgId },
                        select: { allowPublicName: true },
                    });

                    if (!workspace?.allowPublicName) {
                        return NextResponse.json({
                            error: "Publicação com nome real requer allowPublicName=true no workspace",
                        }, { status: 422 });
                    }
                }

                await prisma.proofAsset.update({
                    where: { id: assetId },
                    data: { status: "published" },
                });
                await recalcProofStats(asset.orgId);
                return NextResponse.json({ message: "Publicado!", status: "published" });
            }
            default:
                return invalidTenantInputResponse(`Unknown action: ${action}`);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("[AuthorityAPI] Mutation failed", { assetId, action, error: message });
        return resolveTenantRouteError(error, "Failed to update authority asset");
    }
}

export const PATCH = withApiLogging("/api/org/[slug]/authority/assets", "PATCH", PATCHHandler);
