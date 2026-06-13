import { prisma } from "@/lib/prisma";
import {
    renderOnePagerHtml,
    buildProposalTemplate,
    buildContractTemplate,
    buildStripeCheckoutConfig
} from "./offer-engine";

/**
 * Publishes a draft offer, generating assets and making it public.
 */
export async function publishOffer(offerId: string, organizationId?: string) {
    const offer = await prisma.offer.findUnique({
        where: { id: offerId },
        include: { assets: true }
    });

    if (!offer) throw new Error("Offer not found");
    if (organizationId && offer.organizationId !== organizationId) {
        throw new Error("FORBIDDEN");
    }

    const slug = `offer-${offer.organizationId.slice(0, 4)}-${Math.random().toString(36).slice(2, 7)}`;

    // Generate all assets
    const assets = [
        { organizationId: offer.organizationId, type: "one_pager_html", content: renderOnePagerHtml({ ...offer, publishedSlug: slug }) },
        { organizationId: offer.organizationId, type: "proposal_template", content: buildProposalTemplate(offer) },
        { organizationId: offer.organizationId, type: "contract_template", content: buildContractTemplate(offer) },
        { organizationId: offer.organizationId, type: "checkout_config", content: JSON.stringify(buildStripeCheckoutConfig(offer)) }
    ];

    // Update offer and create/update assets
    return prisma.$transaction(async (tx) => {
        // Clear old assets if needed (or just upsert)
        await tx.offerAsset.deleteMany({ where: { offerId, organizationId: offer.organizationId } });

        const updated = await tx.offer.update({
            where: { id: offerId },
            data: {
                status: "published",
                publishedSlug: slug,
                assets: {
                    create: assets
                }
            },
            include: { assets: true }
        });

        return updated;
    });
}
