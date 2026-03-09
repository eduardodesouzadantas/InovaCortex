/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";

export async function buildAuditCsv(input: {
    orgId: string;
    type?: string;
    from?: string;
    to?: string;
}): Promise<{ csv: string; filename: string }> {
    const where: any = { organizationId: input.orgId };
    if (input.type) where.action = input.type;
    if (input.from || input.to) {
        where.createdAt = {};
        if (input.from) where.createdAt.gte = new Date(input.from);
        if (input.to) where.createdAt.lte = new Date(`${input.to}T23:59:59Z`);
    }

    const events = await (prisma as any).auditEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 5000,
        include: { assessment: { select: { company: true, email: true, scoreTotal: true } } },
    });

    const header = ["id", "action", "company", "email", "score", "details", "createdAt"].join(",");
    const rows = events.map((event: any) => [
        event.id,
        event.action,
        event.assessment?.company ?? "",
        event.assessment?.email ?? "",
        event.assessment?.scoreTotal ?? "",
        (event.details ?? "").replace(/"/g, '""').replace(/\n/g, " "),
        new Date(event.createdAt).toISOString(),
    ].map((value) => `"${value}"`).join(","));

    const csv = [header, ...rows].join("\n");
    const filename = `audit-${input.orgId}-${new Date().toISOString().slice(0, 10)}.csv`;
    return { csv, filename };
}
