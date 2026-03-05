/**
 * lib/profit-leak/leak-rules.ts
 * V22.1: Deterministic thresholds per lead tier and leak kind.
 *
 * All time values are in MILLISECONDS for direct Date arithmetic.
 * All monetary values are in CENTS (BRL × 100).
 */

// ─── Lead / prospect value estimates by tier ─────────────────────────────────
export const LEAD_VALUE_CENTS = {
    hot: 25_000_00,   // R$ 25.000,00
    warm: 8_000_00,   // R$  8.000,00
    cold: 2_500_00,   // R$  2.500,00
    unknown: 4_000_00, // R$  4.000,00 (fallback)
} as const;

// Probability of closing a lead at each tier
export const CLOSE_PROBABILITY = {
    hot: 0.42,
    warm: 0.18,
    cold: 0.06,
    unknown: 0.12,
} as const;

export type LeadTier = keyof typeof LEAD_VALUE_CENTS;

/** Expected revenue in cents for a given tier. */
export function expectedRevenueCents(tier: LeadTier): number {
    return Math.round(LEAD_VALUE_CENTS[tier] * CLOSE_PROBABILITY[tier]);
}

// ─── Response / contact thresholds ───────────────────────────────────────────
export const NO_RESPONSE_THRESHOLD_MS = {
    hot: 2 * 60 * 60 * 1000,  //  2h
    warm: 8 * 60 * 60 * 1000,  //  8h
    cold: 24 * 60 * 60 * 1000,  // 24h
    unknown: 12 * 60 * 60 * 1000,
} as const;

// ─── Proposal stale thresholds ────────────────────────────────────────────────
export const PROPOSAL_STALE_THRESHOLD_MS = {
    hot: 3 * 24 * 60 * 60 * 1000,  //  3d
    warm: 5 * 24 * 60 * 60 * 1000,  //  5d
    cold: 10 * 24 * 60 * 60 * 1000,  // 10d
    unknown: 7 * 24 * 60 * 60 * 1000,
} as const;

// ─── Pipeline stage stuck threshold ──────────────────────────────────────────
/** How long a lead can sit at a stage before it's considered stalled (ms). */
export const PIPELINE_STALL_THRESHOLD_MS = 5 * 24 * 60 * 60 * 1000; // 5d

// ─── Outbound reply-rate baseline ────────────────────────────────────────────
/** Minimum acceptable reply rate (0-1).  Below this triggers a low_reply_rate leak. */
export const MIN_REPLY_RATE = 0.08; // 8%

/** Minimum sample size before we flag a low reply rate. */
export const MIN_OUTBOUND_SAMPLE = 20;

// ─── No-show cost ────────────────────────────────────────────────────────────
/** Cost of a no-show meeting (opportunity cost per slot, in cents). */
export const NO_SHOW_COST_CENTS = 1_500_00; // R$ 1.500,00

// ─── Severity classification ──────────────────────────────────────────────────
export type LeakSeverity = "low" | "medium" | "high" | "critical";

export function classifySeverity(lossCents: number): LeakSeverity {
    if (lossCents >= 20_000_00) return "critical"; // ≥ R$ 20k
    if (lossCents >= 8_000_00) return "high";     // ≥ R$  8k
    if (lossCents >= 2_000_00) return "medium";   // ≥ R$  2k
    return "low";
}

// ─── Stale follow-up threshold ────────────────────────────────────────────────
/** Sequences paused/stalled for longer than this are flagged (ms). */
export const STALE_FOLLOWUP_THRESHOLD_MS = 4 * 24 * 60 * 60 * 1000; // 4d

// ─── Dedup window — one leak of each kind per org per calendar day ───────────
export const DEDUP_WINDOW_MS = 22 * 60 * 60 * 1000; // 22h (< 1 calendar day)
