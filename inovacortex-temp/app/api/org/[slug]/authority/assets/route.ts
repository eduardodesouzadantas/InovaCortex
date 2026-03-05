/**
 * app/api/org/[slug]/authority/assets/route.ts
 * V21: PATCH — ProofAsset status mutations (review / approve / publish).
 *
 * Guardrail: anonLevel == "none" + allowPublicName != true → block publish.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { recalcProofStats } from "@/lib/authority/proof-engine";
import { logger } from "@/lib/logger";

interface Params { params: { slug: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
    const session = await getServerSession(authOptions as any).catch(() => null);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: { assetId: string; action: string };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const { assetId, action } = body;
    if (!assetId || !action) return NextResponse.json({ error: "assetId and action required" }, { status: 400 });

    const { prisma } = await import("@/lib/prisma");

    const asset = await (prisma as any).proofAsset.findUnique({
        where: { id: assetId },
        select: { id: true, orgId: true, status: true, anonLevel: true, workspaceId: true },
    }).catch(() => null);

    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

    const org = await (prisma as any).organization.findUnique({
        where: { slug: params.slug }, select: { id: true },
    }).catch(() => null);

    if (!org || org.id !== asset.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        switch (action) {
            case "review": {
                await (prisma as any).proofAsset.update({
                    where: { id: assetId }, data: { status: "reviewed" },
                });
                return NextResponse.json({ message: "Enviado para revisão", status: "reviewed" });
            }

            case "approve": {
                await (prisma as any).proofAsset.update({
                    where: { id: assetId }, data: { status: "approved" },
                });
                await recalcProofStats(asset.orgId);
                return NextResponse.json({ message: "Aprovado! Stats recalculadas.", status: "approved" });
            }

            case "publish": {
                if (asset.status !== "approved") {
                    return NextResponse.json({ error: "Somente ativos aprovados podem ser publicados" }, { status: 422 });
                }

                // Guardrail: anonLevel none + allowPublicName != true
                if (asset.anonLevel === "none") {
                    const workspace = await (prisma as any).clientWorkspace.findUnique({
                        where: { id: asset.workspaceId },
                        select: { allowPublicName: true },
                    }).catch(() => null);

                    if (!workspace?.allowPublicName) {
                        return NextResponse.json({
                            error: "Publicação com nome real requer allowPublicName=true no workspace",
                        }, { status: 422 });
                    }
                }

                await (prisma as any).proofAsset.update({
                    where: { id: assetId }, data: { status: "published" },
                });
                await recalcProofStats(asset.orgId);
                return NextResponse.json({ message: "Publicado! ✅", status: "published" });
            }

            default:
                return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
        }
    } catch (err: any) {
        logger.error("[AuthorityAPI] Mutation failed", { assetId, action, error: err?.message });
        return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 });
    }
}
