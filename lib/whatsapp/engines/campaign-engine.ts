import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppTemplateForOrg } from "@/lib/whatsapp/meta-client";
import { logger } from "@/lib/logger";
import { writeAuditEvent } from "@/lib/audit";

const DEFAULT_BATCH_LIMIT = 25;
const DEFAULT_MAX_BATCHES = 2;
const MAX_SEND_ATTEMPTS = 3;
const STALE_PROCESSING_WINDOW_MS = 5 * 60 * 1000;
const IDEMPOTENCY_BATCH_WINDOW_MS = 10 * 60 * 1000;

export const CAMPAIGN_QUEUE_ACTION_TYPE = "generate_pdf_report";

type SegmentQuery = {
  lifecycle?: string | string[];
  tags?: string[];
  contactIds?: string[];
  includeOptedOut?: boolean;
};

type CampaignStats = {
  totalTargetContacts: number;
  totalProcessed: number;
  totalSent: number;
  totalFailed: number;
  totalSkipped: number;
  totalDeduped: number;
  lastBatchAt?: string;
  nextBatchAt?: string | null;
  failureReason?: string | null;
};

type ClaimedSend = {
  id: string;
  contactId: string;
  priorAttempt: number;
  contact: { id: string; phoneNumberE164: string; optedOutAt: Date | null };
};

export interface CampaignAudienceResult { candidateContacts: number; queuedSends: number; skippedExisting: number }

export interface CampaignOperationalSummary {
  totalTargetContacts: number;
  totalProcessed: number;
  totalSent: number;
  totalFailed: number;
  totalSkipped: number;
  totalDeduped: number;
  pending: number;
  progressPercent: number;
  lastBatchAt?: string;
  nextBatchAt?: string | null;
  failureReason?: string | null;
}

export interface CampaignBatchResult {
  campaignStatus: string;
  summary: CampaignOperationalSummary;
  processedInRun: number;
  sentInRun: number;
  failedInRun: number;
  skippedInRun: number;
  dedupedInRun: number;
  retryScheduledInRun: number;
  warnings: string[];
  queue?: { queueId: string; queued: boolean };
}

export interface QueueCampaignExecutionOptions {
  batchLimit?: number;
  maxBatches?: number;
  reason?: string;
  trigger?: "start" | "resume" | "worker" | "manual";
}

export interface RunCampaignOptions {
  batchLimit?: number;
  maxBatches?: number;
  trigger?: "worker" | "manual";
  actorUserId?: string;
  autoQueueNext?: boolean;
}

function parseObj(raw: string): Record<string, unknown> { try { const p = JSON.parse(raw); return p && typeof p === "object" && !Array.isArray(p) ? p as Record<string, unknown> : {}; } catch { return {}; } }
function num(v: unknown): number { return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0; }
function txt(v: unknown): string | undefined { return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined; }
function txtn(v: unknown): string | null | undefined { if (v === null) return null; return txt(v); }
function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, Math.floor(v))); }

function parseStats(raw: string): CampaignStats {
  const p = parseObj(raw);
  return {
    totalTargetContacts: num(p.totalTargetContacts), totalProcessed: num(p.totalProcessed), totalSent: num(p.totalSent),
    totalFailed: num(p.totalFailed), totalSkipped: num(p.totalSkipped), totalDeduped: num(p.totalDeduped),
    lastBatchAt: txtn(p.lastBatchAt) ?? undefined, nextBatchAt: txtn(p.nextBatchAt), failureReason: txtn(p.failureReason),
  };
}

function statsJson(s: CampaignStats): string {
  return JSON.stringify({
    totalTargetContacts: num(s.totalTargetContacts), totalProcessed: num(s.totalProcessed), totalSent: num(s.totalSent),
    totalFailed: num(s.totalFailed), totalSkipped: num(s.totalSkipped), totalDeduped: num(s.totalDeduped),
    lastBatchAt: s.lastBatchAt ?? null, nextBatchAt: s.nextBatchAt ?? null, failureReason: s.failureReason ?? null,
  });
}

