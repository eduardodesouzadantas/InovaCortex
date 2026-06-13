import { prisma } from "@/lib/prisma";

/**
 * lib/sales/sla-engine.ts — V35
 * Scans for SLA breaches: leads assigned to reps with no follow-up activity.
 */

const DEFAULT_SLA_HOURS = 48;

export interface SLABreach {
    repId: string;
    repName: string;
    repRole: string;
    assessmentId: string;
    company: string;
    classification: string;
    assignedAt: Date;
    hoursStalled: number;
    severity: "warning" | "critical";
}

/**
 * Find all active assignments where the lead hasn't been updated
 * within the SLA threshold.
 */
export async function scanSLABreaches(
    orgId: string,
    thresholdHours = DEFAULT_SLA_HOURS
): Promise<SLABreach[]> {
    const cutoff = new Date(Date.now() - thresholdHours * 3600_000);

    const assignments = await (prisma as any).leadAssignment.findMany({
        where: {
            organizationId: orgId,
            status: "active",
            salesRep: { organizationId: orgId, active: true },
            assessment: {
                status: { notIn: ["won", "lost", "archived"] },
                updatedAt: { lte: cutoff },
            },
        },
        select: {
            assessmentId: true,
            assignedAt: true,
            salesRep: { select: { id: true, name: true, role: true } },
            assessment: { select: { id: true, company: true, classification: true, updatedAt: true } },
        },
        orderBy: { assignedAt: "asc" },
    });

    const now = Date.now();
    return assignments.map((a: any) => {
        const hoursStalled = Math.floor(
            (now - new Date(a.assessment.updatedAt).getTime()) / 3600_000
        );
        return {
            repId: a.salesRep.id,
            repName: a.salesRep.name,
            repRole: a.salesRep.role,
            assessmentId: a.assessmentId,
            company: a.assessment.company || "—",
            classification: a.assessment.classification || "—",
            assignedAt: a.assignedAt,
            hoursStalled,
            severity: hoursStalled >= thresholdHours * 2 ? "critical" : "warning",
        };
    });
}

/**
 * Group breaches by rep for dashboard/alert display.
 */
export function groupBreachesByRep(breaches: SLABreach[]) {
    const grouped: Record<string, { rep: { id: string; name: string; role: string }; breaches: SLABreach[] }> = {};
    for (const b of breaches) {
        if (!grouped[b.repId]) {
            grouped[b.repId] = { rep: { id: b.repId, name: b.repName, role: b.repRole }, breaches: [] };
        }
        grouped[b.repId].breaches.push(b);
    }
    return Object.values(grouped).sort((a, b) => b.breaches.length - a.breaches.length);
}

/**
 * Return active assignment counts per rep (workload overview).
 */
export async function getRepWorkload(orgId: string) {
    const reps = await (prisma as any).salesRep.findMany({
        where: { organizationId: orgId, active: true },
        select: {
            id: true,
            name: true,
            role: true,
            _count: { select: { assignments: { where: { status: "active" } } } },
        },
        orderBy: { name: "asc" },
    });

    return reps.map((r: any) => ({
        repId: r.id,
        name: r.name,
        role: r.role,
        activeLeads: r._count.assignments,
    }));
}
