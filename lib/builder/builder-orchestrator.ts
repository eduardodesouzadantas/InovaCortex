/**
 * lib/builder/builder-orchestrator.ts
 * V25.3: Builder Review Gate + Autopilot.
 *
 * Adds three action types to the builder flow:
 *   builder_generate_pack   — generate prompt pack artifacts
 *   builder_request_review  — mark run "review", notify owner via WhatsApp
 *   builder_execute         — execute run (autopilot, internal only)
 *
 * Also exports:
 *   logBuilderAudit  — typed audit events for builder actions
 *   notifyOwnerReview — WhatsApp notification with approve/reject links
 */

import { logger } from "@/lib/logger";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { checkBuilderAccess } from "./builder-guard";
import { buildPromptPack, persistPromptPack } from "./prompt-pack";

// ─── Audit event types ────────────────────────────────────────────────────────

export type BuilderAuditEvent =
    | "builderRunCreated"
    | "builderPackGenerated"
    | "builderApproved"
    | "builderRejected"
    | "builderExecuted";

export async function logBuilderAudit(
    orgId: string,
    runId: string,
    event: BuilderAuditEvent,
    meta?: Record<string, unknown>,
): Promise<void> {
    const { prisma } = await import("@/lib/prisma");
    try {
        await (prisma as any).auditEvent.create({
            data: {
                organizationId: orgId,
                action: `builder:${event}`,
                userId: "system",
                resourceType: "build_run",
                resourceId: runId,
                details: meta ? JSON.stringify(meta) : null,
                ipAddress: "system",
            },
        });
    } catch (err: any) {
        logger.warn("[builder-audit] Failed to write audit event", { event, runId, error: err?.message });
    }
}

// ─── WhatsApp review notification ─────────────────────────────────────────────

export interface ReviewNotifyOptions {
    ownerPhone: string;        // E.164 e.g. "5511999998888"
    orgSlug: string;
    runId: string;
    appUrl?: string;        // defaults to NEXT_PUBLIC_APP_URL
}

export async function notifyOwnerReview(opts: ReviewNotifyOptions): Promise<void> {
    const base = opts.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const runUrl = `${base}/org/${opts.orgSlug}/admin/builder`;
    const approveUrl = `${base}/api/org/${opts.orgSlug}/builder/run/${opts.runId}/approve`;
    const rejectUrl = `${base}/api/org/${opts.orgSlug}/builder/run/${opts.runId}/reject`;

    const body =
        `🤖 *Builder Autopilot — Revisão Necessária*

Um novo build pack está aguardando sua aprovação.

*Run ID:* \`${opts.runId}\`
*Organização:* ${opts.orgSlug}

👉 Ver detalhes: ${runUrl}

━━━━━━━━━━━━━━━━━━━━
✅ *Aprovar:*
${approveUrl}

❌ *Rejeitar:*
${rejectUrl}
━━━━━━━━━━━━━━━━━━━━

Este link expira em 24h. Responda por aqui ou acesse o sistema.`;

    const result = await sendWhatsAppMessage(opts.ownerPhone, body);
    if (result.stub) {
        logger.info("[builder] WhatsApp notification stubbed (not configured)", { runId: opts.runId });
    } else if (result.error) {
        logger.error("[builder] WhatsApp notification failed", { runId: opts.runId, error: result.error });
    }
}

// ─── Action: builder_generate_pack ───────────────────────────────────────────

export async function actionGeneratePack(
    orgSlug: string,
    runId: string,
    orgId: string,
    role: string,
): Promise<{ ok: boolean; partCount?: number; error?: string }> {
    const guard = await checkBuilderAccess(orgSlug, role);
    if (!guard.allowed) return { ok: false, error: "Access denied" };

    const { prisma } = await import("@/lib/prisma");

    const run = await (prisma as any).buildRun.findUnique({
        where: { id: runId },
        include: { artifacts: true },
    });
    if (!run) return { ok: false, error: "Run not found" };
    if (run.orgId !== orgId) return { ok: false, error: "Org mismatch" };

    // Parse input snapshot + compile blueprint
    let inputData: any = {};
    try { inputData = JSON.parse(run.inputJson); } catch { }

    // Build a lightweight minimal snapshot from inputJson (no DB round-trip required)
    const { compileBlueprint, selectTemplates, tierFromScore } = await import("./blueprint-engine");
    const snap = buildSnapFromInput(inputData, orgId);
    const templates = selectTemplates(snap);
    const blueprint = compileBlueprint(templates, snap);

    // Generate prompt pack
    const pack = buildPromptPack(blueprint, { orgSlug, maxParts: 6, includeTests: true });
    await persistPromptPack(pack, runId, orgId);

    await logBuilderAudit(orgId, runId, "builderPackGenerated", { parts: pack.parts.length, checksum: blueprint._checksum });

    return { ok: true, partCount: pack.parts.length };
}

// ─── Action: builder_request_review ───────────────────────────────────────────

