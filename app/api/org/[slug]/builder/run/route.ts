import { withApiLogging } from "@/lib/logger";
/**
 * Legacy adapter: /api/org/[slug]/builder/run -> /api/agency/builder/run
 */

import { NextRequest } from "next/server";
import { GET as AgencyGET, POST as AgencyPOST } from "@/app/api/agency/builder/run/route";
import {
    applyLegacyBuilderDeprecationHeaders,
    ensureLegacyBuilderSlug,
} from "@/lib/builder/agency-builder-scope";

async function POSTHandler(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const blocked = ensureLegacyBuilderSlug(slug);
    if (blocked) return blocked;
    return applyLegacyBuilderDeprecationHeaders(await AgencyPOST(req));
}

async function GETHandler(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const blocked = ensureLegacyBuilderSlug(slug);
    if (blocked) return blocked;
    return applyLegacyBuilderDeprecationHeaders(await AgencyGET(req));
}

export const POST = withApiLogging("/api/org/[slug]/builder/run", "POST", POSTHandler);
export const GET = withApiLogging("/api/org/[slug]/builder/run", "GET", GETHandler);
