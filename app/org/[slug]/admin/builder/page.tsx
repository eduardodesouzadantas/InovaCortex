/**
 * app/org/[slug]/admin/builder/page.tsx
 * Legacy adapter route for tenant namespace.
 *
 * Canonical route: /agency/builder
 */

import { notFound, redirect } from "next/navigation";
import { BuilderClient } from "./builder-client";
import { isAgencyBuilderEnabled, isAgencyBuilderSlug } from "@/lib/builder/agency-builder-scope";

export const metadata = { title: "Builder Autopilot · Internal" };

export default async function BuilderLegacyAdapterPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    if (!isAgencyBuilderSlug(slug)) notFound();

    if (isAgencyBuilderEnabled()) {
        redirect("/agency/builder");
    }

    return <BuilderClient orgSlug={slug} apiBasePath={`/api/org/${slug}/builder`} />;
}
