import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * GET /api/admin/audit/export
 * Exports audit events as CSV for the org.
 */
export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session || !["owner", "admin"].includes(session.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? undefined;
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;

    const where: any = { organizationId: session.orgId };
    if (type) where.action = type;
    if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from);
        if (to) where.createdAt.lte = new Date(to + "T23:59:59Z");
    }

    const events = await (prisma as any).auditEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 5000,
        include: { assessment: { select: { company: true, email: true, scoreTotal: true } } },
    });

    // Build CSV
    const header = ["id", "action", "company", "email", "score", "details", "createdAt"].join(",");
    const rows = events.map((ev: any) => [
        ev.id,
        ev.action,
        ev.assessment?.company ?? "",
        ev.assessment?.email ?? "",
        ev.assessment?.scoreTotal ?? "",
        (ev.details ?? "").replace(/"/g, '""').replace(/\n/g, " "),
        new Date(ev.createdAt).toISOString(),
    ].map(v => `"${v}"`).join(","));

    const csv = [header, ...rows].join("\n");

    return new NextResponse(csv, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="audit-${session.orgId}-${new Date().toISOString().slice(0, 10)}.csv"`,
        }
    });
}
