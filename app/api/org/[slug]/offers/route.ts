import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { orgContextErrorResponse, requireOrgContext } from "@/lib/auth/org-context";
import { hasRole } from "@/lib/auth/rbac";
import { buildOfferDraft } from "@/lib/offers/offer-engine";
import { prisma } from "@/lib/prisma";

async function GETHandler(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const { orgId } = await requireOrgContext(slug);

        const offers = await prisma.offer.findMany({
            where: { organizationId: orgId },
            orderBy: { updatedAt: "desc" },
        });

        return NextResponse.json(offers);
    } catch (error) {
        return orgContextErrorResponse(error);
    }
}

async function POSTHandler(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const { orgId, role } = await requireOrgContext(slug);
        if (!hasRole(role, "admin")) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }

        const body = await req.json() as { niche?: string };
        const draft = buildOfferDraft(orgId, body.niche);

        const offer = await prisma.offer.create({
            data: {
                organizationId: orgId,
                name: draft.name,
                niche: draft.niche,
                priceCents: draft.priceCents,
                currency: draft.currency,
                offerJson: JSON.stringify({
                    promise: draft.promise,
                    deliverables: draft.deliverables,
                    timeline: draft.timeline,
                    guarantees: draft.guarantees,
                    exclusions: draft.exclusions,
                }),
                roiModelJson: JSON.stringify(draft.roiVariables),
            },
        });

        return NextResponse.json(offer);
    } catch (error) {
        return orgContextErrorResponse(error);
    }
}

export const GET = withApiLogging("/api/org/[slug]/offers", "GET", GETHandler);
export const POST = withApiLogging("/api/org/[slug]/offers", "POST", POSTHandler);