function mergeStats(base: CampaignStats, patch: Partial<CampaignStats>): CampaignStats { return { ...base, ...patch }; }

function parseSegmentQuery(raw: string): SegmentQuery {
  const p = parseObj(raw);
  const lifecycleRaw = p.lifecycle;
  const tagsRaw = p.tags;
  const contactIdsRaw = p.contactIds;
  const lifecycle = Array.isArray(lifecycleRaw) ? lifecycleRaw.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : typeof lifecycleRaw === "string" && lifecycleRaw.trim().length > 0 ? lifecycleRaw : undefined;
  const tags = Array.isArray(tagsRaw) ? tagsRaw.filter((v): v is string => typeof v === "string" && v.trim().length > 0) : undefined;
  const contactIds = Array.isArray(contactIdsRaw) ? contactIdsRaw.filter((v): v is string => typeof v === "string" && v.trim().length > 0) : undefined;
  return { lifecycle, tags, contactIds, includeOptedOut: p.includeOptedOut === true };
}

function parseTags(raw: string): string[] { try { const p = JSON.parse(raw); return Array.isArray(p) ? p.map((t) => String(t)) : []; } catch { return []; } }
function parseAttempt(errorCode?: string | null): number { const m = errorCode ? /attempt=(\d+)/i.exec(errorCode) : null; return m ? num(Number.parseInt(m[1] ?? "0", 10)) : 0; }
function sanitizeCode(v?: string): string { return (v ?? "UNKNOWN").toUpperCase().replace(/[^A-Z0-9_]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64) || "UNKNOWN"; }

function classifyFailure(reason?: string): { retryable: boolean; code: string } {
  const raw = reason?.trim() || "UNKNOWN";
  const n = raw.toLowerCase();
  if (["meta_not_configured", "template_not_found", "template_not_approved", "contact_blocked", "opt_in_required", "invalid", "permission", "forbidden", "unauthorized"].some((t) => n.includes(t))) {
    return { retryable: false, code: sanitizeCode(raw) };
  }
  if (["http_5", "timeout", "timed out", "429", "rate limit", "temporar", "econn", "socket", "network", "unavailable"].some((t) => n.includes(t))) {
    return { retryable: true, code: sanitizeCode(raw) };
  }
  return { retryable: false, code: sanitizeCode(raw) };
}

function extractBatchLimit(throttle: string, fallback?: number): number {
  if (typeof fallback === "number" && Number.isFinite(fallback)) return clamp(fallback, 1, 100);
  const v = parseObj(throttle).msgsPerMinute;
  return typeof v === "number" && Number.isFinite(v) ? clamp(v, 1, 100) : DEFAULT_BATCH_LIMIT;
}

function extractMaxBatches(throttle: string, fallback?: number): number {
  if (typeof fallback === "number" && Number.isFinite(fallback)) return clamp(fallback, 1, 20);
  const v = parseObj(throttle).maxBatchesPerRun;
  return typeof v === "number" && Number.isFinite(v) ? clamp(v, 1, 20) : DEFAULT_MAX_BATCHES;
}

function batchWindow(now: Date): { start: Date; key: string } {
  const bucket = Math.floor(now.getTime() / IDEMPOTENCY_BATCH_WINDOW_MS) * IDEMPOTENCY_BATCH_WINDOW_MS;
  const start = new Date(bucket);
  return { start, key: `${start.toISOString().slice(0, 16)}:00Z` };
}

function idempotencyKey(input: { campaignId: string; contactId: string; templateName: string; templateLanguage: string; batchWindowKey: string }): string {
  return crypto.createHash("sha256").update(`${input.campaignId}:${input.contactId}:${input.templateName}:${input.templateLanguage}:${input.batchWindowKey}`).digest("hex");
}

