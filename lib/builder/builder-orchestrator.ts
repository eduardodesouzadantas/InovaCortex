import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { writeAuditEvent } from "@/lib/audit";
import { getBaseUrl } from "@/lib/runtime/base-url";
import { checkBuilderAccess } from "./builder-guard";
import { buildPromptPack, persistPromptPack } from "./prompt-pack";
import {
    compileBlueprint,
    selectTemplates,
    tierFromScore,
    type Industry,
    type InputSnapshot,
    type Mission,
} from "./blueprint-engine";

export type BuilderAuditEvent =
    | "builderRunCreated"
    | "builderPackGenerated"
    | "builderApproved"
    | "builderRejected"
    | "builderExecuted";

export interface ReviewNotifyOptions {
    ownerPhone: string;
    orgSlug: string;
    runId: string;
    appUrl?: string;
}

type BuilderInput = {
    assessmentId?: string | null;
    proposalId?: string | null;
    workspaceId?: string | null;
    company?: string;
    segment?: string;
    industry?: string;
    teamSize?: string;
    volumeDay?: string;
    scoreTotal?: number;
    urgency?: string;
    channels?: string[];
    stack?: string[];
    missions?: string[];
    modules?: string[];
};

const DEFAULT_MISSION = "AutomaÃ§Ã£o Operacional BÃ¡sica" as Mission;

function parseBuilderInput(inputJson: string): BuilderInput {
    try {
        const parsed = JSON.parse(inputJson) as unknown;
        return typeof parsed === "object" && parsed !== null ? parsed as BuilderInput : {};
    } catch {
        return {};
    }
}

function normalizeStringArray(values: string[] | undefined): string[] {
    return Array.isArray(values) ? values.filter((value) => typeof value === "string" && value.trim().length > 0) : [];
}

function toIndustry(value: string | undefined): Industry {
    const normalized = (value ?? "").trim().toLowerCase();
    switch (normalized) {
        case "saas":
        case "clinic":
        case "ecommerce":
        case "service":
        case "education":
        case "other":
            return normalized as Industry;
        default:
            return "service";
    }
}

function toUrgency(value: string | undefined): InputSnapshot["urgency"] {
    const normalized = (value ?? "").trim().toLowerCase();
    switch (normalized) {
        case "high":
        case "medium":
            return normalized as "high" | "medium";
        default:
            return "low";
    }
}

function toMissions(values: string[] | undefined): Mission[] {
    const normalized = normalizeStringArray(values);
    return normalized.length ? (normalized as Mission[]) : [DEFAULT_MISSION];
}

function buildSnapFromInput(input: BuilderInput, orgId: string): InputSnapshot {
    const channels = normalizeStringArray(input.channels);
    const stack = normalizeStringArray(input.stack);
    const channelSet = channels.map((value) => value.toLowerCase());
    const stackSet = stack.map((value) => value.toLowerCase());
    const scoreTotal = typeof input.scoreTotal === "number" ? input.scoreTotal : 50;

    return {
        orgId,
        assessmentId: input.assessmentId ?? null,
        proposalId: input.proposalId ?? null,
        workspaceId: input.workspaceId ?? null,
        snapshotAt: new Date().toISOString(),
        company: input.company ?? "Unknown",
        segment: input.segment ?? "Outros",
        industry: toIndustry(input.industry),
        teamSize: input.teamSize ?? "-",
        volumeDay: input.volumeDay ?? "-",
        scoreTotal,
        tier: tierFromScore(scoreTotal),
        missions: toMissions(input.missions),
        channels,
        hasWhatsApp: channelSet.some((value) => value.includes("whatsapp")),
        hasInstagram: channelSet.some((value) => value.includes("instagram")),
        hasLinkedIn: channelSet.some((value) => value.includes("linkedin")),
        hasEmail: channelSet.some((value) => value.includes("email")),
        hasCRM: stackSet.some((value) => ["crm", "hubspot", "rd", "pipedrive", "salesforce"].some((keyword) => value.includes(keyword))),
        hasERP: stackSet.some((value) => ["erp", "sap", "totvs", "bling", "omie"].some((keyword) => value.includes(keyword))),
        hasAutomation: stackSet.some((value) => ["make", "zapier", "n8n"].some((keyword) => value.includes(keyword))),
        hasAPI: stackSet.some((value) => value.includes("api")),
        urgency: toUrgency(input.urgency),
        proposedModules: normalizeStringArray(input.modules),
        estimatedBudget: "unknown",
    };
}

