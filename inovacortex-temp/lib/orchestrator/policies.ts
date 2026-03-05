import { ActionPayload, OrchestratorContext, PolicyResult } from "./types";

/**
 * Checks if an action is allowed, blocked, or requires review 
 * based on hardcoded system rules (spam, external, internal).
 */
export async function evaluatePolicies(action: ActionPayload, ctx: OrchestratorContext): Promise<PolicyResult[]> {
    const results: PolicyResult[] = [];

    // Rule 1: Allowlist checking
    const EXTERNAL_ACTIONS = ["send_whatsapp", "publish_content", "send_proposal"];
    const INTERNAL_ACTIONS = ["generate_presales", "generate_proposal", "start_sequence", "nudge_workspace"];

    if (EXTERNAL_ACTIONS.includes(action.type)) {
        results.push({
            policyName: "ExternalActionPolicy",
            decision: "review",
            explanation: "Ações que impactam clientes externos exigem revisão e aprovação humana."
        });
    } else if (INTERNAL_ACTIONS.includes(action.type)) {
        results.push({
            policyName: "InternalActionPolicy",
            decision: "allow",
            explanation: "Ações internas são permitidas em auto-pilot."
        });
    } else {
        results.push({
            policyName: "UnknownActionPolicy",
            decision: "block",
            explanation: `Tipo de ação desconhecida: ${action.type}`
        });
    }

    // Rule 2: Anti-Spam (Mocked Logic)
    if (action.type === "send_whatsapp") {
        const payload = action.payloadJson || {};
        const textLength = payload.messageBody?.length || 0;

        if (textLength > 1000) {
            results.push({
                policyName: "SpamPolicy",
                decision: "block",
                explanation: "Mensagem de WhatsApp excede 1000 caracteres (Risco de Spam)."
            });
        }
    }

    // Rule 3: Limits Evaluation (Example: Org limits, cooldowns)
    // Could check DB here if action is rapid fired. For now, assumes OK.

    if (results.length === 0) {
        results.push({
            policyName: "DefaultPolicy",
            decision: "allow",
            explanation: "No specific rules applied, passed default."
        });
    }

    return results;
}
