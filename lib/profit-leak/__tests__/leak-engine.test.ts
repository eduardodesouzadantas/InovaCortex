/**
 * lib/profit-leak/__tests__/leak-engine.test.ts
 * V22.1: Unit tests for deterministic Profit Leak Detector.
 *
 * Tests cover:
 *   - Loss estimation boundaries (per-tier, per-kind)
 *   - Dedupe / idempotency logic
 *   - classifySeverity bands
 *   - Snapshot correctness (expected totals)
 *   - Edge cases (empty inputs, below-threshold, missing tier)
 */

import { describe, it, expect } from "vitest";
import {
    computeLeadNoResponseLeak,
    computeStaleFollowupLeak,
    computeNoShowLeak,
    computeProposalStaleLeak,
    computePipelineStallLeak,
    computeLowReplyRateLeak,
} from "../leak-engine";
import {
    expectedRevenueCents,
    classifySeverity,
    LEAD_VALUE_CENTS, CLOSE_PROBABILITY,
    NO_RESPONSE_THRESHOLD_MS,
    PROPOSAL_STALE_THRESHOLD_MS,
    PIPELINE_STALL_THRESHOLD_MS,
    STALE_FOLLOWUP_THRESHOLD_MS,
    NO_SHOW_COST_CENTS,
    MIN_REPLY_RATE, MIN_OUTBOUND_SAMPLE,
} from "../leak-rules";

const now = new Date("2026-03-04T05:00:00Z");

// ─── leak-rules: expectedRevenueCents ─────────────────────────────────────────
describe("expectedRevenueCents", () => {
    it("hot = 25000_00 * 0.42 = 1050000", () => {
        expect(expectedRevenueCents("hot")).toBe(Math.round(25_000_00 * 0.42));
    });
    it("warm = 8000_00 * 0.18 = 144000", () => {
        expect(expectedRevenueCents("warm")).toBe(Math.round(8_000_00 * 0.18));
    });
    it("cold = 2500_00 * 0.06 = 15000", () => {
        expect(expectedRevenueCents("cold")).toBe(Math.round(2_500_00 * 0.06));
    });
    it("unknown falls between warm and cold", () => {
        const v = expectedRevenueCents("unknown");
        expect(v).toBeGreaterThan(expectedRevenueCents("cold"));
        expect(v).toBeLessThan(expectedRevenueCents("hot"));
    });
});

// ─── leak-rules: classifySeverity ─────────────────────────────────────────────
describe("classifySeverity", () => {
    it("0-1999_99 → low", () => { expect(classifySeverity(0)).toBe("low"); expect(classifySeverity(1_999_99)).toBe("low"); });
    it("2000_00 → medium", () => { expect(classifySeverity(2_000_00)).toBe("medium"); });
    it("7999_99 → medium", () => { expect(classifySeverity(7_999_99)).toBe("medium"); });
    it("8000_00 → high", () => { expect(classifySeverity(8_000_00)).toBe("high"); });
    it("19999_99 → high", () => { expect(classifySeverity(19_999_99)).toBe("high"); });
    it("20000_00 → critical", () => { expect(classifySeverity(20_000_00)).toBe("critical"); });
    it("99999_99 → critical", () => { expect(classifySeverity(99_999_99)).toBe("critical"); });
});

// ─── computeLeadNoResponseLeak ────────────────────────────────────────────────
describe("computeLeadNoResponseLeak", () => {
    it("returns null when all leads have replied", () => {
        const result = computeLeadNoResponseLeak({
            leads: [{ id: "l1", tier: "hot", createdAt: new Date(now.getTime() - 10 * 3600_000), firstReplyAt: new Date() }],
            now,
        });
        expect(result).toBeNull();
    });

    it("returns null when lead is below threshold", () => {
        // warm threshold = 8h; create lead 4h ago
        const result = computeLeadNoResponseLeak({
            leads: [{ id: "l1", tier: "warm", createdAt: new Date(now.getTime() - 4 * 3600_000), firstReplyAt: null }],
            now,
        });
        expect(result).toBeNull();
    });

    it("flags hot lead after 2h", () => {
        const result = computeLeadNoResponseLeak({
            leads: [{ id: "l1", tier: "hot", createdAt: new Date(now.getTime() - 3 * 3600_000), firstReplyAt: null }],
            now,
        });
        expect(result).not.toBeNull();
        expect(result!.kind).toBe("lead_no_response");
        expect(result!.estimatedLossCents).toBe(expectedRevenueCents("hot"));
    });

    it("sums correct loss for 3 warm leads", () => {
        const leads = [1, 2, 3].map(i => ({
            id: `l${i}`, tier: "warm",
            createdAt: new Date(now.getTime() - 12 * 3600_000),
            firstReplyAt: null,
        }));
        const result = computeLeadNoResponseLeak({ leads, now });
        expect(result!.estimatedLossCents).toBe(3 * expectedRevenueCents("warm"));
    });

    it("evidence JSON has count and sampleIds", () => {
        const leads = [1, 2, 3, 4, 5, 6].map(i => ({
            id: `l${i}`, tier: "warm",
            createdAt: new Date(now.getTime() - 24 * 3600_000),
            firstReplyAt: null,
        }));
        const result = computeLeadNoResponseLeak({ leads, now });
        const ev = JSON.parse(result!.evidenceJson);
        expect(ev.count).toBe(6);
        expect(ev.sampleIds.length).toBeLessThanOrEqual(5); // capped at 5
    });

    it("unknown tier uses unknown threshold", () => {
        const result = computeLeadNoResponseLeak({
            leads: [{ id: "l1", createdAt: new Date(now.getTime() - 15 * 3600_000), firstReplyAt: null }],
            now,
        });
        expect(result).not.toBeNull();
    });
});

