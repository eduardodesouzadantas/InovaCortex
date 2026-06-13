import { withApiLogging } from "@/lib/logger";
/**
 * Legacy adapter: /api/org/[slug]/builder/run/[id]/reject -> /api/agency/builder/run/[id]/reject
 */

import { NextRequest } from "next/server";
import { POST as AgencyPOST } from "@/app/api/agency/builder/run/[id]/reject/route";
import {
    applyLegacyBuilderDeprecationHeaders,
    ensureLegacyBuilderSlug,
} from "@/lib/builder/agency-builder-scope";

async function POSTHandler(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    const { slug, id } = await params;
    const blocked = ensureLegacyBuilderSlug(slug);
    if (blocked) return blocked;
    return applyLegacyBuilderDeprecationHeaders(
        await AgencyPOST(req, { params: Promise.resolve({ id }) }),
    );
}

export const POST = withApiLogging("/api/org/[slug]/builder/run/[id]/reject", "POST", POSTHandler);