export async function logBuilderAudit(
    orgId: string,
    runId: string,
    event: BuilderAuditEvent,
    meta?: Record<string, unknown>,
): Promise<void> {
    try {
        await writeAuditEvent({
            organizationId: orgId,
            action: `builder:${event}`,
            details: {
                runId,
                source: "system:builder-orchestrator",
                ...(meta ?? {}),
            },
            strict: true,
            context: { runId, event },
        });
    } catch (error: unknown) {
        logger.warn("[builder-audit] Failed to write audit event", {
            event,
            runId,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

export async function notifyOwnerReview(opts: ReviewNotifyOptions): Promise<void> {
    const base = opts.appUrl ?? getBaseUrl();
    const runUrl = `${base}/org/${opts.orgSlug}/admin/builder`;
    const approveUrl = `${base}/api/org/${opts.orgSlug}/builder/run/${opts.runId}/approve`;
    const rejectUrl = `${base}/api/org/${opts.orgSlug}/builder/run/${opts.runId}/reject`;

    const body = [
        "*Builder Autopilot - Revisao Necessaria*",
        "",
        "Um novo build pack esta aguardando sua aprovacao.",
        "",
        `*Run ID:* \`${opts.runId}\``,
        `*Organizacao:* ${opts.orgSlug}`,
        "",
        `Ver detalhes: ${runUrl}`,
        "",
        "*Aprovar:*",
        approveUrl,
        "",
        "*Rejeitar:*",
        rejectUrl,
        "",
        "Este link expira em 24h. Responda por aqui ou acesse o sistema.",
    ].join("\n");

    const result = await sendWhatsAppMessage(opts.ownerPhone, body);
    if (result.stub) {
        logger.info("[builder] WhatsApp notification stubbed", { runId: opts.runId });
        return;
    }
    if (result.error) {
        logger.error("[builder] WhatsApp notification failed", {
            runId: opts.runId,
            error: result.error,
        });
    }
}

export async function actionGeneratePack(
    orgSlug: string,
    runId: string,
    orgId: string,
    role: string,
): Promise<{ ok: boolean; partCount?: number; error?: string }> {
    const guard = await checkBuilderAccess(orgSlug, role);
    if (!guard.allowed) return { ok: false, error: "Access denied" };

    const run = await prisma.buildRun.findUnique({
        where: { id: runId },
        select: {
            id: true,
            orgId: true,
            inputJson: true,
        },
    });

    if (!run) return { ok: false, error: "Run not found" };
    if (run.orgId !== orgId) return { ok: false, error: "Org mismatch" };

    const inputData = parseBuilderInput(run.inputJson);
    const snapshot = buildSnapFromInput(inputData, orgId);
    const templates = selectTemplates(snapshot);
    const blueprint = compileBlueprint(templates, snapshot);
    const pack = buildPromptPack(blueprint, { orgSlug, maxParts: 6, includeTests: true });

    await persistPromptPack(pack, runId, orgId);
    await logBuilderAudit(orgId, runId, "builderPackGenerated", {
        parts: pack.parts.length,
        checksum: blueprint._checksum,
    });

    return { ok: true, partCount: pack.parts.length };
}

export async function actionRequestReview(
    orgSlug: string,
    runId: string,
    orgId: string,
    role: string,
    ownerPhone?: string,
): Promise<{ ok: boolean; error?: string }> {
    const guard = await checkBuilderAccess(orgSlug, role);
    if (!guard.allowed) return { ok: false, error: "Access denied" };

    const run = await prisma.buildRun.findUnique({
        where: { id: runId },
        select: { id: true, orgId: true, status: true },
    });

    if (!run) return { ok: false, error: "Run not found" };
    if (run.orgId !== orgId) return { ok: false, error: "Org mismatch" };

    if (run.status !== "review") {
        await prisma.buildRun.update({
            where: { id: runId },
            data: { status: "review", updatedAt: new Date() },
        });
    }

    const phone = ownerPhone ?? await resolveOwnerPhone(orgId);
    if (phone) {
        await notifyOwnerReview({ ownerPhone: phone, orgSlug, runId });
    } else {
        logger.info("[builder] No owner phone available", { runId, orgId });
    }

    await logBuilderAudit(orgId, runId, "builderPackGenerated", {
        status: "review",
        notified: Boolean(phone),
    });

    return { ok: true };
}

export async function actionExecute(
    orgSlug: string,
    runId: string,
    orgId: string,
    role: string,
): Promise<{ ok: boolean; error?: string }> {
    const guard = await checkBuilderAccess(orgSlug, role);
    if (!guard.allowed) return { ok: false, error: "Access denied - internal only" };

    if (process.env.AI_AUTOPILOT_BUILDER !== "true") {
        return { ok: false, error: "Autopilot not enabled (AI_AUTOPILOT_BUILDER != true)" };
    }

    const run = await prisma.buildRun.findUnique({
        where: { id: runId },
        select: { id: true, orgId: true, status: true },
    });

    if (!run) return { ok: false, error: "Run not found" };
    if (run.orgId !== orgId) return { ok: false, error: "Org mismatch" };
    if (run.status !== "approved") {
        return { ok: false, error: `Cannot execute - status is "${run.status}" (must be "approved")` };
    }

    await prisma.buildRun.update({
        where: { id: runId },
        data: { status: "executing", updatedAt: new Date() },
    });

    await prisma.buildRun.update({
        where: { id: runId },
        data: { status: "done", updatedAt: new Date() },
    });

    await logBuilderAudit(orgId, runId, "builderExecuted", { autopilot: true });

    return { ok: true };
}

async function resolveOwnerPhone(orgId: string): Promise<string | null> {
    try {
        const ownerRep = await prisma.salesRep.findFirst({
            where: {
                organizationId: orgId,
                active: true,
                phone: { not: null },
            },
            orderBy: [{ role: "asc" }, { updatedAt: "desc" }],
            select: { phone: true },
        });

        return ownerRep?.phone ?? null;
    } catch {
        return null;
    }
}
