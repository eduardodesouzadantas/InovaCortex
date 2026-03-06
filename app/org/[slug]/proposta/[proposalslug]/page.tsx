import { redirect } from "next/navigation";
import { getPublicOrgBySlug } from "@/lib/auth/org-context";
import { notFound } from "next/navigation";

export const runtime = "nodejs";

/**
 * /org/[slug]/proposta/[proposalSlug]
 * Org-scoped proposal page proxy.
 */
export default async function OrgPropostaPage({
    params
}: { params: Promise<{ slug: string; proposalslug: string }> }) {
    const { slug, proposalslug } = await params;

    const org = await getPublicOrgBySlug(slug);
    if (!org) notFound();

    redirect(`/proposta/${proposalslug}`);
}
