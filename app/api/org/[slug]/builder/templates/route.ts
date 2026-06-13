import { withApiLogging } from "@/lib/logger";
/**
 * Legacy adapter: /api/org/[slug]/builder/templates -> /api/agency/builder/templates
 */

import { NextRequest } from "next/server";
import { GET as AgencyGET, PATCH as AgencyPATCH } from "@/app/api/agency/builder/templates/route";
import {
    applyLegacyBuilderDeprecationHeaders,
    ensureLegacyBuilderSlug,
} from "@/lib/builder/agency-builder-scope";

async function GETHandler(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const blocked = ensureLegacyBuilderSlug(slug);
    if (blocked) return blocked;
    return applyLegacyBuilderDeprecationHeaders(await AgencyGET(req));
}

async function PATCHHandler(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const blocked = ensureLegacyBuilderSlug(slug);
    if (blocked) return blocked;
    return applyLegacyBuilderDeprecationHeaders(await AgencyPATCH(req));
}

export const GET = withApiLogging("/api/org/[slug]/builder/templates", "GET", GETHandler);
export const PATCH = withApiLogging("/api/org/[slug]/builder/templates", "PATCH", PATCHHandler);
