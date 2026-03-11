/**
 * lib/funnel-sequence.ts
 * R3: Funnel automation sequence engine.
 *
 * Core state machine for the high-ticket funnel:
 *   Post → Diagnóstico → WhatsApp → Agendamento → Proposta → Follow-up
 *
 * Responsibilities:
 * - Start a sequence for a lead (idempotent via assessmentId @unique)
 * - Enforce cooldown (no spam)
 * - Select the right message template for stage + score tier
 * - Send via WhatsApp API
 * - Track delivery status per step
 * - Emit AuditEvents at each state change
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { getBaseUrl } from "@/lib/runtime/base-url";
import {
    computeScoreTier,
    selectTemplate,
    renderTemplate,
    nextStage,
    type FunnelStage,
    type ScoreTier,
    type TemplateVars,
} from "@/lib/funnel-templates";

// ─── Start Sequence ───────────────────────────────────────────────────────────

/**
 * Create a LeadSequence for an assessment (idempotent).
 * Should be called after assessment.whatsapp is confirmed.
 */
export async function startSequence(
    assessmentId: string,
    orgId: string,
): Promise<{ sequence: any; created: boolean }> {
    // Idempotency — assessmentId is @unique
    const existing = await (prisma as any).leadSequence.findUnique({
        where: { assessmentId }
    });
    if (existing) {
        logger.info("Sequence already exists — skipping", { assessmentId, sequenceId: existing.id });
        return { sequence: existing, created: false };
    }

    const assessment = await (prisma as any).assessment.findUnique({
        where: { id: assessmentId }
    });
    if (!assessment) throw new Error(`Assessment not found: ${assessmentId}`);

    const phone = assessment.whatsapp ?? assessment.phone ?? "";
    const scoreTier = computeScoreTier(assessment.scoreTotal ?? 0);

    const sequence = await (prisma as any).leadSequence.create({
        data: {
            organizationId: orgId,
            assessmentId,
            phone,
            scoreTier,
            status: "active",
            currentStage: "post_click",
        }
    });

    // Audit
    await (prisma as any).auditEvent.create({
        data: {
            assessmentId,
            organizationId: orgId,
            action: "sequenceStarted",
            details: JSON.stringify({ sequenceId: sequence.id, scoreTier, phone }),
        }
    });

    logger.info("Lead sequence started", { sequenceId: sequence.id, scoreTier, assessmentId, orgId });
    return { sequence, created: true };
}

// ─── Cooldown Check ───────────────────────────────────────────────────────────

export function isInCooldown(sequence: any): boolean {
    if (!sequence.nextAllowedAt) return false;
    return new Date() < new Date(sequence.nextAllowedAt);
}

export function cooldownRemainingHours(sequence: any): number {
    if (!sequence.nextAllowedAt) return 0;
    const diff = new Date(sequence.nextAllowedAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 3600000));
}

// ─── Send Next Step ───────────────────────────────────────────────────────────

export interface SendStepOptions {
    orgSlug?: string;
    closerName?: string;
    dossierLink?: string;
    proposalLink?: string;
    slotsLeft?: number;
    forceStage?: FunnelStage;  // Override stage (e.g. for urgency message)
}

export async function sendNextStep(
    sequenceId: string,
    opts: SendStepOptions = {},
): Promise<{ sent: boolean; step?: any; reason?: string }> {
    const sequence = await (prisma as any).leadSequence.findUnique({
        where: { id: sequenceId }
    });

    if (!sequence) throw new Error(`Sequence not found: ${sequenceId}`);
    if (sequence.status !== "active") return { sent: false, reason: `Sequence is ${sequence.status}` };

    // Cooldown guard
    if (isInCooldown(sequence)) {
        const hours = cooldownRemainingHours(sequence);
        logger.info("Sequence in cooldown — skipping", { sequenceId, hoursRemaining: hours });
        return { sent: false, reason: `In cooldown (${hours}h remaining)` };
    }

    // Determine stage and template
    const targetStage = opts.forceStage ?? (nextStage(sequence.currentStage as FunnelStage) ?? sequence.currentStage);
    const template = selectTemplate(targetStage, sequence.scoreTier as ScoreTier);

    // Load assessment for personalization
    const assessment = await (prisma as any).assessment.findUnique({
        where: { id: sequence.assessmentId }
    });
    const roi = assessment
        ? await (prisma as any).roiProjection.findUnique({ where: { assessmentId: assessment.id } })
        : null;

    const vars: TemplateVars = {
        firstName: extractFirstName(assessment?.contactName ?? assessment?.company ?? ""),
        company: assessment?.company ?? "",
        score: assessment?.scoreTotal ?? 0,
        savings: roi ? formatMoney(roi.operationalSavingsEstimate / 12) : "0",
        hours: roi ? Math.round(roi.monthlyHoursRecovered) : 0,
        payback: roi?.estimatedPaybackMonths ?? null,
        closer: opts.closerName ?? "Equipe InovaCortex",
        dossierLink: opts.dossierLink ?? `${getBaseUrl()}/diagnostico/${assessment?.publicSlug ?? ""}`,
        proposalLink: opts.proposalLink ?? "",
        slotsLeft: opts.slotsLeft ?? 2,
    };

    const messageBody = renderTemplate(template, vars);

    // Create step record
    const step = await (prisma as any).sequenceStep.create({
        data: {
            sequenceId,
            stage: targetStage,
            channel: "whatsapp",
            templateKey: template.key,
            messageBody,
            scoreTier: sequence.scoreTier,
            status: "pending",
        }
    });

    // Send via WhatsApp
    const { messageId, stub, error } = await sendWhatsAppMessage(sequence.phone, messageBody);

    const now = new Date();
    const sentOk = !error;
    const nextAllowed = new Date(now.getTime() + template.cooldownHours * 3600000);

    // Update step delivery status
    await (prisma as any).sequenceStep.update({
        where: { id: step.id },
        data: {
            status: sentOk ? "sent" : "bounced",
            sentAt: sentOk ? now : null,
            waMessageId: messageId ?? null,
        }
    });

    // Advance sequence stage and cooldown
    await (prisma as any).leadSequence.update({
        where: { id: sequenceId },
        data: {
            currentStage: targetStage,
            lastMessageAt: now,
            nextAllowedAt: nextAllowed,
            updatedAt: now,
        }
    });

    // Audit
    await (prisma as any).auditEvent.create({
        data: {
            assessmentId: sequence.assessmentId,
            organizationId: sequence.organizationId,
            action: "sequenceStepSent",
            details: JSON.stringify({
                sequenceId, stepId: step.id, stage: targetStage,
                templateKey: template.key, stub, sentOk, waMessageId: messageId,
            }),
        }
    });

    logger.info("Sequence step sent", {
        sequenceId, stage: targetStage, template: template.key,
        stub, orgId: sequence.organizationId,
    });

    return { sent: sentOk, step };
}

