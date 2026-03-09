/**
 * Legacy adapter: /api/org/[slug]/builder/run/[id] -> /api/agency/builder/run/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { GET as AgencyGET, PATCH as AgencyPATCH } from "@/app/api/agency/builder/run/[id]/route";
import {
    applyLegacyBuilderDeprecationHeaders,
    isAgencyBuilderSlug,
} from "@/lib/builder/agency-builder-scope";

function ensureLegacySlug(slug: string): NextResponse | null {
    if (isAgencyBuilderSlug(slug)) return null;
    return NextResponse.json({ error: "Builder moved to agency scope" }, { status: 403 });
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    const { slug, id } = await params;
    const blocked = ensureLegacySlug(slug);
    if (blocked) return applyLegacyBuilderDeprecationHeaders(blocked);
    return applyLegacyBuilderDeprecationHeaders(
        await AgencyPATCH(req, { params: Promise.resolve({ id }) }),
    );
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    const { slug, id } = await params;
    const blocked = ensureLegacySlug(slug);
    if (blocked) return applyLegacyBuilderDeprecationHeaders(blocked);
    return applyLegacyBuilderDeprecationHeaders(
        await AgencyGET(req, { params: Promise.resolve({ id }) }),
    );
}
