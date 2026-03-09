/**
 * Legacy adapter: /api/org/[slug]/builder/templates -> /api/agency/builder/templates
 */

import { NextRequest, NextResponse } from "next/server";
import { GET as AgencyGET, PATCH as AgencyPATCH } from "@/app/api/agency/builder/templates/route";
import {
    applyLegacyBuilderDeprecationHeaders,
    isAgencyBuilderSlug,
} from "@/lib/builder/agency-builder-scope";

function ensureLegacySlug(slug: string): NextResponse | null {
    if (isAgencyBuilderSlug(slug)) return null;
    return NextResponse.json({ error: "Builder moved to agency scope" }, { status: 403 });
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

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const blocked = ensureLegacySlug(slug);
    if (blocked) return applyLegacyBuilderDeprecationHeaders(blocked);
    return applyLegacyBuilderDeprecationHeaders(await AgencyPATCH(req));
}

