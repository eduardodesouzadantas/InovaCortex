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
export async function publishOffer(offerId: string) {
    const offer = await prisma.offer.findUnique({
        where: { id: offerId },
        include: { assets: true }
    });

    if (!offer) throw new Error("Offer not found");

    const slug = `offer-${offer.organizationId.slice(0, 4)}-${Math.random().toString(36).slice(2, 7)}`;

    // Generate all assets
    const assets = [
        { type: "one_pager_html", content: renderOnePagerHtml({ ...offer, publishedSlug: slug }) },
        { type: "proposal_template", content: buildProposalTemplate(offer) },
        { type: "contract_template", content: buildContractTemplate(offer) },
        { type: "checkout_config", content: JSON.stringify(buildStripeCheckoutConfig(offer)) }
    ];

    // Update offer and create/update assets
    return prisma.$transaction(async (tx) => {
        // Clear old assets if needed (or just upsert)
        await tx.offerAsset.deleteMany({ where: { offerId } });

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