function templatePreview(name: string, lang: string): string { return `[Template: ${name} (${lang})]`; }

async function campaignWithTemplate(orgId: string, campaignId: string) {
  return prisma.whatsAppCampaign.findFirst({ where: { id: campaignId, organizationId: orgId }, include: { template: { select: { id: true, name: true, language: true, status: true } } } });
}

async function ensureConversation(orgId: string, contactId: string, preview: string, at: Date): Promise<string> {
  const c = await prisma.whatsAppConversation.upsert({
    where: { organizationId_contactId: { organizationId: orgId, contactId } },
    create: { organizationId: orgId, contactId, status: "open", unreadCount: 0, lastMessageAt: at, lastMessagePreview: preview },
    update: { status: "open", lastMessageAt: at, lastMessagePreview: preview }, select: { id: true },
  });
  return c.id;
}

async function recoverStale(campaignId: string): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_WINDOW_MS);
  const res = await prisma.whatsAppCampaignSend.updateMany({ where: { campaignId, status: "processing", sentAt: { lt: cutoff } }, data: { status: "pending", sentAt: null, errorCode: "STALE_PROCESSING_RECOVERED" } });
  return res.count;
}

async function claimPending(campaignId: string, limit: number, token: string): Promise<{ claimed: ClaimedSend[]; dedupedByClaim: number }> {
  const list = await prisma.whatsAppCampaignSend.findMany({ where: { campaignId, status: "pending" }, include: { contact: { select: { id: true, phoneNumberE164: true, optedOutAt: true } } }, take: limit, orderBy: { id: "asc" } });
  const claimed: ClaimedSend[] = [];
  let dedupedByClaim = 0;
  const at = new Date();
  for (const s of list) {
    const lock = await prisma.whatsAppCampaignSend.updateMany({ where: { id: s.id, status: "pending" }, data: { status: "processing", sentAt: at, errorCode: `LOCK:${token}` } });
    if (lock.count === 0) { dedupedByClaim += 1; continue; }
    claimed.push({ id: s.id, contactId: s.contactId, priorAttempt: parseAttempt(s.errorCode), contact: s.contact });
  }
  return { claimed, dedupedByClaim };
}

async function findDupMessage(conversationId: string, key: string, preview: string, start: Date): Promise<boolean> {
  const msgs = await prisma.whatsAppMessage.findMany({ where: { conversationId, direction: "outbound", type: "template", sentAt: { gte: start } }, select: { text: true, errorJson: true }, orderBy: { sentAt: "desc" }, take: 30 });
  for (const m of msgs) {
    if (m.text === preview) return true;
    if (!m.errorJson) continue;
    try { const p = JSON.parse(m.errorJson) as { idempotencyKey?: unknown }; if (p.idempotencyKey === key) return true; } catch { continue; }
  }
  return false;
}

async function statusCounts(campaignId: string): Promise<Record<string, number>> {
  const grouped = await prisma.whatsAppCampaignSend.groupBy({ by: ["status"], where: { campaignId }, _count: { _all: true } });
  const out: Record<string, number> = {};
  for (const r of grouped) out[r.status] = r._count._all;
  return out;
}

async function computeSummary(campaignId: string, statsRaw: string): Promise<CampaignOperationalSummary> {
  const st = parseStats(statsRaw);
  const c = await statusCounts(campaignId);
  const sent = c.sent ?? 0; const failed = c.failed ?? 0; const skipped = c.skipped ?? 0; const deduped = c.deduped ?? 0; const pending = (c.pending ?? 0) + (c.processing ?? 0);
  const processed = sent + failed + skipped + deduped;
  const totalTargetContacts = Math.max(st.totalTargetContacts, processed + pending);
  const progressPercent = totalTargetContacts > 0 ? Math.min(100, Math.max(0, Math.round((processed / totalTargetContacts) * 100))) : 0;
  return { totalTargetContacts, totalProcessed: processed, totalSent: sent, totalFailed: failed, totalSkipped: skipped + deduped, totalDeduped: deduped, pending, progressPercent, lastBatchAt: st.lastBatchAt, nextBatchAt: st.nextBatchAt, failureReason: st.failureReason };
}

