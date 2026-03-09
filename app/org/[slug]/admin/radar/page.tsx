import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { RadarClient } from "./radar-client";

export const metadata = { title: "Business Radar - InovaCortex" };

export default async function RadarPage({ params }: { params: { slug: string } }) {
    try {
        const ctx = await requireOrgContext(params.slug);
        assertRole(ctx.role, "admin");
    } catch {
        redirect(`/org/${params.slug}/admin/login`);
    }

    return <RadarClient orgSlug={params.slug} />;
}
