/**
 * lib/agentops/budget-error.ts
 * V20.1: BudgetExceededError class — ZERO external imports.
 * Importable directly in vitest without path alias resolution.
 */

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
