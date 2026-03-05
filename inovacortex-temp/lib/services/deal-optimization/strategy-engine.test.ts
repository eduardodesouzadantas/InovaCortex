import { describe, it, expect } from "vitest";
import { decideStrategy, StrategyInput } from "./strategy-engine";

describe("Strategy Engine", () => {
    const baseInput: StrategyInput = {
        adjustedProbability: 0.5,
        expectedRevenue: 5000,
        tier: "warm",
        hasProposal: false,
        proposalStatus: "none",
        minutesSinceMeetingEnd: 0,
        daysSinceProposalSent: 0,
        source: "manual",
        pipelineQualityIndex: 0.8,
    };

    describe("1) followUpTone", () => {
        it("should be direct when prob >= 0.75", () => {
            const output = decideStrategy({ ...baseInput, adjustedProbability: 0.8 });
            expect(output.followUpTone).toBe("direct");
        });

        it("should be consultative when 0.45 <= prob < 0.75", () => {
            const output = decideStrategy({ ...baseInput, adjustedProbability: 0.6 });
            expect(output.followUpTone).toBe("consultative");
        });

        it("should be educational when prob < 0.45", () => {
            const output = decideStrategy({ ...baseInput, adjustedProbability: 0.4 });
            expect(output.followUpTone).toBe("educational");
        });
    });

    describe("2) urgencyLevel", () => {
        it("base urgency is 3, +1 for prob >= 0.75 -> 4", () => {
            const output = decideStrategy({ ...baseInput, adjustedProbability: 0.8 });
            expect(output.urgencyLevel).toBe(4);
        });

        it("+1 for expectedRevenue in top 20%", () => {
            const output = decideStrategy({ ...baseInput, isTop20PercentRevenue: true });
            expect(output.urgencyLevel).toBe(4);
        });

        it("+1 if proposal sent and without reply > 24h", () => {
            const output = decideStrategy({
                ...baseInput,
                hasProposal: true,
                proposalStatus: "sent",
                daysSinceProposalSent: 2,
            });
            expect(output.urgencyLevel).toBe(4);
        });

        it("-1 if prob < 0.45 -> 2", () => {
            const output = decideStrategy({ ...baseInput, adjustedProbability: 0.4 });
            expect(output.urgencyLevel).toBe(2);
        });

        it("clamps 1..5", () => {
            const output = decideStrategy({
                ...baseInput,
                adjustedProbability: 0.9,
                isTop20PercentRevenue: true,
                hasProposal: true,
                proposalStatus: "sent",
                daysSinceProposalSent: 2,
            });
            // 3 + 1 (prob) + 1 (rev) + 1 (prop) = 6 -> clamps to 5
            expect(output.urgencyLevel).toBe(5);

            const lowOutput = decideStrategy({
                ...baseInput,
                adjustedProbability: 0.1,
            });
            // 3 - 1 = 2
            expect(lowOutput.urgencyLevel).toBe(2);
        });
    });

    describe("3) proposalStructure", () => {
        it("should be aggressive if prob >= 0.8 and high EV", () => {
            const output = decideStrategy({
                ...baseInput,
                adjustedProbability: 0.85,
                isTop20PercentRevenue: true,
            });
            expect(output.proposalStructure).toBe("aggressive");
        });

        it("should be modular if prob >= 0.55", () => {
            const output = decideStrategy({ ...baseInput, adjustedProbability: 0.6 });
            expect(output.proposalStructure).toBe("modular");
        });

        it("should be compact otherwise", () => {
            const output = decideStrategy({ ...baseInput, adjustedProbability: 0.5 });
            expect(output.proposalStructure).toBe("compact");
        });
    });

    describe("4) recommendedCTA", () => {
        it("reply_yes if !hasProposal and prob >= 0.55", () => {
            const output = decideStrategy({
                ...baseInput,
                hasProposal: false,
                adjustedProbability: 0.6,
            });
            expect(output.recommendedCTA).toBe("reply_yes");
        });

        it("review_proposal if hasProposal and sent/viewed", () => {
            const output = decideStrategy({
                ...baseInput,
                hasProposal: true,
                proposalStatus: "viewed",
            });
            expect(output.recommendedCTA).toBe("review_proposal");
        });

        it("soft_nurture if prob < 0.45", () => {
            const output = decideStrategy({ ...baseInput, adjustedProbability: 0.4 });
            expect(output.recommendedCTA).toBe("soft_nurture");
        });

        it("schedule as default", () => {
            const output = decideStrategy({
                ...baseInput,
                adjustedProbability: 0.5,
                hasProposal: true,
                proposalStatus: "accepted",
            });
            expect(output.recommendedCTA).toBe("schedule");
        });
    });

    describe("5) nextActions", () => {
        it("generates 'generate_proposal' action", () => {
            const output = decideStrategy({
                ...baseInput,
                minutesSinceMeetingEnd: 90,
                hasProposal: false,
                adjustedProbability: 0.65,
            });
            expect(output.nextActions).toContainEqual(
                expect.objectContaining({ type: "generate_proposal" })
            );
        });

        it("generates 'proposal_followup' action", () => {
            const output = decideStrategy({
                ...baseInput,
                hasProposal: true,
                proposalStatus: "sent",
                daysSinceProposalSent: 2,
                adjustedProbability: 0.6,
            });
            expect(output.nextActions).toContainEqual(
                expect.objectContaining({ type: "proposal_followup" })
            );
        });

        it("generates 'critical_owner_ping' action", () => {
            const output = decideStrategy({
                ...baseInput,
                adjustedProbability: 0.8,
                isTop20PercentRevenue: true,
            });
            expect(output.nextActions).toContainEqual(
                expect.objectContaining({ type: "critical_owner_ping" })
            );
        });

        it("generates 'nurture_sequence' action", () => {
            const output = decideStrategy({
                ...baseInput,
                adjustedProbability: 0.3,
            });
            expect(output.nextActions).toContainEqual(
                expect.objectContaining({ type: "nurture_sequence" })
            );
        });
    });
});
