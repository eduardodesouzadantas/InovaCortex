import { hasRole } from "@/lib/auth/rbac";
import { getAuthContext, getAuthContextFromRequest } from "@/lib/auth/session";
import type { NextRequest } from "next/server";

export type AdminSessionContext = {
    userId: string;
    role: string;
    organizationId: string;
    organizationSlug: string;
};

export async function requireAdminSession(): Promise<AdminSessionContext> {
    const auth = await getAuthContext();
    return toAdminSessionContext(auth);
}

export async function requireAdminSessionFromRequest(request: NextRequest): Promise<AdminSessionContext> {
    const auth = await getAuthContextFromRequest(request);
    return toAdminSessionContext(auth);
}

function toAdminSessionContext(auth: Awaited<ReturnType<typeof getAuthContext>>): AdminSessionContext {

    if (!auth.isAuthenticated || !auth.session) {
        throw new Error("UNAUTHORIZED");
    }

    if (auth.authScope !== "agency") {
        throw new Error("FORBIDDEN");
    }

    if (!auth.userId || !auth.role || !auth.organizationId || !auth.organizationSlug) {
        throw new Error("FORBIDDEN");
    }

    if (!hasRole(auth.role, "admin")) {
        throw new Error("FORBIDDEN");
    }

    return {
        userId: auth.userId,
        role: auth.role,
        organizationId: auth.organizationId,
        organizationSlug: auth.organizationSlug,
    };
}
