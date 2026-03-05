import crypto from "crypto";
import { PlaybookContext, PlaybookTarget, StepPlan } from "./registry";

export function computeActionHash(input: string) {
    return crypto.createHash("sha256").update(input).digest("hex");
}

export type PolicyDecision =
    | { ok: true; requiresApproval: boolean; reason?: string }
    | { ok: false; reason: string; pendingRemediation?: boolean };

export async function evaluatePolicy(ctx: PlaybookContext, args: {
    orgId: string;
    playbookId: string;
    approvalMode: "auto" | "requires_admin" | "requires_owner";
    policy: any;
    target: PlaybookTarget;
    step: StepPlan;
}): Promise<PolicyDecision> {
    const { policy, approvalMode, step, target, orgId } = args;

    // 1) Safe hours
    const withinSafeHours = await ctx.time.withinOrgSafeHours(orgId, policy?.safeHours);
    if (!withinSafeHours) return { ok: false, reason: "Outside safe hours" };

    // 2) Hard limits
    const dayCount = await ctx.limits.countOrgActionsToday(orgId);
    if (policy?.maxActionsPerDay && dayCount >= policy.maxActionsPerDay) {
        return { ok: false, reason: "Org daily limit reached" };
    }

    if (target?.contactId && policy?.maxPerContactPerDay) {
        const contactCount = await ctx.limits.countContactActionsToday(orgId, target.contactId);
        if (contactCount >= policy.maxPerContactPerDay) {
            return { ok: false, reason: "Contact daily limit reached" };
        }
    }

    // 3) Cooldown
    if (policy?.cooldownHours) {
        const last = await ctx.limits.lastOrgActionAt(orgId);
        if (last && ctx.time.hoursSince(last) < policy.cooldownHours) {
            return { ok: false, reason: "Global cooldown active" };
        }
    }

    // 4) WhatsApp rules
    if (step.channel === "whatsapp") {
        const hasOptIn = await ctx.whatsapp.hasOptIn(target.contactId);
        if (!hasOptIn) return { ok: false, reason: "WhatsApp opt-in missing" };

        const inside24h = await ctx.whatsapp.isInside24hWindow(target.waConversationId);

        if (!inside24h && step.actionType === "wa_send_text") {
            return { ok: false, reason: "Outside 24h window: template required" };
        }

        if (!inside24h && step.actionType === "wa_send_template") {
            const approvedTemplate = await ctx.whatsapp.isApprovedTemplate(step.payload?.templateKey);
            if (!approvedTemplate) {
                // Explicit fallback for V41: 24h template block logs as pending remediation, so we don't just "die" silently
                return { ok: false, reason: "Template not approved for 24h window recovery", pendingRemediation: true };
            }
        }
    }

    // 5) ApprovalMode enforcement
    const stepNeedsApproval = step.requiresApproval || approvalMode !== "auto";
    if (stepNeedsApproval) {
        return { ok: true, requiresApproval: true, reason: "Approval required by mode/step" };
    }

    return { ok: true, requiresApproval: false };
}
