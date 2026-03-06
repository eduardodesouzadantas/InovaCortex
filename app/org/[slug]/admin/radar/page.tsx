/**
 * app/org/[slug]/admin/radar/page.tsx
 * V23: Business Radar — server shell
 */

import { RadarClient } from "./radar-client";

export const metadata = { title: "Business Radar · InovaCortex" };

export default function RadarPage({ params }: { params: { slug: string } }) {
    return <RadarClient orgSlug={params.slug} />;
}
