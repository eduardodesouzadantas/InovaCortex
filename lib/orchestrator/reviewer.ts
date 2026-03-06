import { ActionPayload, OrchestratorContext, ReviewResult } from "./types";

/**
 * Review Gate (QA Agent)
 * In STUB mode, deterministically approves or flags without OpenAI.
 */
export async function runReviewerAgent(action: ActionPayload, ctx: OrchestratorContext): Promise<ReviewResult> {
    const isStubMode = process.env.AI_MODE !== "real";

    if (isStubMode) {
        return runReviewerStub(action);
    }

    // V16: Real OpenAI Call goes here.
    return {
        approved: false,
        approvalRequired: true,
        riskFlags: ["Modo real (OpenAI) ainda não implementado. Retornando para revisão humana."],
    };
}

function runReviewerStub(action: ActionPayload): ReviewResult {
    // Stub heuristics
    if (action.type === "send_whatsapp") {
        const text = action.payloadJson?.messageBody || "";
        if (text.toLowerCase().includes("garantido")) {
            return {
                approved: false,
                approvalRequired: true,
                riskFlags: ["Promessa forte demais: uso da palavra 'garantido'"],
                suggestedEdits: { messageBody: text.replace(/garantido/gi, "esperado") }
            };
        }
        return {
            approved: false, // External actions always review_required per V15 rules
            approvalRequired: true,
            riskFlags: [],
        };
    }

    if (action.type === "publish_content") {
        return {
            approved: false,
            approvalRequired: true,
            riskFlags: []
        };
    }

    // Default for internal actions: auto-approve
    return {
        approved: true,
        approvalRequired: false,
        riskFlags: []
    };
}