async function persistSummary(campaignId: string, currentStatsRaw: string, summary: CampaignOperationalSummary, patch?: Partial<CampaignStats>) {
  const st = mergeStats(parseStats(currentStatsRaw), { totalTargetContacts: summary.totalTargetContacts, totalProcessed: summary.totalProcessed, totalSent: summary.totalSent, totalFailed: summary.totalFailed, totalSkipped: summary.totalSkipped, totalDeduped: summary.totalDeduped, ...patch });
  await prisma.whatsAppCampaign.update({ where: { id: campaignId }, data: { stats: statsJson(st) } });
}

async function markLifecycle(campaign: { id: string; organizationId: string; status: string; stats: string }, summary: CampaignOperationalSummary, trigger: "worker" | "manual", actorUserId?: string): Promise<{ status: string; summary: CampaignOperationalSummary }> {
  let nextStatus = campaign.status;
  let nextBatchAt: string | null | undefined = summary.nextBatchAt;
  if (campaign.status === "paused") nextBatchAt = null;
  else if (summary.pending === 0) { nextBatchAt = null; nextStatus = summary.totalSent === 0 && summary.totalFailed > 0 && summary.totalSkipped === 0 ? "failed" : "completed"; }
  else if (campaign.status === "running") nextBatchAt = new Date(Date.now() + 60_000).toISOString();

  await persistSummary(campaign.id, campaign.stats, summary, {
    nextBatchAt,
    lastBatchAt: new Date().toISOString(),
    failureReason: nextStatus === "failed" ? (summary.failureReason ?? "ALL_CONTACTS_FAILED") : null,
  });

  if (nextStatus !== campaign.status) {
    await prisma.whatsAppCampaign.update({ where: { id: campaign.id }, data: { status: nextStatus } });
    await writeAuditEvent({ organizationId: campaign.organizationId, action: nextStatus === "failed" ? "campaign_failed" : "campaign_completed", details: { campaignId: campaign.id, trigger, actorUserId: actorUserId ?? null, summary }, strict: false, context: { campaignId: campaign.id } });
  }

  const fresh = await prisma.whatsAppCampaign.findUnique({ where: { id: campaign.id }, select: { id: true, status: true, stats: true } });
  if (!fresh) return { status: nextStatus, summary };
  return { status: fresh.status, summary: await computeSummary(fresh.id, fresh.stats) };
}

