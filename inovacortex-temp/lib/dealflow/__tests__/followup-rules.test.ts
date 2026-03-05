/**
 * lib/dealflow/__tests__/followup-rules.test.ts
 * V21: Unit tests for evaluateFollowUp (pure function, no DB).
 */

import { describe, it, expect, vi } from "vitest";
import { evaluateFollowUp } from "../followup-rules";

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const base = {
    hasViewed: false,
    hasMeetingBooked: false,
    hasNoResponse72h: false,
    hasWhatsappReplied: false,
    lastSignalAt: null,
    hoursSinceViewed: null,
};

describe("evaluateFollowUp", () => {
    it("meeting booked → pause + briefing", () => {
        const { action } = evaluateFollowUp({ ...base, hasMeetingBooked: true, hasViewed: true });
        expect(action).toBe("pause_sequence_send_briefing");
    });

    it("no_response_72h → final followup", () => {
        const { action } = evaluateFollowUp({ ...base, hasNoResponse72h: true });
        expect(action).toBe("send_final_followup");
    });

    it("viewed 25h ago + no meeting → consultive followup immediately", () => {
        const { action, scheduleDelayMs } = evaluateFollowUp({
            ...base,
            hasViewed: true,
            hoursSinceViewed: 25,
        });
        expect(action).toBe("send_consultive_followup");
        expect(scheduleDelayMs).toBe(0);
    });

    it("viewed 10h ago → none (schedule for remaining 14h)", () => {
        const { action, scheduleDelayMs } = evaluateFollowUp({
            ...base,
            hasViewed: true,
            hoursSinceViewed: 10,
        });
        expect(action).toBe("none");
        // Should wait ~14h
        expect(scheduleDelayMs).toBeGreaterThan(13 * 3600 * 1000);
        expect(scheduleDelayMs).toBeLessThan(15 * 3600 * 1000);
    });

    it("meeting booked takes priority over no_response_72h", () => {
        const { action } = evaluateFollowUp({
            ...base,
            hasMeetingBooked: true,
            hasNoResponse72h: true,
        });
        expect(action).toBe("pause_sequence_send_briefing");
    });

    it("no signals → none", () => {
        const { action } = evaluateFollowUp(base);
        expect(action).toBe("none");
    });
});
