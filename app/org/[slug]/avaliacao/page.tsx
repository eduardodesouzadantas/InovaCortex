import { redirect } from "next/navigation";
import { getPublicOrgBySlug } from "@/lib/auth/org-context";
import { notFound } from "next/navigation";

export const runtime = "nodejs";

/**
 * /org/[slug]/avaliacao
 * Org-scoped assessment wizard. Passes orgSlug to the wizard component
 * so submissions are tagged with the correct organizationId.
 */
export default async function OrgAvaliacaoPage({
    params
}: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    // Verify org exists (public — no auth required to submit an assessment)
    const org = await getPublicOrgBySlug(slug);
    if (!org) notFound();

    // Redirect to the standard assessment page with org context in query
    // The assessment route will pick up ?org=slug to tag the record
    redirect(`/avaliacao?org=${slug}`);
}