async function runBatch(campaign: Awaited<ReturnType<typeof campaignWithTemplate>> & NonNullable<unknown>, batchLimit: number, trigger: "worker" | "manual", actorUserId?: string): Promise<CampaignBatchResult> {
  const warnings: string[] = [];
  if (campaign.template.status !== "approved") {
    const current = parseStats(campaign.stats);
    await prisma.whatsAppCampaign.update({ where: { id: campaign.id }, data: { status: "failed", stats: statsJson(mergeStats(current, { failureReason: "TEMPLATE_NOT_APPROVED", nextBatchAt: null, lastBatchAt: new Date().toISOString() })) } });
    await writeAuditEvent({ organizationId: campaign.organizationId, action: "campaign_failed", details: { campaignId: campaign.id, reason: "TEMPLATE_NOT_APPROVED", actorUserId: actorUserId ?? null }, strict: false, context: { campaignId: campaign.id } });
    return { campaignStatus: "failed", summary: await getCampaignOperationalSummary(campaign.organizationId, campaign.id), processedInRun: 0, sentInRun: 0, failedInRun: 0, skippedInRun: 0, dedupedInRun: 0, retryScheduledInRun: 0, warnings: ["Campaign failed: template not approved"] };
  }
  if (campaign.status !== "running") {
    return { campaignStatus: campaign.status, summary: await getCampaignOperationalSummary(campaign.organizationId, campaign.id), processedInRun: 0, sentInRun: 0, failedInRun: 0, skippedInRun: 0, dedupedInRun: 0, retryScheduledInRun: 0, warnings: [`Campaign is ${campaign.status}; batch skipped`] };
  }

  const recovered = await recoverStale(campaign.id);
  if (recovered > 0) warnings.push(`Recovered ${recovered} stale processing sends`);

  const claim = await claimPending(campaign.id, batchLimit, `${campaign.id}:${crypto.randomUUID()}`);
  if (claim.dedupedByClaim > 0) warnings.push(`Skipped ${claim.dedupedByClaim} claimed sends`);

  let sentInRun = 0, failedInRun = 0, skippedInRun = 0, dedupedInRun = 0, retryScheduledInRun = 0;
  for (const send of claim.claimed) {
    const attempt = send.priorAttempt + 1;
    const at = new Date();

    if (send.contact.optedOutAt) {
      skippedInRun += 1;
      await prisma.whatsAppCampaignSend.update({ where: { id: send.id }, data: { status: "skipped", sentAt: at, errorCode: `CONTACT_BLOCKED:attempt=${attempt}` } });
      await writeAuditEvent({ organizationId: campaign.organizationId, action: "campaign_contact_skipped", details: { campaignId: campaign.id, contactId: send.contactId, reason: "CONTACT_BLOCKED", attempt }, strict: false, context: { campaignId: campaign.id, contactId: send.contactId } });
      continue;
    }

    const optIn = await prisma.whatsAppOptIn.findUnique({ where: { contactId: send.contactId }, select: { id: true } });
    if (!optIn) {
      skippedInRun += 1;
      await prisma.whatsAppCampaignSend.update({ where: { id: send.id }, data: { status: "skipped", sentAt: at, errorCode: `OPT_IN_REQUIRED:attempt=${attempt}` } });
      await writeAuditEvent({ organizationId: campaign.organizationId, action: "campaign_contact_skipped", details: { campaignId: campaign.id, contactId: send.contactId, reason: "OPT_IN_REQUIRED", attempt }, strict: false, context: { campaignId: campaign.id, contactId: send.contactId } });
      continue;
    }

    const preview = templatePreview(campaign.template.name, campaign.template.language);
    const conversationId = await ensureConversation(campaign.organizationId, send.contactId, preview, at);
    const bw = batchWindow(at);
    const idem = idempotencyKey({ campaignId: campaign.id, contactId: send.contactId, templateName: campaign.template.name, templateLanguage: campaign.template.language, batchWindowKey: bw.key });

    if (await findDupMessage(conversationId, idem, preview, bw.start)) {
      dedupedInRun += 1; skippedInRun += 1;
      await prisma.whatsAppCampaignSend.update({ where: { id: send.id }, data: { status: "deduped", sentAt: at, errorCode: `IDEMPOTENT_DUPLICATE:attempt=${attempt}` } });
      await writeAuditEvent({ organizationId: campaign.organizationId, action: "campaign_contact_deduped", details: { campaignId: campaign.id, contactId: send.contactId, idempotencyKey: idem, attempt }, strict: false, context: { campaignId: campaign.id, contactId: send.contactId } });
      continue;
    }

    const sendResult = await sendWhatsAppTemplateForOrg(campaign.organizationId, send.contact.phoneNumberE164, campaign.template.name, campaign.template.language, []);
    if (!sendResult.messageId) {
      const cls = classifyFailure(sendResult.error);
      if (cls.retryable && attempt < MAX_SEND_ATTEMPTS) {
        retryScheduledInRun += 1;
        await prisma.whatsAppCampaignSend.update({ where: { id: send.id }, data: { status: "pending", sentAt: null, errorCode: `RETRYABLE:${cls.code}:attempt=${attempt}` } });
      } else {
        failedInRun += 1;
        await prisma.whatsAppCampaignSend.update({ where: { id: send.id }, data: { status: "failed", sentAt: at, errorCode: `${cls.retryable ? "RETRY_EXHAUSTED" : "NON_RETRYABLE"}:${cls.code}:attempt=${attempt}` } });
      }
      continue;
    }

    try {
      await prisma.whatsAppMessage.create({ data: { conversationId, messageId: sendResult.messageId, direction: "outbound", type: "template", text: preview, status: "sent", sentAt: at, errorJson: JSON.stringify({ campaignId: campaign.id, contactId: send.contactId, templateName: campaign.template.name, templateLanguage: campaign.template.language, idempotencyKey: idem, batchWindowStart: bw.start.toISOString() }) } });
    } catch (error) {
      const dup = typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
      if (!dup) {
        failedInRun += 1;
        logger.error("Campaign message persistence failed", { campaignId: campaign.id, contactId: send.contactId, error: error instanceof Error ? error.message : String(error) });
        await prisma.whatsAppCampaignSend.update({ where: { id: send.id }, data: { status: "failed", sentAt: at, errorCode: `NON_RETRYABLE:MESSAGE_PERSISTENCE_FAILED:attempt=${attempt}` } });
        continue;
      }
      dedupedInRun += 1; skippedInRun += 1;
      await prisma.whatsAppCampaignSend.update({ where: { id: send.id }, data: { status: "deduped", sentAt: at, errorCode: `MESSAGE_ID_DUPLICATED:attempt=${attempt}` } });
      await writeAuditEvent({ organizationId: campaign.organizationId, action: "campaign_contact_deduped", details: { campaignId: campaign.id, contactId: send.contactId, reason: "MESSAGE_ID_DUPLICATED", attempt }, strict: false, context: { campaignId: campaign.id, contactId: send.contactId } });
      continue;
    }

    sentInRun += 1;
    await prisma.whatsAppCampaignSend.update({ where: { id: send.id }, data: { status: "sent", sentAt: at, errorCode: null } });
    await prisma.contact.update({ where: { id: send.contactId }, data: { lastOutboundAt: at, lastMessageAt: at } });
  }

  const summary0 = await computeSummary(campaign.id, campaign.stats);
  const lifecycle = await markLifecycle({ id: campaign.id, organizationId: campaign.organizationId, status: campaign.status, stats: campaign.stats }, summary0, trigger, actorUserId);

  await writeAuditEvent({ organizationId: campaign.organizationId, action: "campaign_batch_executed", details: { campaignId: campaign.id, trigger, actorUserId: actorUserId ?? null, processedInRun: claim.claimed.length, sentInRun, failedInRun, skippedInRun, dedupedInRun, retryScheduledInRun, dedupedByClaim: claim.dedupedByClaim, summary: lifecycle.summary, warnings }, strict: false, context: { campaignId: campaign.id } });

  return { campaignStatus: lifecycle.status, summary: lifecycle.summary, processedInRun: claim.claimed.length, sentInRun, failedInRun, skippedInRun, dedupedInRun, retryScheduledInRun, warnings };
}

