/**
 * app/api/org/[slug]/radar/route.ts
 * V23: GET radar payload for an org.
 */

import { NextRequest, NextResponse } from "next/server";
import { loadRadar } from "@/lib/radar/radar-loader";
import { logger } from "@/lib/logger";
import { requireOrgContext } from "@/lib/auth/org-context";

function authErrorResponse(e: unknown) {
    const message = e instanceof Error ? e.message : "";
    if (message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "ORG_NOT_FOUND") return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    if (typeof message === "string" && message.startsWith("FORBIDDEN")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;

    try {
        const { orgId } = await requireOrgContext(slug);
        const payload = await loadRadar(orgId);

        return NextResponse.json(payload, {
            headers: {
                "Cache-Control": "private, no-store",
            },
        });
    } catch (err: unknown) {
        const authResponse = authErrorResponse(err);
        if (authResponse) return authResponse;

        const message = err instanceof Error ? err.message : String(err);
        logger.error("[RadarAPI]", { slug, err: message });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
