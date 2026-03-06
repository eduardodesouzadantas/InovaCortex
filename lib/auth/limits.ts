/**
 * lib/auth/limits.ts
 * V9: Billing plan limits enforcement.
 */

import { prisma } from "@/lib/prisma";

export class LimitExceededError extends Error {
    constructor(public readonly limit: string) {
        super(`Limit exceeded: ${limit}`);
        this.name = "LimitExceededError";
    }
}

/** Returns the start of the current calendar month (UTC) */
function startOfCurrentMonth(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Throws LimitExceededError if the org has reached its monthly assessment limit.
 */
export async function checkAssessmentLimit(orgId: string, maxPerMonth: number): Promise<void> {
    const count = await (prisma as any).assessment.count({
        where: {
            organizationId: orgId,
            createdAt: { gte: startOfCurrentMonth() }
        }
    });

    if (count >= maxPerMonth) {
        throw new LimitExceededError(`maxAssessmentsPerMonth (${maxPerMonth})`);
    }
}

/**
 * Throws LimitExceededError if the org has reached its user limit.
 */
export async function checkUserLimit(orgId: string, maxUsers: number): Promise<void> {
    const count = await (prisma as any).user.count({
        where: { organizationId: orgId }
    });

    if (count >= maxUsers) {
        throw new LimitExceededError(`maxUsers (${maxUsers})`);
    }
}

/**
 * Returns current usage stats for the dashboard.
 */
export async function getOrgUsage(orgId: string) {
    const [assessmentsThisMonth, totalUsers] = await Promise.all([
        (prisma as any).assessment.count({
            where: { organizationId: orgId, createdAt: { gte: startOfCurrentMonth() } }
        }),
        (prisma as any).user.count({ where: { organizationId: orgId } }),
    ]);
    return { assessmentsThisMonth, totalUsers };
}