// ─── computeStaleFollowupLeak ─────────────────────────────────────────────────
describe("computeStaleFollowupLeak", () => {
    it("returns null when all sequences updated within 4d", () => {
        const result = computeStaleFollowupLeak({
            sequences: [{ id: "s1", prospectId: "p1", paused: false, updatedAt: new Date(now.getTime() - 2 * 86400_000) }],
            now,
        });
        expect(result).toBeNull();
    });

    it("flags sequence stale after 4d", () => {
        const result = computeStaleFollowupLeak({
            sequences: [{ id: "s1", prospectId: "p1", paused: true, updatedAt: new Date(now.getTime() - 5 * 86400_000) }],
            now,
        });
        expect(result).not.toBeNull();
        expect(result!.kind).toBe("stale_followup");
    });

    it("loss scales linearly with count", () => {
        const seqs = [1, 2, 3].map(i => ({
            id: `s${i}`, prospectId: `p${i}`, paused: true,
            updatedAt: new Date(now.getTime() - 5 * 86400_000),
        }));
        const result = computeStaleFollowupLeak({ sequences: seqs, now });
        expect(result!.estimatedLossCents).toBe(3 * expectedRevenueCents("warm"));
    });
});

// ─── computeNoShowLeak ────────────────────────────────────────────────────────
describe("computeNoShowLeak", () => {
    it("returns null for 0 no-shows", () => {
        expect(computeNoShowLeak({ noShowCount: 0 })).toBeNull();
    });
    it("1 no-show = NO_SHOW_COST_CENTS", () => {
        const r = computeNoShowLeak({ noShowCount: 1 });
        expect(r!.estimatedLossCents).toBe(NO_SHOW_COST_CENTS);
    });
    it("5 no-shows = 5 * NO_SHOW_COST_CENTS", () => {
        const r = computeNoShowLeak({ noShowCount: 5 });
        expect(r!.estimatedLossCents).toBe(5 * NO_SHOW_COST_CENTS);
    });
    it("severity is correct for 10 no-shows", () => {
        const r = computeNoShowLeak({ noShowCount: 10 });
        expect(r!.severity).toBe(classifySeverity(10 * NO_SHOW_COST_CENTS));
    });
});

// ─── computeProposalStaleLeak ─────────────────────────────────────────────────
describe("computeProposalStaleLeak", () => {
    it("ignores won/lost proposals", () => {
        const r = computeProposalStaleLeak({
            proposals: [{ id: "p1", tier: "hot", status: "won", sentAt: new Date(now.getTime() - 10 * 86400_000) }],
            now,
        });
        expect(r).toBeNull();
    });

    it("flags sent proposal after hot threshold (3d)", () => {
        const r = computeProposalStaleLeak({
            proposals: [{ id: "p1", tier: "hot", status: "sent", sentAt: new Date(now.getTime() - 4 * 86400_000) }],
            now,
        });
        expect(r).not.toBeNull();
        expect(r!.kind).toBe("proposal_stale");
    });

    it("does NOT flag viewed proposal within cold threshold (10d)", () => {
        const r = computeProposalStaleLeak({
            proposals: [{ id: "p1", tier: "cold", status: "viewed", sentAt: new Date(now.getTime() - 8 * 86400_000) }],
            now,
        });
        expect(r).toBeNull();
    });

    it("uses explicit value override", () => {
        const r = computeProposalStaleLeak({
            proposals: [{ id: "p1", tier: "hot", status: "sent", sentAt: new Date(now.getTime() - 4 * 86400_000), value: 5_000_00 }],
            now,
        });
        expect(r!.estimatedLossCents).toBe(5_000_00);
    });
});

