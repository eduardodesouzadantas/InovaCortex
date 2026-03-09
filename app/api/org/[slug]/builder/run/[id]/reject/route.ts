/**
 * Legacy adapter: /api/org/[slug]/builder/run/[id]/reject -> /api/agency/builder/run/[id]/reject
 */

import { NextRequest, NextResponse } from "next/server";
import { POST as AgencyPOST } from "@/app/api/agency/builder/run/[id]/reject/route";
import {
    applyLegacyBuilderDeprecationHeaders,
    isAgencyBuilderSlug,
} from "@/lib/builder/agency-builder-scope";

function ensureLegacySlug(slug: string): NextResponse | null {
    if (isAgencyBuilderSlug(slug)) return null;
    return NextResponse.json({ error: "Builder moved to agency scope" }, { status: 403 });
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    const { slug, id } = await params;
    const blocked = ensureLegacySlug(slug);
    if (blocked) return applyLegacyBuilderDeprecationHeaders(blocked);
    return applyLegacyBuilderDeprecationHeaders(
        await AgencyPOST(req, { params: Promise.resolve({ id }) }),
    );
}

