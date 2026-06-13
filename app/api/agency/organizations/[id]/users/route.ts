import { NextRequest, NextResponse } from "next/server";

import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { logger, withApiLogging } from "@/lib/logger";
import { createOrganizationInitialUser } from "@/lib/repositories/organizationUserRepository";

export const runtime = "nodejs";

function buildDetailRedirect(request: NextRequest, organizationId: string, query: Record<string, string>): NextResponse {
    const url = new URL(`/agency/organizations/${organizationId}`, request.url);
    for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value);
    }
    return NextResponse.redirect(url, 303);
}

async function POSTHandler(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const auth = access.auth;
    if (!auth?.organizationId || !auth.userId || !auth.role) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData().catch(() => null);
    const name = formData?.get("name");
    const email = formData?.get("email");
    const password = formData?.get("password");
    const { id } = await params;

    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password.trim()) {
        logger.warn("Agency organization initial user creation rejected: missing fields", {
            operation: "agencyOrganizationUsers.create",
            organizationId: id,
            actorUserId: auth.userId,
            actorRole: auth.role,
        });
        return buildDetailRedirect(request, id, { userError: "missing_fields" });
    }

    const result = await createOrganizationInitialUser({
        organizationId: id,
        name: typeof name === "string" ? name : undefined,
        email,
        password,
        actorUserId: auth.userId,
        actorRole: auth.role,
        source: "agency_surface",
    });

    if (!result.ok) {
        logger.warn("Agency organization initial user creation rejected", {
            operation: "agencyOrganizationUsers.create",
            organizationId: id,
            actorUserId: auth.userId,
            actorRole: auth.role,
            reason: result.reason,
        });
        return buildDetailRedirect(request, id, { userError: result.reason });
    }

    return buildDetailRedirect(request, id, { userAction: "created" });
}

export const POST = withApiLogging("/api/agency/organizations/[id]/users", "POST", POSTHandler);
