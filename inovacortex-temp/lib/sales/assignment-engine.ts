import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * lib/sales/assignment-engine.ts — V35
 * Deterministic lead assignment: manual and automatic.
 */

export type RepRole = "SDR" | "Closer" | "CS";

// ─── Manual Assignment ────────────────────────────────────────────────────────

/**
 * Assign or reassign a lead to a SalesRep.
 * Closes any active assignment first, then creates a new one.
 */
export async function assignLead({
    assessmentId,
    salesRepId,
    assignedByUserId,
}: {
    assessmentId: string;
    salesRepId: string;
    assignedByUserId?: string;
}) {
    return prisma.$transaction(async (tx: any) => {
        // Close any existing active assignment
        await tx.leadAssignment.updateMany({
            where: { assessmentId, status: "active" },
            data: { status: "reassigned", updatedAt: new Date() },
        });

        // Create new assignment
        const assignment = await tx.leadAssignment.create({
            data: {
                assessmentId,
                salesRepId,
                assignedByUserId: assignedByUserId ?? null,
                status: "active",
            },
        });

        // Log to AuditEvent
        await tx.auditEvent.create({
            data: {
                assessmentId,
                action: "lead_assigned",
                details: JSON.stringify({ salesRepId, assignedByUserId }),
            },
        });

        logger.info(`Lead assigned: ${assessmentId} → ${salesRepId}`);
        return assignment;
    });
}

// ─── Auto Assignment ──────────────────────────────────────────────────────────

/**
 * Automatically assign a lead based on classification.
 * hot → Closer (least loaded), warm → SDR, cold → not assigned.
 */
export async function autoAssign({
    assessmentId,
    orgId,
    classification,
}: {
    assessmentId: string;
    orgId: string;
    classification: string;
}) {
    const targetRole = classificationToRole(classification);
    if (!targetRole) {
        logger.info(`Auto-assign skipped for classification: ${classification}`);
        return null;
    }

    // Find the rep of that role with the fewest active assignments (load balancing)
    const reps = await (prisma as any).salesRep.findMany({
        where: { organizationId: orgId, role: targetRole, active: true },
        include: {
            _count: { select: { assignments: { where: { status: "active" } } } },
        },
        orderBy: { createdAt: "asc" },
    });

    if (reps.length === 0) {
        logger.warn(`No active ${targetRole} found in org ${orgId} for auto-assign`);
        return null;
    }

    // Pick the rep with fewest active assignments
    const sorted = reps.sort(
        (a: any, b: any) => a._count.assignments - b._count.assignments
    );
    const rep = sorted[0];

    return assignLead({
        assessmentId,
        salesRepId: rep.id,
        assignedByUserId: undefined, // null = auto
    });
}

function classificationToRole(classification: string): RepRole | null {
    switch (classification?.toLowerCase()) {
        case "hot": return "Closer";
        case "warm": return "SDR";
        default: return null; // cold → nurturing, no assignment
    }
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Get the current active assignment for a lead (if any).
 */
export async function getActiveAssignment(assessmentId: string) {
    return (prisma as any).leadAssignment.findFirst({
        where: { assessmentId, status: "active" },
        include: { salesRep: true },
    });
}

/**
 * Get all active assignments for a rep.
 */
export async function getRepAssignments(salesRepId: string) {
    return (prisma as any).leadAssignment.findMany({
        where: { salesRepId, status: "active" },
        include: { assessment: { select: { id: true, company: true, classification: true, status: true } } },
        orderBy: { assignedAt: "desc" },
    });
}