export async function prepareCampaignAudience(orgId: string, campaignId: string): Promise<CampaignAudienceResult> {
  const campaign = await prisma.whatsAppCampaign.findFirst({ where: { id: campaignId, organizationId: orgId }, select: { id: true, segmentQuery: true, stats: true } });
  if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");

  const segment = parseSegmentQuery(campaign.segmentQuery);
  const where: { organizationId: string; optedOutAt?: null; lifecycle?: string | { in: string[] }; id?: { in: string[] } } = { organizationId: orgId };
  if (!segment.includeOptedOut) where.optedOutAt = null;
  if (segment.lifecycle) where.lifecycle = Array.isArray(segment.lifecycle) ? { in: segment.lifecycle } : segment.lifecycle;
  if (segment.contactIds && segment.contactIds.length > 0) where.id = { in: segment.contactIds };

  const contacts = await prisma.contact.findMany({ where, select: { id: true, tags: true } });
  const filtered = segment.tags && segment.tags.length > 0 ? contacts.filter((c) => segment.tags!.every((tag) => parseTags(c.tags).includes(tag))) : contacts;

  if (filtered.length === 0) {
    const st = parseStats(campaign.stats);
    await prisma.whatsAppCampaign.update({ where: { id: campaignId }, data: { stats: statsJson(mergeStats(st, { totalTargetContacts: 0, nextBatchAt: null })) } });
    return { candidateContacts: 0, queuedSends: 0, skippedExisting: 0 };
  }

  const existing = await prisma.whatsAppCampaignSend.findMany({ where: { campaignId, contactId: { in: filtered.map((c) => c.id) } }, select: { contactId: true } });
  const existingSet = new Set(existing.map((e) => e.contactId));
  const result = await prisma.whatsAppCampaignSend.createMany({ data: filtered.map((c) => ({ campaignId, contactId: c.id, status: "pending" })), skipDuplicates: true });

  const totalTargets = await prisma.whatsAppCampaignSend.count({ where: { campaignId } });
  const st = parseStats(campaign.stats);
  await prisma.whatsAppCampaign.update({ where: { id: campaignId }, data: { stats: statsJson(mergeStats(st, { totalTargetContacts: totalTargets })) } });

  return { candidateContacts: filtered.length, queuedSends: result.count, skippedExisting: filtered.filter((c) => existingSet.has(c.id)).length };
}

