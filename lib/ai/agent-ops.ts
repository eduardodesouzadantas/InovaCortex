/**
 * lib/ai/agent-ops.ts
 * Operations for AI agents, including budget and usage tracking.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Check and manage per-org daily token/cost budget.
 * Resets at midnight UTC-3 (Brazil).
 */
export async function checkAgentBudget(orgId: string, agentName: string) {
    // 1. Get or create budget for org
    let budget = await (prisma as any).agentBudget.findUnique({
        where: { orgId }
    });

    if (!budget) {
        budget = await (prisma as any).agentBudget.create({
            data: { orgId, dailyTokenLimit: 50000, hardStop: true }
        });
    }

    // 2. Check reset time (midnight UTC-3)
    const now = new Date();
    // Simple reset if different day (for SQLite/Dev)
    if (new Date(budget.resetAt).getDate() !== now.getDate()) {
        budget = await (prisma as any).agentBudget.update({
            where: { id: budget.id },
            data: {
                dailyTokenUsed: 0,
                dailyCostUsdUsed: 0,
                resetAt: now,
            }
        });
    }

    // 3. Enforcement
    const isExceeded = budget.dailyTokenUsed >= budget.dailyTokenLimit;
    if (isExceeded && budget.hardStop) {
        logger.error("Agent budget exceeded", { orgId, agentName, limit: budget.dailyTokenLimit });
    }

    return {
        ...budget,
        isExceeded,
    };
}