// ─── Mark Step Result ─────────────────────────────────────────────────────────

export async function markStepResult(
    stepId: string,
    result: "delivered" | "read" | "replied" | "bounced",
    waMessageId?: string,
): Promise<void> {
    const now = new Date();
    const data: any = { status: result };
    if (result === "delivered") data.deliveredAt = now;
    if (result === "replied") data.repliedAt = now;
    if (waMessageId) data.waMessageId = waMessageId;

    await (prisma as any).sequenceStep.update({
        where: { id: stepId },
        data,
    });

    // If replied — mark sequence as potentially converted
    if (result === "replied") {
        const step = await (prisma as any).sequenceStep.findUnique({
            where: { id: stepId },
            select: { sequenceId: true },
        });
        if (step) {
            await (prisma as any).leadSequence.update({
                where: { id: step.sequenceId },
                data: { currentStage: "schedule_pending" },
            });
        }
    }
}

// ─── Sequence Control ─────────────────────────────────────────────────────────

export async function pauseSequence(sequenceId: string): Promise<void> {
    await (prisma as any).leadSequence.update({
        where: { id: sequenceId },
        data: { status: "paused", updatedAt: new Date() },
    });
}

export async function resumeSequence(sequenceId: string): Promise<void> {
    await (prisma as any).leadSequence.update({
        where: { id: sequenceId },
        data: { status: "active", nextAllowedAt: null, updatedAt: new Date() },
    });
}

export async function markConverted(sequenceId: string): Promise<void> {
    await (prisma as any).leadSequence.update({
        where: { id: sequenceId },
        data: { status: "completed", currentStage: "converted", convertedAt: new Date() },
    });
}

export async function markOptedOut(sequenceId: string): Promise<void> {
    await (prisma as any).leadSequence.update({
        where: { id: sequenceId },
        data: { status: "opted_out", optedOutAt: new Date() },
    });
}

// ─── Conversion Metrics ───────────────────────────────────────────────────────

export interface FunnelMetrics {
    total: number;
    active: number;
    paused: number;
    converted: number;
    optedOut: number;
    conversionRate: number;  // percentage
    byStage: Record<string, number>;
    byTier: Record<string, { total: number; converted: number }>;
    messagesSent: number;
    messagesDelivered: number;
    replied: number;
}

export async function getFunnelMetrics(orgId: string): Promise<FunnelMetrics> {
    const [sequences, steps] = await Promise.all([
        (prisma as any).leadSequence.findMany({
            where: { organizationId: orgId },
            select: { status: true, currentStage: true, scoreTier: true },
        }),
        (prisma as any).sequenceStep.findMany({
            where: { sequence: { organizationId: orgId } },
            select: { status: true },
        }),
    ]);

    const total = sequences.length;
    const converted = sequences.filter((s: any) => s.status === "completed").length;

    const byStage: Record<string, number> = {};
    const byTier: Record<string, { total: number; converted: number }> = {};

    for (const s of sequences) {
        byStage[s.currentStage] = (byStage[s.currentStage] ?? 0) + 1;
        if (!byTier[s.scoreTier]) byTier[s.scoreTier] = { total: 0, converted: 0 };
        byTier[s.scoreTier].total++;
        if (s.status === "completed") byTier[s.scoreTier].converted++;
    }

    return {
        total,
        active: sequences.filter((s: any) => s.status === "active").length,
        paused: sequences.filter((s: any) => s.status === "paused").length,
        converted,
        optedOut: sequences.filter((s: any) => s.status === "opted_out").length,
        conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
        byStage,
        byTier,
        messagesSent: steps.filter((s: any) => s.status !== "pending").length,
        messagesDelivered: steps.filter((s: any) => ["delivered", "read", "replied"].includes(s.status)).length,
        replied: steps.filter((s: any) => s.status === "replied").length,
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractFirstName(full: string): string {
    return full.trim().split(/\s+/)[0] ?? full;
}

function formatMoney(value: number): string {
    return Math.round(value).toLocaleString("pt-BR");
}