export async function enqueueCampaignExecutionJob(orgId: string, campaignId: string, options?: QueueCampaignExecutionOptions): Promise<{ queueId: string; queued: boolean }> {
  const existing = await prisma.actionQueue.findFirst({ where: { organizationId: orgId, type: CAMPAIGN_QUEUE_ACTION_TYPE, relatedEntityType: "whatsapp_campaign", relatedEntityId: campaignId, status: { in: ["pending", "review_required", "approved"] } }, orderBy: { createdAt: "desc" } });
  if (existing) return { queueId: existing.id, queued: false };
  const created = await prisma.actionQueue.create({ data: { organizationId: orgId, type: CAMPAIGN_QUEUE_ACTION_TYPE, payloadJson: JSON.stringify({ campaignId, batchLimit: options?.batchLimit, maxBatches: options?.maxBatches, trigger: options?.trigger ?? "worker" }), priority: "high", status: "pending", approvalRequired: false, relatedEntityType: "whatsapp_campaign", relatedEntityId: campaignId, reason: options?.reason ?? "campaign_execution" } });
  return { queueId: created.id, queued: true };
}

export async function isCampaignExecutionInProgress(orgId: string, campaignId: string): Promise<boolean> {
  const active = await prisma.actionQueue.findFirst({ where: { organizationId: orgId, type: CAMPAIGN_QUEUE_ACTION_TYPE, relatedEntityType: "whatsapp_campaign", relatedEntityId: campaignId, status: "pending", lockedUntil: { gt: new Date() } }, select: { id: true } });
  return Boolean(active);
}

