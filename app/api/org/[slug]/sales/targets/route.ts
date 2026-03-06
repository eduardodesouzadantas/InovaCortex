import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const session = await getSession();
    if (!session || !hasRole(session.role, "admin")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const { salesRepId, month, targetCents } = await req.json();

    const target = await (prisma as any).salesTarget.upsert({
        where: { salesRepId_month: { salesRepId, month } },
        update: { targetCents },
        create: { salesRepId, month, targetCents }
    });

    // Log to AuditEvent
    await (prisma as any).auditEvent.create({
        data: {
            action: "target_set",
            details: JSON.stringify({ salesRepId, month, targetCents })
        }
    });

    return NextResponse.json({ target });
}
