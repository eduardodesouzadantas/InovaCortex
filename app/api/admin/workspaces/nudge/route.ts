import { NextResponse } from "next/server";
import { getOrgContextFromSession } from "@/lib/auth/org-context";
import { getSessionFromRequest } from "@/lib/auth/session";
import { assertRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const session = await getSessionFromRequest(req as any);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const ctx = await getOrgContextFromSession(session);
        assertRole(ctx.role, "admin");

        // Stub action
        await (prisma as any).auditEvent.create({
            data: {
                assessmentId: "system", organizationId: ctx.orgId, action: "workspaceNudgeAll",
                details: JSON.stringify({ by: ctx.userId }),
            }
        }).catch(() => null);

        await new Promise(r => setTimeout(r, 800));

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: "Falha na ação" }, { status: 500 });
    }
}
