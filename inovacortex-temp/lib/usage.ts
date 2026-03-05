/**
 * lib/usage.ts
 * V10: Usage metering — track all billable events per organization.
 *
 * Usage:
 *   await trackUsage(orgId, "assessmentCreated", 1, { assessmentId });
 *   await trackUsage(orgId, "pdfGenerated", 1, { slug });
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UsageEventType =
    | "assessmentCreated"
    | "dossierGenerated"
    | "pdfGenerated"
    | "proposalGenerated"
    | "presalesGenerated"
    | "limitExceeded";

// ─── Plan Limits (per event type, per month) ──────────────────────────────────

export const PLAN_LIMITS: Record<string, Record<string, number>> = {
    free: {
        assessmentCreated: 10,
        presalesGenerated: 5,
        proposalGenerated: 5,
        pdfGenerated: 20,
        dossierGenerated: 20,
    },
    growth: {
        assessmentCreated: 100,
        presalesGenerated: 50,
        proposalGenerated: 50,
        pdfGenerated: 200,
        dossierGenerated: 200,
    },
    enterprise: {
        assessmentCreated: 9999,
        presalesGenerated: 9999,
        proposalGenerated: 9999,
        pdfGenerated: 9999,
        dossierGenerated: 9999,
    },
};

// ─── Current Month Helper ─────────────────────────────────────────────────────

export function currentMonth(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function startOfCurrentMonth(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// ─── Core Track Function ──────────────────────────────────────────────────────

/**
 * Record a usage event for an organization.
 * Fire-and-forget safe — any DB error is logged but not re-thrown.
 */
export async function trackUsage(
    orgId: string,
    type: UsageEventType,
    quantity: number = 1,
    metadata?: Record<string, unknown>
): Promise<void> {
    try {
        await (prisma as any).usageEvent.create({
            data: {
                organizationId: orgId,
                type,
                quantity,
                metadata: metadata ? JSON.stringify(metadata) : null,
            }
        });
    } catch (e) {
        logger.error("Failed to track usage event", { orgId, type, error: String(e) });
    }
}

// ─── Usage Query Helpers ──────────────────────────────────────────────────────

/**
 * Get the count of a specific event type for an org this month.
 */
export async function getMonthlyCount(orgId: string, type: UsageEventType): Promise<number> {
    const result = await (prisma as any).usageEvent.aggregate({
        where: {
            organizationId: orgId,
            type,
            createdAt: { gte: startOfCurrentMonth() }
        },
        _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
}

/**
 * Check if the org has exceeded their plan limit for a given event type.
 * Throws LimitExceededError if exceeded. Also records a limitExceeded audit event.
 */
export async function checkPlanLimit(
    orgId: string,
    plan: string,
    type: UsageEventType,
): Promise<void> {
    const planLimits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
    const limit = planLimits[type] ?? 9999;
    const current = await getMonthlyCount(orgId, type);

    if (current >= limit) {
        // Record the overflow event
        await trackUsage(orgId, "limitExceeded", 1, { type, limit, current });

        // Also create an AuditEvent for visibility in admin
        try {
            // We don't have assessment context here so pick up any recent one
            const recent = await (prisma as any).assessment.findFirst({
                where: { organizationId: orgId },
                orderBy: { createdAt: "desc" },
            });
            if (recent) {
                await (prisma as any).auditEvent.create({
                    data: {
                        assessmentId: recent.id,
                        organizationId: orgId,
                        action: "limitExceeded",
                        details: JSON.stringify({ type, limit, current, plan }),
                    }
                });
            }
        } catch { /* Silent — don't break the user flow */ }

        const err = new Error(`Limite do plano atingido: ${type} (${current}/${limit})`);
        (err as any).code = "LIMIT_EXCEEDED";
        (err as any).upgrade = plan !== "enterprise";
        throw err;
    }
}

// ─── Monthly Snapshot ─────────────────────────────────────────────────────────

/**
 * Recalculate and upsert the MonthlyUsageSnapshot for a specific month.
 * Called by the admin recalculate endpoint.
 */
export async function recalculateMonthlySnapshot(orgId: string, month: string): Promise<void> {
    const monthStart = new Date(month + "-01T00:00:00.000Z");
    const monthEnd = new Date(
        new Date(monthStart).setUTCMonth(monthStart.getUTCMonth() + 1)
    );

    const events: any[] = await (prisma as any).usageEvent.findMany({
        where: {
            organizationId: orgId,
            createdAt: { gte: monthStart, lt: monthEnd },
            type: { not: "limitExceeded" },
        }
    });

    const counts: Record<string, number> = {};
    for (const ev of events) {
        counts[ev.type] = (counts[ev.type] ?? 0) + ev.quantity;
    }

    await (prisma as any).monthlyUsageSnapshot.upsert({
        where: { organizationId_month: { organizationId: orgId, month } },
        update: {
            assessmentsCount: counts["assessmentCreated"] ?? 0,
            pdfCount: counts["pdfGenerated"] ?? 0,
            proposalCount: counts["proposalGenerated"] ?? 0,
            aiGenerationsCount: counts["presalesGenerated"] ?? 0,
            dossierCount: counts["dossierGenerated"] ?? 0,
        },
        create: {
            organizationId: orgId,
            month,
            assessmentsCount: counts["assessmentCreated"] ?? 0,
            pdfCount: counts["pdfGenerated"] ?? 0,
            proposalCount: counts["proposalGenerated"] ?? 0,
            aiGenerationsCount: counts["presalesGenerated"] ?? 0,
            dossierCount: counts["dossierGenerated"] ?? 0,
        }
    });
}
