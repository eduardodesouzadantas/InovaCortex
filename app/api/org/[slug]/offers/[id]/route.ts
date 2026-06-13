import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { orgContextErrorResponse, requireOrgContext } from "@/lib/auth/org-context";
import { hasRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

async function GETHandler(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string; id: string }> }
) {
    try {
        const { slug, id } = await params;
        const { orgId } = await requireOrgContext(slug);
        const offer = await prisma.offer.findFirst({
            where: { id, organizationId: orgId },
            include: { assets: true },
        });
        if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
        return NextResponse.json(offer);
    } catch (error) {
        return orgContextErrorResponse(error);
    }
}

async function PATCHHandler(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string; id: string }> }
) {
    try {
        const { slug, id } = await params;
        const { orgId, role } = await requireOrgContext(slug);
        if (!hasRole(role, "admin")) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }

        const existing = await prisma.offer.findFirst({
            where: { id, organizationId: orgId },
            select: { id: true },
        });
        if (!existing) {
            return NextResponse.json({ error: "Offer not found" }, { status: 404 });
        }

        const body = await req.json() as {
            name?: string;
            priceCents?: number;
            status?: string;
            offerJson?: unknown;
            roiModelJson?: unknown;
        };

        const data: Prisma.OfferUpdateInput = {};
        if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
        if (typeof body.priceCents === "number") data.priceCents = body.priceCents;
        if (typeof body.status === "string" && body.status.trim()) data.status = body.status.trim();
        if (typeof body.offerJson !== "undefined") {
            data.offerJson = typeof body.offerJson === "string" ? body.offerJson : JSON.stringify(body.offerJson);
        }
        if (typeof body.roiModelJson !== "undefined") {
            data.roiModelJson = typeof body.roiModelJson === "string" ? body.roiModelJson : JSON.stringify(body.roiModelJson);
        }

        const updated = await prisma.offer.update({
            where: { id: existing.id },
            data,
            include: { assets: true },
        });

        return NextResponse.json(updated);
    } catch (error) {
        return orgContextErrorResponse(error);
    }
}

export const GET = withApiLogging("/api/org/[slug]/offers/[id]", "GET", GETHandler);
export const PATCH = withApiLogging("/api/org/[slug]/offers/[id]", "PATCH", PATCHHandler);
