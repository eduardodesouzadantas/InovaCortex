import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { writeAuditEvent } from "@/lib/audit";

function authErrorResponse(e: unknown) {
    const message = e instanceof Error ? e.message : "";
    if (message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "ORG_NOT_FOUND") return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    if (typeof message === "string" && message.startsWith("FORBIDDEN")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const p = await params;
        const { orgId, role } = await requireOrgContext(p.slug);
        assertRole(role, "admin");

        const { salesRepId, month, targetCents } = await req.json();
        if (!salesRepId || typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month) || typeof targetCents !== "number") {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        const rep = await (prisma as any).salesRep.findFirst({
            where: { id: salesRepId, organizationId: orgId },
            select: { id: true }
        });
        if (!rep) return NextResponse.json({ error: "Rep not found" }, { status: 404 });

        const target = await (prisma as any).salesTarget.upsert({
            where: { salesRepId_month: { salesRepId, month } },
            update: { targetCents },
            create: { salesRepId, month, targetCents }
        });

        await writeAuditEvent({
            organizationId: orgId,
            action: "target_set",
            details: { salesRepId, month, targetCents },
            strict: true,
            context: { salesRepId, month },
        });

        return NextResponse.json({ target }, { status: 200 });
    } catch (e: unknown) {
        return authErrorResponse(e) ?? NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
