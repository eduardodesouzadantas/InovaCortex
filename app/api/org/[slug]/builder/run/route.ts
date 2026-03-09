/**
 * Legacy adapter: /api/org/[slug]/builder/run -> /api/agency/builder/run
 */

import { NextRequest, NextResponse } from "next/server";
import { GET as AgencyGET, POST as AgencyPOST } from "@/app/api/agency/builder/run/route";
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
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const blocked = ensureLegacySlug(slug);
    if (blocked) return applyLegacyBuilderDeprecationHeaders(blocked);
    return applyLegacyBuilderDeprecationHeaders(await AgencyPOST(req));
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const blocked = ensureLegacySlug(slug);
    if (blocked) return applyLegacyBuilderDeprecationHeaders(blocked);
    return applyLegacyBuilderDeprecationHeaders(await AgencyGET(req));
}
