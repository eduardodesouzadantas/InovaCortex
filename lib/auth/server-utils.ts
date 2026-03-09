/**
 * lib/auth/server-utils.ts
 * Helper for server-side auth and user context.
 */

import { getAuthContext, type AuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function getCurrentAuthContext(): Promise<AuthContext> {
    return getAuthContext();
}

/**
 * Get the current authenticated user from session cookie.
 * Includes organization context.
 */
export async function getCurrentUser() {
    const auth = await getCurrentAuthContext();
    if (!auth.isAuthenticated || !auth.userId) return null;

    return await prisma.user.findUnique({
        where: { id: auth.userId },
        include: { organization: true },
    }).catch(() => null);
}
