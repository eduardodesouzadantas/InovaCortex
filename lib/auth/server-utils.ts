/**
 * lib/auth/server-utils.ts
 * Helper for server-side auth and user context.
 */

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

/**
 * Get the current authenticated user from session cookie.
 * Includes organization context.
 */
export async function getCurrentUser() {
    const session = await getSession();
    if (!session) return null;

    return await (prisma as any).user.findUnique({
        where: { id: session.userId },
        include: { organization: true },
    }).catch(() => null);
}