export async function runCampaignBatches(orgId: string, campaignId: string, options?: RunCampaignOptions): Promise<CampaignBatchResult> {
  const campaign = await campaignWithTemplate(orgId, campaignId);
  if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");
  if (campaign.status !== "running") {
    return { campaignStatus: campaign.status, summary: await getCampaignOperationalSummary(orgId, campaignId), processedInRun: 0, sentInRun: 0, failedInRun: 0, skippedInRun: 0, dedupedInRun: 0, retryScheduledInRun: 0, warnings: [`Campaign is ${campaign.status}; execution skipped`] };
  }

  const batchLimit = extractBatchLimit(campaign.throttlePolicy, options?.batchLimit);
  const maxBatches = extractMaxBatches(campaign.throttlePolicy, options?.maxBatches);

  let agg: CampaignBatchResult = { campaignStatus: campaign.status, summary: await getCampaignOperationalSummary(orgId, campaignId), processedInRun: 0, sentInRun: 0, failedInRun: 0, skippedInRun: 0, dedupedInRun: 0, retryScheduledInRun: 0, warnings: [] };

  for (let i = 0; i < maxBatches; i += 1) {
    const fresh = await campaignWithTemplate(orgId, campaignId);
    if (!fresh || fresh.status !== "running") break;
    const batch = await runBatch(fresh as NonNullable<typeof fresh>, batchLimit, options?.trigger ?? "worker", options?.actorUserId);
    agg = { campaignStatus: batch.campaignStatus, summary: batch.summary, processedInRun: agg.processedInRun + batch.processedInRun, sentInRun: agg.sentInRun + batch.sentInRun, failedInRun: agg.failedInRun + batch.failedInRun, skippedInRun: agg.skippedInRun + batch.skippedInRun, dedupedInRun: agg.dedupedInRun + batch.dedupedInRun, retryScheduledInRun: agg.retryScheduledInRun + batch.retryScheduledInRun, warnings: [...agg.warnings, ...batch.warnings] };
    if (batch.summary.pending === 0 || batch.campaignStatus !== "running") break;
    if (batch.processedInRun === 0 && batch.retryScheduledInRun === 0) { agg.warnings.push("No progress in current batch; avoiding infinite loop"); break; }
  }

  if (agg.campaignStatus === "running" && agg.summary.pending > 0 && options?.autoQueueNext !== false) {
    const q = await enqueueCampaignExecutionJob(orgId, campaignId, { batchLimit, maxBatches: 1, reason: "campaign_auto_continue", trigger: "worker" });
    agg.queue = q;
    const fresh = await prisma.whatsAppCampaign.findUnique({ where: { id: campaignId }, select: { id: true, stats: true } });
    if (fresh) {
      const st = parseStats(fresh.stats);
      await prisma.whatsAppCampaign.update({ where: { id: campaignId }, data: { stats: statsJson(mergeStats(st, { nextBatchAt: new Date(Date.now() + 60_000).toISOString() })) } });
      agg.summary = await getCampaignOperationalSummary(orgId, campaignId);
    }
  }

  return agg;
}

export async function runQueuedCampaignJob(payload: { campaignId?: string; batchLimit?: number; maxBatches?: number }, orgId: string): Promise<CampaignBatchResult> {
  const campaignId = typeof payload.campaignId === "string" ? payload.campaignId : "";
  if (!campaignId) throw new Error("CAMPAIGN_ID_REQUIRED");
  return runCampaignBatches(orgId, campaignId, { batchLimit: payload.batchLimit, maxBatches: payload.maxBatches, trigger: "worker", autoQueueNext: true });
}

export async function getCampaignOperationalSummary(orgId: string, campaignId: string): Promise<CampaignOperationalSummary> {
  const campaign = await prisma.whatsAppCampaign.findFirst({ where: { id: campaignId, organizationId: orgId }, select: { id: true, stats: true } });
  if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");
  return computeSummary(campaign.id, campaign.stats);
}

export function getCampaignSummaryFromStats(statsRaw: string): CampaignOperationalSummary {
  const st = parseStats(statsRaw);
  const pending = Math.max(0, st.totalTargetContacts - st.totalProcessed);
  const progressPercent = st.totalTargetContacts > 0 ? Math.min(100, Math.max(0, Math.round((st.totalProcessed / st.totalTargetContacts) * 100))) : 0;
  return { totalTargetContacts: st.totalTargetContacts, totalProcessed: st.totalProcessed, totalSent: st.totalSent, totalFailed: st.totalFailed, totalSkipped: st.totalSkipped, totalDeduped: st.totalDeduped, pending, progressPercent, lastBatchAt: st.lastBatchAt, nextBatchAt: st.nextBatchAt, failureReason: st.failureReason };
}
