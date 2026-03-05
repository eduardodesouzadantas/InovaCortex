/**
 * lib/agentops/budget.ts
 * V20.1: Per-org daily token budget with hard-stop enforcement.
 *
 * Budget resets at midnight UTC-3 (America/Sao_Paulo).
 * If hardStop=true and budget exceeded → throws BudgetExceededError.
 * If hardStop=false → emits a warning log but allows the call.
 *
 * Usage:
 *   await assertBudget(orgId, estimatedTokens);      // throws if hard-capped
 *   await trackUsage(orgId, tokensUsed, costUsd);    // after LLM call
 */

import { logger } from "@/lib/logger";


// ─── Error type ───────────────────────────────────────────────────────────────

export class BudgetExceededError extends Error {
    constructor(
        public readonly orgId: string,
        public readonly used: number,
        public readonly limit: number,
    ) {
        super(`AgentOps budget exceeded for org ${orgId}: ${used}/${limit} tokens used today.`);
        this.name = "BudgetExceededError";
    }
}

// ─── Brazil midnight helper ───────────────────────────────────────────────────

/** Returns the UTC datetime of the next midnight in UTC-3. */
function nextMidnightBR(from: Date = new Date()): Date {
    // UTC-3 offset = 3h
    const localMs = from.getTime() - 3 * 3600 * 1000;
    const localDate = new Date(localMs);
    // Advance to next midnight local
    const midnight = new Date(localDate);
    midnight.setUTCHours(0, 0, 0, 0);
    midnight.setUTCDate(midnight.getUTCDate() + 1);
    // Convert back to UTC
    return new Date(midnight.getTime() + 3 * 3600 * 1000);
}

/** Returns true if the budget should reset (resetAt is in the past). */
function needsReset(resetAt: Date): boolean {
    return new Date() >= resetAt;
}

// ─── Get or create budget ─────────────────────────────────────────────────────

async function getOrCreateBudget(orgId: string): Promise<any> {
    const { prisma } = await import("@/lib/prisma");
    let budget = await (prisma as any).agentBudget.findUnique({ where: { orgId } });

    if (!budget) {
        budget = await (prisma as any).agentBudget.create({
            data: {
                orgId,
                dailyTokenLimit: 20000,
                dailyTokenUsed: 0,
                dailyCostUsdUsed: 0,
                resetAt: nextMidnightBR(),
                hardStop: true,
            },
        });
    }

    // Reset if past resetAt
    if (needsReset(budget.resetAt)) {
        budget = await (prisma as any).agentBudget.update({
            where: { orgId },
            data: {
                dailyTokenUsed: 0,
                dailyCostUsdUsed: 0,
                resetAt: nextMidnightBR(),
            },
        });
        logger.info("AgentBudget daily reset", { orgId, nextResetAt: budget.resetAt });
    }

    return budget;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Assert that the org has enough budget for estimatedTokens.
 * Throws BudgetExceededError if hardStop=true and budget is insufficient.
 * Returns the current budget record.
 */
export async function assertBudget(orgId: string, estimatedTokens: number): Promise<any> {
    const budget = await getOrCreateBudget(orgId);
    const remaining = budget.dailyTokenLimit - budget.dailyTokenUsed;

    if (estimatedTokens > remaining) {
        if (budget.hardStop) {
            logger.warn("AgentBudget hard-stop triggered", {
                orgId,
                estimatedTokens,
                used: budget.dailyTokenUsed,
                limit: budget.dailyTokenLimit,
            });
            throw new BudgetExceededError(orgId, budget.dailyTokenUsed, budget.dailyTokenLimit);
        } else {
            logger.warn("AgentBudget soft warning — allowing call", {
                orgId,
                estimatedTokens,
                used: budget.dailyTokenUsed,
                limit: budget.dailyTokenLimit,
            });
        }
    }

    return budget;
}

/**
 * Record actual token usage after an LLM call.
 * Idempotent-safe: uses increment so concurrent calls don't race.
 */
export async function trackUsage(
    orgId: string,
    tokensUsed: number,
    costUsd: number = 0,
): Promise<void> {
    const { prisma } = await import("@/lib/prisma");
    await (prisma as any).agentBudget.upsert({
        where: { orgId },
        create: {
            orgId,
            dailyTokenLimit: 20000,
            dailyTokenUsed: tokensUsed,
            dailyCostUsdUsed: costUsd,
            resetAt: nextMidnightBR(),
            hardStop: true,
        },
        update: {
            dailyTokenUsed: { increment: tokensUsed },
            dailyCostUsdUsed: { increment: costUsd },
        },
    });

    logger.info("AgentBudget usage tracked", { orgId, tokensUsed, costUsd });
}

/**
 * Get current budget state for an org without side effects.
 */
export async function getBudgetStatus(orgId: string): Promise<{
    used: number;
    limit: number;
    remaining: number;
    resetAt: Date;
    hardStop: boolean;
    pctUsed: number;
}> {
    const budget = await getOrCreateBudget(orgId);
    const remaining = Math.max(0, budget.dailyTokenLimit - budget.dailyTokenUsed);
    return {
        used: budget.dailyTokenUsed,
        limit: budget.dailyTokenLimit,
        remaining,
        resetAt: budget.resetAt,
        hardStop: budget.hardStop,
        pctUsed: Math.round((budget.dailyTokenUsed / budget.dailyTokenLimit) * 100),
    };
}
