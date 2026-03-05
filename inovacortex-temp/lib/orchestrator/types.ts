export type ActionPriority = "critical" | "high" | "medium" | "low";
export type ActionStatus = "pending" | "review_required" | "approved" | "executed" | "rejected" | "expired";
export type DecisionType = "allow" | "block" | "review";

export interface OrchestratorContext {
    orgId: string;
    userId?: string;
    [key: string]: any;
}

export interface ActionPayload {
    type: string;
    priority?: ActionPriority;
    payloadJson: any;
    relatedEntityType?: string;
    relatedEntityId?: string;
    approvalRequired?: boolean;
}

export interface AgentRunInfo {
    agentName: string;
    inputHash: string;
    inputJson: any;
    relatedEntityType?: string;
    relatedEntityId?: string;
}

export interface PolicyResult {
    policyName: string;
    decision: DecisionType;
    explanation: string;
}

export interface ReviewResult {
    approved: boolean;
    approvalRequired: boolean;
    riskFlags: string[];
    suggestedEdits?: any;
    finalDraft?: any;
}

export interface AgentImplementation {
    name: string;
    run: (input: any, ctx: OrchestratorContext) => Promise<{ success: boolean; data?: any; error?: string; tokensIn?: number; tokensOut?: number; costUsd?: number }>;
}
