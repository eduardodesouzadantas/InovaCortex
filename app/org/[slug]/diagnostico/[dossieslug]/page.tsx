import { redirect } from "next/navigation";
import { getPublicOrgBySlug } from "@/lib/auth/org-context";
import { notFound } from "next/navigation";

export const runtime = "nodejs";

/**
 * /org/[slug]/diagnostico/[dossiê-slug]
 * Org-scoped dossier — just proxies to the main diagnostico page.
 */
export default async function OrgDiagnosticoPage({
    params
}: { params: Promise<{ slug: string; dossieslug: string }> }) {
    const { slug, dossieslug } = await params;

    const org = await getPublicOrgBySlug(slug);
    if (!org) notFound();

    redirect(`/diagnostico/${dossieslug}`);
}
