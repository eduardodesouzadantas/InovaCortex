/**
 * lib/portal-auth.ts
 * V19: Magic-token validation for the Client Portal.
 *
 * Usage: const workspace = await validatePortalToken(workspaceId, token);
 *        if (!workspace) return 401;
 */

import { prisma } from "@/lib/prisma";

export async function validatePortalToken(workspaceId: string, token: string | null | undefined) {
    if (!token) return null;

    const ws = await (prisma as any).clientWorkspace.findFirst({
        where: {
            id: workspaceId,
            workspacePublicToken: token,
        },
        include: {
            tasks: { orderBy: { orderIndex: "asc" as const } },
            checklist: { orderBy: { createdAt: "asc" as const } },
            uploads: { orderBy: { createdAt: "desc" as const } },
            comments: { orderBy: { createdAt: "desc" as const }, take: 50 },
        },
    });

    return ws ?? null;
}
