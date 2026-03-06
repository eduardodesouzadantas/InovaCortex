/**
 * lib/agents/repurpose-agent.ts
 * V21: Repurpose Agent — registry wrapper for repurpose-engine.
 */

import { registerAgent } from "@/lib/agentops/registry";
import { repurposeFromPlan } from "@/lib/repurpose/repurpose-engine";
import { logger } from "@/lib/logger";

export interface RepurposeAgentInput {
    orgId: string;
    marketingPlanId: string;
}

registerAgent(
    "repurpose_engine",
    async (input: RepurposeAgentInput, _ctx: any) => {
        logger.info("[RepurposeAgent] Starting", { ...input });
        return repurposeFromPlan(input.orgId, input.marketingPlanId);
    },
    {
        model: "gpt-4o-mini",
        maxTokens: 2000,
        temperature: 0.65,
        cacheEnabled: true,
        fallbackToTemplate: true,
    },
);

export { repurposeFromPlan };
