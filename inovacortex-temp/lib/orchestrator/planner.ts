import { ActionPayload, OrchestratorContext } from "./types";

/**
 * Central Planner Agent
 * Decides the next best actions based on leads and org context.
 * In STUB mode, deterministically generates mock actions based on score.
 */
export async function runPlannerAgent(ctx: OrchestratorContext): Promise<ActionPayload[]> {
    const isStubMode = process.env.AI_MODE !== "real";

    if (isStubMode) {
        return runPlannerStub(ctx);
    }

    // V16: Real OpenAI Planner logic
    return [];
}

function runPlannerStub(ctx: OrchestratorContext): ActionPayload[] {
    const actions: ActionPayload[] = [];

    // Simplistic stub logic logic:
    // If there is recent context passed, emit generic actions.
    const recentLeads = ctx.recentLeads || [];

    for (const lead of recentLeads) {
        if (lead.scoreTotal >= 80) {
            actions.push({
                type: "start_sequence",
                priority: "high",
                relatedEntityType: "assessment",
                relatedEntityId: lead.id,
                payloadJson: { templateKey: "hot_lead_welcome" }
            });
        }
    }

    if (actions.length === 0) {
        actions.push({
            type: "generate_presales",
            priority: "medium",
            payloadJson: { instruction: "Gerar rascunhos diários para revisão" }
        });
    }

    return actions;
}
