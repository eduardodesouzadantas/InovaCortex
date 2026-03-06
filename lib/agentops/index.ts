/**
 * lib/agentops/index.ts
 * V20.1: Barrel export for the AgentOps Foundation layer.
 *
 * Import from here in all callers:
 *   import { registerAgent, assertBudget, makeCacheKey, getCached, setCached } from "@/lib/agentops";
 */

// Registry
export { registerAgent, getAgent, getAllAgents, hasAgent } from "./registry";
export type { AgentContext, AgentDefaults, AgentHandler, AgentRegistration } from "./registry";

// Budget
export { assertBudget, trackUsage, getBudgetStatus, BudgetExceededError } from "./budget";

// Cache
export { makeCacheKey, getCached, setCached, invalidateCacheForOrg, invalidateCacheForAgent } from "./cache";
export type { CacheHit, CacheSetOptions } from "./cache";
