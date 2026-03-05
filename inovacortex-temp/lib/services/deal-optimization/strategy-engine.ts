export type StrategyInput = {
    adjustedProbability: number;
    expectedRevenue: number;
    tier: "hot" | "warm" | "cold";
    hasProposal: boolean;
    proposalStatus: "draft" | "sent" | "viewed" | "accepted" | "none";
    minutesSinceMeetingEnd: number;
    daysSinceProposalSent: number;
    source: "calendly" | "whatsapp" | "manual";
    pipelineQualityIndex: number;
    isTop20PercentRevenue?: boolean;
};

export type StrategyOutput = {
    followUpTone: "direct" | "consultative" | "educational";
    urgencyLevel: 1 | 2 | 3 | 4 | 5;
    recommendedCTA: "schedule" | "reply_yes" | "review_proposal" | "send_doc" | "soft_nurture";
    proposalStructure: "compact" | "modular" | "aggressive";
    nextActions: Array<{
        type: string;
        priorityDelta: number;
        dueInMinutes?: number;
        reason: string;
    }>;
    rationale: string[];
};

export function decideStrategy(input: StrategyInput): StrategyOutput {
    const {
        adjustedProbability: prob,
        expectedRevenue,
        hasProposal,
        proposalStatus,
        minutesSinceMeetingEnd,
        daysSinceProposalSent,
        isTop20PercentRevenue,
    } = input;

    const rationale: string[] = [];

    // 1) followUpTone
    let followUpTone: StrategyOutput["followUpTone"] = "educational";
    if (prob >= 0.75) {
        followUpTone = "direct";
        rationale.push("Tone set to direct (probability >= 0.75)");
    } else if (prob >= 0.45) {
        followUpTone = "consultative";
        rationale.push("Tone set to consultative (probability between 0.45 and 0.75)");
    } else {
        rationale.push("Tone set to educational (probability < 0.45)");
    }

    // 2) urgencyLevel
    let baseUrgency = 3;

    if (prob >= 0.75) {
        baseUrgency += 1;
        rationale.push("Urgency +1 (probability >= 0.75)");
    }

    if (isTop20PercentRevenue) {
        baseUrgency += 1;
        rationale.push("Urgency +1 (expectedRevenue in top 20%)");
    }

    if (hasProposal && (proposalStatus === "sent" || proposalStatus === "viewed") && daysSinceProposalSent >= 1) { // rule says > 24h, meaning >= 1 day
        baseUrgency += 1;
        rationale.push("Urgency +1 (proposal sent and > 24h without reply)");
    }

    if (prob < 0.45) {
        baseUrgency -= 1;
        rationale.push("Urgency -1 (probability < 0.45)");
    }

    const urgencyLevel = Math.max(1, Math.min(5, baseUrgency)) as StrategyOutput["urgencyLevel"];
    rationale.push(`Urgency level clamped to ${urgencyLevel}`);

    // 3) proposalStructure
    let proposalStructure: StrategyOutput["proposalStructure"] = "compact";
    if (prob >= 0.8 && isTop20PercentRevenue) {
        proposalStructure = "aggressive";
        rationale.push("Structure set to aggressive (prob >= 0.8 and expectedRevenue in top 20%)");
    } else if (prob >= 0.55) {
        proposalStructure = "modular";
        rationale.push("Structure set to modular (prob >= 0.55)");
    } else {
        rationale.push("Structure set to compact (default)");
    }

    // 4) recommendedCTA
    let recommendedCTA: StrategyOutput["recommendedCTA"] = "schedule";
    if (!hasProposal && prob >= 0.55) {
        recommendedCTA = "reply_yes";
        rationale.push("CTA set to reply_yes (gatilho de decisão curta) (!hasProposal and prob >= 0.55)");
    } else if (hasProposal && (proposalStatus === "sent" || proposalStatus === "viewed")) {
        recommendedCTA = "review_proposal";
        rationale.push("CTA set to review_proposal (hasProposal and status sent/viewed)");
    } else if (prob < 0.45) {
        recommendedCTA = "soft_nurture";
        rationale.push("CTA set to soft_nurture (prob < 0.45)");
    } else {
        rationale.push("CTA set to schedule (default)");
    }

    // 5) nextActions
    const nextActions: StrategyOutput["nextActions"] = [];

    if (minutesSinceMeetingEnd > 60 && !hasProposal && prob >= 0.6) {
        nextActions.push({
            type: "generate_proposal",
            priorityDelta: 30,
            dueInMinutes: 0,
            reason: "Timing ideal de proposta"
        });
        rationale.push("Next action: generate_proposal added");
    }

    if (hasProposal && (proposalStatus === "sent" || proposalStatus === "viewed") && daysSinceProposalSent >= 1 && prob >= 0.55) {
        nextActions.push({
            type: "proposal_followup",
            priorityDelta: 25,
            dueInMinutes: 0,
            reason: "Follow-up de proposta"
        });
        rationale.push("Next action: proposal_followup added");
    }

    if (prob >= 0.75 && urgencyLevel >= 4) {
        nextActions.push({
            type: "critical_owner_ping",
            priorityDelta: 40,
            dueInMinutes: 0,
            reason: "High probability + high EV"
        });
        rationale.push("Next action: critical_owner_ping added");
    }

    if (prob < 0.45) {
        nextActions.push({
            type: "nurture_sequence",
            priorityDelta: 10,
            dueInMinutes: 1440,
            reason: "Baixa prob: nutrir sem pressionar"
        });
        rationale.push("Next action: nurture_sequence added");
    }

    return {
        followUpTone,
        urgencyLevel,
        recommendedCTA,
        proposalStructure,
        nextActions,
        rationale
    };
}
