import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertRole } from "@/lib/auth/rbac";
import {
    applyLegacyAdminApiDeprecationHeaders,
    createLegacyAdminFinalRedirectResponse,
    createLegacyAdminWriteFrozenResponse,
} from "@/lib/auth/admin-api-guard";
import {
    generateContentHandler,
    listContentArtifactsHandler,
    updateContentArtifactStatusHandler,
} from "@/lib/agency/content/handlers";

export const runtime = "nodejs";

/**
 * Legacy adapter for /api/admin/content -> /api/agency/content
 */
export async function POST(request: NextRequest) {
    const redirectResponse = createLegacyAdminFinalRedirectResponse(request, {
        successorPath: "/api/agency/content",
    });
    if (redirectResponse) return redirectResponse;

    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        assertRole(session.role, "admin");
    } catch {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const frozen = createLegacyAdminWriteFrozenResponse({ successorPath: "/api/agency/content" });
    if (frozen) return frozen;

    const body = await request.json();
    const response = await generateContentHandler(session.orgId, session.userId, body);
    return applyLegacyAdminApiDeprecationHeaders(response, { successorPath: "/api/agency/content" });
}

export async function GET(request: NextRequest) {
    const redirectResponse = createLegacyAdminFinalRedirectResponse(request, {
        successorPath: "/api/agency/content",
    });
    if (redirectResponse) return redirectResponse;

    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const response = await listContentArtifactsHandler(session.orgId, {
        type: searchParams.get("type"),
        status: searchParams.get("status"),
        page: Number(searchParams.get("page") ?? 1),
    });
    return applyLegacyAdminApiDeprecationHeaders(response, { successorPath: "/api/agency/content" });
}

export async function PATCH(request: NextRequest) {
    const redirectResponse = createLegacyAdminFinalRedirectResponse(request, {
        successorPath: "/api/agency/content",
    });
    if (redirectResponse) return redirectResponse;

    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const frozen = createLegacyAdminWriteFrozenResponse({ successorPath: "/api/agency/content" });
    if (frozen) return frozen;

    const body = await request.json();
    const response = await updateContentArtifactStatusHandler(session.orgId, session.userId, body);
    return applyLegacyAdminApiDeprecationHeaders(response, { successorPath: "/api/agency/content" });
}