export async function actionRequestReview(
    orgSlug: string,
    runId: string,
    orgId: string,
    role: string,
    ownerPhone?: string,
): Promise<{ ok: boolean; error?: string }> {
    const guard = await checkBuilderAccess(orgSlug, role);
    if (!guard.allowed) return { ok: false, error: "Access denied" };

    const { prisma } = await import("@/lib/prisma");

    const run = await (prisma as any).buildRun.findUnique({ where: { id: runId } });
    if (!run) return { ok: false, error: "Run not found" };
    if (run.orgId !== orgId) return { ok: false, error: "Org mismatch" };

    // Transition status → review (if not already)
    if (run.status !== "review") {
        await (prisma as any).buildRun.update({
            where: { id: runId },
            data: { status: "review", updatedAt: new Date() },
        });
    }

    // WhatsApp notification (optional — if ownerPhone provided or fetched from org)
    const phone = ownerPhone ?? await resolveOwnerPhone(orgId);
    if (phone) {
        await notifyOwnerReview({ ownerPhone: phone, orgSlug, runId });
    } else {
        logger.info("[builder] No owner phone — skipping WhatsApp notification", { runId });
    }

    await logBuilderAudit(orgId, runId, "builderPackGenerated", { status: "review", notified: !!phone });

    return { ok: true };
}

// ─── Action: builder_execute (autopilot) ──────────────────────────────────────

export async function actionExecute(
    orgSlug: string,
    runId: string,
    orgId: string,
    role: string,
): Promise<{ ok: boolean; error?: string }> {
    const guard = await checkBuilderAccess(orgSlug, role);
    if (!guard.allowed) return { ok: false, error: "Access denied — internal only" };

    // Autopilot gate: requires AI_AUTOPILOT_BUILDER=true in env
    const autopilotEnabled = process.env.AI_AUTOPILOT_BUILDER === "true";
    if (!autopilotEnabled) {
        return { ok: false, error: "Autopilot not enabled (AI_AUTOPILOT_BUILDER != true)" };
    }

    const { prisma } = await import("@/lib/prisma");

    const run = await (prisma as any).buildRun.findUnique({ where: { id: runId } });
    if (!run) return { ok: false, error: "Run not found" };
    if (run.status !== "approved") return { ok: false, error: `Cannot execute — status is "${run.status}" (must be "approved")` };

    await (prisma as any).buildRun.update({
        where: { id: runId },
        data: { status: "executing", updatedAt: new Date() },
    });

    // Stub: real execution would enqueue build jobs; here we mark done
    await (prisma as any).buildRun.update({
        where: { id: runId },
        data: { status: "done", updatedAt: new Date() },
    });

    await logBuilderAudit(orgId, runId, "builderExecuted", { autopilot: true });

    return { ok: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveOwnerPhone(orgId: string): Promise<string | null> {
    try {
        const { prisma } = await import("@/lib/prisma");
        const member = await (prisma as any).organizationMember.findFirst({
            where: { organizationId: orgId, role: "owner" },
            include: { user: { select: { phone: true } } },
        }).catch(() => null);
        return (member?.user?.phone as string | null) ?? null;
    } catch { return null; }
}

/** Null prisma placeholder — guard uses lazy prisma import internally */
const prismaPlaceholder: any = null;

/** Build a minimal InputSnapshot from inputJson without a DB round-trip */
function buildSnapFromInput(input: any, orgId: string): import("./blueprint-engine").InputSnapshot {
    const channels = Array.isArray(input.channels) ? input.channels : [];
    const cLow = channels.map((c: string) => c.toLowerCase());
    const stack = Array.isArray(input.stack) ? input.stack : [];
    const sLow = stack.map((s: string) => s.toLowerCase());
    const scoreTotal: number = input.scoreTotal ?? 50;
    const { tierFromScore } = require("./blueprint-engine");

    return {
        orgId,
        assessmentId: input.assessmentId ?? null,
        proposalId: input.proposalId ?? null,
        workspaceId: input.workspaceId ?? null,
        snapshotAt: new Date().toISOString(),
        company: input.company ?? "Unknown",
        segment: input.segment ?? "Outros",
        industry: (input.industry ?? "service") as any,
        teamSize: input.teamSize ?? "-",
        volumeDay: input.volumeDay ?? "-",
        scoreTotal,
        tier: tierFromScore(scoreTotal),
        missions: Array.isArray(input.missions) ? input.missions : ["Automação Operacional Básica"],
        channels,
        hasWhatsApp: cLow.some((c: string) => c.includes("whatsapp")),
        hasInstagram: cLow.some((c: string) => c.includes("instagram")),
        hasLinkedIn: cLow.some((c: string) => c.includes("linkedin")),
        hasEmail: cLow.some((c: string) => c.includes("email")),
        hasCRM: sLow.some((s: string) => ["crm", "hubspot", "rd", "pipedrive", "salesforce"].some((k: string) => s.includes(k))),
        hasERP: sLow.some((s: string) => ["erp", "sap", "totvs", "bling", "omie"].some((k: string) => s.includes(k))),
        hasAutomation: sLow.some((s: string) => ["make", "zapier", "n8n"].some((k: string) => s.includes(k))),
        hasAPI: sLow.some((s: string) => s.includes("api")),
        urgency: (input.urgency === "high" || input.urgency === "medium") ? input.urgency : "low",
        proposedModules: Array.isArray(input.modules) ? input.modules : [],
        estimatedBudget: "unknown",
    };
}
