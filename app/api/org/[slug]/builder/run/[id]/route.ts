import { withApiLogging } from "@/lib/logger";
/**
 * Legacy adapter: /api/org/[slug]/builder/run/[id] -> /api/agency/builder/run/[id]
 */

import { NextRequest } from "next/server";
import { GET as AgencyGET, PATCH as AgencyPATCH } from "@/app/api/agency/builder/run/[id]/route";
import {
    applyLegacyBuilderDeprecationHeaders,
    ensureLegacyBuilderSlug,
} from "@/lib/builder/agency-builder-scope";

async function PATCHHandler(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    const { slug, id } = await params;
    const blocked = ensureLegacyBuilderSlug(slug);
    if (blocked) return blocked;
    return applyLegacyBuilderDeprecationHeaders(
        await AgencyPATCH(req, { params: Promise.resolve({ id }) }),
    );
}

async function GETHandler(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string; id: string }> },
) {
    const { slug, id } = await params;
    const blocked = ensureLegacyBuilderSlug(slug);
    if (blocked) return blocked;
    return applyLegacyBuilderDeprecationHeaders(
        await AgencyGET(req, { params: Promise.resolve({ id }) }),
    );
}

export const PATCH = withApiLogging("/api/org/[slug]/builder/run/[id]", "PATCH", PATCHHandler);
export const GET = withApiLogging("/api/org/[slug]/builder/run/[id]", "GET", GETHandler);