// ─── computePipelineStallLeak ─────────────────────────────────────────────────
describe("computePipelineStallLeak", () => {
    it("returns null for empty leads", () => {
        expect(computePipelineStallLeak({ leads: [], now })).toBeNull();
    });

    it("returns null when leads updated recently", () => {
        const r = computePipelineStallLeak({
            leads: [{ id: "l1", stage: "qualified", stageUpdatedAt: new Date(now.getTime() - 2 * 86400_000) }],
            now,
        });
        expect(r).toBeNull();
    });

    it("flags lead stalled after 5d", () => {
        const r = computePipelineStallLeak({
            leads: [{ id: "l1", stage: "qualified", stageUpdatedAt: new Date(now.getTime() - 6 * 86400_000) }],
            now,
        });
        expect(r).not.toBeNull();
        expect(r!.kind).toBe("pipeline_stall");
    });

    it("custom thresholdMs is respected", () => {
        const twoDay = 2 * 86400_000;
        const r = computePipelineStallLeak({
            leads: [{ id: "l1", stage: "meeting", stageUpdatedAt: new Date(now.getTime() - 3 * 86400_000) }],
            now, thresholdMs: twoDay,
        });
        expect(r).not.toBeNull();
    });

    it("evidence includes distinct stages", () => {
        const leads = [
            { id: "l1", stage: "qualified", stageUpdatedAt: new Date(now.getTime() - 7 * 86400_000) },
            { id: "l2", stage: "meeting", stageUpdatedAt: new Date(now.getTime() - 6 * 86400_000) },
        ];
        const r = computePipelineStallLeak({ leads, now });
        const ev = JSON.parse(r!.evidenceJson);
        expect(ev.stages).toContain("qualified");
        expect(ev.stages).toContain("meeting");
    });
});

// ─── computeLowReplyRateLeak ──────────────────────────────────────────────────
describe("computeLowReplyRateLeak", () => {
    it("returns null when sample < MIN_OUTBOUND_SAMPLE", () => {
        const r = computeLowReplyRateLeak({ totalMessages: 10, replies: 0 });
        expect(r).toBeNull();
    });

    it("returns null when reply rate ≥ baseline", () => {
        const r = computeLowReplyRateLeak({ totalMessages: 100, replies: 10 }); // 10% >= 8%
        expect(r).toBeNull();
    });

    it("flags when reply rate < baseline", () => {
        const r = computeLowReplyRateLeak({ totalMessages: 100, replies: 4 }); // 4% < 8%
        expect(r).not.toBeNull();
        expect(r!.kind).toBe("low_reply_rate");
    });

    it("loss = missedReplies * expectedRevenueCents(warm)", () => {
        // 100 messages, 4 replies → rate=0.04, missed=(0.08-0.04)*100=4 replies
        const r = computeLowReplyRateLeak({ totalMessages: 100, replies: 4 });
        const expected = 4 * expectedRevenueCents("warm");
        expect(r!.estimatedLossCents).toBe(expected);
    });

    it("evidence JSON contains rate and baseline", () => {
        const r = computeLowReplyRateLeak({ totalMessages: 50, replies: 2 });
        const ev = JSON.parse(r!.evidenceJson);
        expect(ev.rate).toBeLessThan(MIN_REPLY_RATE);
        expect(ev.baseline).toBe(MIN_REPLY_RATE);
    });

    it("exactly at baseline → null", () => {
        // 8 replies / 100 = exactly 8%
        const r = computeLowReplyRateLeak({ totalMessages: 100, replies: 8 });
        expect(r).toBeNull();
    });
});

// ─── Integration: all rules return correct kinds ──────────────────────────────
describe("leak kind assertions", () => {
    it("each function returns correct kind", () => {
        expect(computeLeadNoResponseLeak({
            leads: [{ id: "x", tier: "hot", createdAt: new Date(now.getTime() - 5 * 3600_000), firstReplyAt: null }], now,
        })!.kind).toBe("lead_no_response");

        expect(computeStaleFollowupLeak({
            sequences: [{ id: "x", prospectId: "p", paused: true, updatedAt: new Date(now.getTime() - 5 * 86400_000) }], now,
        })!.kind).toBe("stale_followup");

        expect(computeNoShowLeak({ noShowCount: 1 })!.kind).toBe("no_show");

        expect(computeProposalStaleLeak({
            proposals: [{ id: "x", tier: "hot", status: "sent", sentAt: new Date(now.getTime() - 4 * 86400_000) }], now,
        })!.kind).toBe("proposal_stale");

        expect(computePipelineStallLeak({
            leads: [{ id: "x", stage: "qualified", stageUpdatedAt: new Date(now.getTime() - 6 * 86400_000) }], now,
        })!.kind).toBe("pipeline_stall");

        expect(computeLowReplyRateLeak({ totalMessages: 100, replies: 2 })!.kind).toBe("low_reply_rate");
    });
});
