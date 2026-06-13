import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { Orchestrator } from "@/lib/orchestrator/orchestrator";
import { discoverHighTicketLeads } from "@/lib/growth/lead-discovery";
import { runOutboundAutopilot } from "@/lib/growth/outbound-autopilot";
import { detectGrowthSignals } from "@/lib/growth/signal-engine";
import { alertDailySummary } from "@/lib/ai/whatsapp-alerts";
import { runAlertEngine } from "@/lib/whatsapp/alert-engine";
import { runDueWhatsAppRetryDispatch } from "@/lib/whatsapp/retry-worker";
import { runBenchmarkGenerate } from "@/lib/agency/monitoring/benchmark-generate-handler";
import { refreshWarRoomSnapshotCache } from "@/lib/agency/war-room/war-room-engine";

export type SystemSchedulerJob =
    | "growth_cycle"
    | "queue_process"
    | "whatsapp_retry_dispatch"
    | "whatsapp_briefing"
    | "benchmark_generate"
    | "war_room_refresh";

export interface SystemSchedulerConfig {
    enabledJobs: SystemSchedulerJob[];
    issues: string[];
    env: {
        hasCronSecret: boolean;
        hasWhatsAppOrgSlug: boolean;
    };
}

export interface SchedulerRunOptions {
    jobs?: SystemSchedulerJob[];
    orgId?: string;
    dryRun?: boolean;
    triggeredBy?: "api" | "cron" | "worker";
}

export interface SchedulerJobResult {
    job: SystemSchedulerJob;
    success: boolean;
    startedAt: string;
    finishedAt: string;
    detail: string;
    error?: string;
}

export interface SchedulerRunResult {
    success: boolean;
    startedAt: string;
    finishedAt: string;
    triggeredBy: "api" | "cron" | "worker";
    dryRun: boolean;
    targetOrgCount: number;
    jobsRequested: SystemSchedulerJob[];
    jobsExecuted: SchedulerJobResult[];
    config: SystemSchedulerConfig;
}

export interface SchedulerEnqueueJobResult {
    job: SystemSchedulerJob;
    queueId: string;
    queued: boolean;
    dedupeKey: string;
}

export interface SchedulerEnqueueResult {
    success: boolean;
    message: string;
    queuedJobs: SchedulerEnqueueJobResult[];
    duplicateJobs: SchedulerEnqueueJobResult[];
    jobsRequested: SystemSchedulerJob[];
    config: SystemSchedulerConfig;
}

const DEFAULT_JOBS: SystemSchedulerJob[] = [
    "growth_cycle",
    "queue_process",
    "whatsapp_retry_dispatch",
    "whatsapp_briefing",
    "benchmark_generate",
    "war_room_refresh",
];

const VALID_JOBS = new Set<SystemSchedulerJob>(DEFAULT_JOBS);
const SYSTEM_SCHEDULER_QUEUE_TYPE = "system_scheduler_job";
const SYSTEM_SCHEDULER_QUEUE_ENTITY_TYPE = "system_scheduler_job";
const SYSTEM_SCHEDULER_LOCK_MS = 10 * 60 * 1000;
const SYSTEM_SCHEDULER_QUEUE_BATCH_SIZE = 5;
const SCHEDULER_QUEUE_ACTIVE_STATUSES = ["queued", "running"] as const;

type SchedulerQueueStatus = "queued" | "running" | "executed" | "rejected";

type SchedulerQueuePayload = {
    job: SystemSchedulerJob;
    targetOrgId?: string;
    dryRun: boolean;
    triggeredBy: "api" | "cron" | "worker";
    requestedAt: string;
};

type SchedulerQueueRecord = {
    id: string;
    organizationId: string;
    payloadJson: string;
    relatedEntityId: string | null;
    status: string;
    attempts: number;
};

let systemSchedulerWorkerPromise: Promise<void> | null = null;

export function isValidSystemSchedulerJob(value: string): value is SystemSchedulerJob {
    return VALID_JOBS.has(value as SystemSchedulerJob);
}

function parseEnabledJobsFromEnv(): SystemSchedulerJob[] {
    const raw = (process.env.SYSTEM_SCHEDULER_ENABLED_JOBS ?? "").trim();
    if (!raw) return [...DEFAULT_JOBS];

    const parsed = raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .filter(isValidSystemSchedulerJob);

    return parsed.length > 0 ? parsed : [...DEFAULT_JOBS];
}

export function inspectSystemSchedulerConfig(): SystemSchedulerConfig {
    const enabledJobs = parseEnabledJobsFromEnv();
    const hasCronSecret = Boolean((process.env.CRON_SECRET ?? "").trim());
    const hasWhatsAppOrgSlug = Boolean((process.env.WHATSAPP_COPILOT_ORG_SLUG ?? "").trim());
    const issues: string[] = [];

    if (!hasCronSecret) {
        issues.push("CRON_SECRET is not configured.");
    }
    if (!hasWhatsAppOrgSlug && enabledJobs.includes("whatsapp_briefing")) {
        issues.push("WHATSAPP_COPILOT_ORG_SLUG is not configured; whatsapp briefing job will fail.");
    }

    return {
        enabledJobs,
        issues,
        env: {
            hasCronSecret,
            hasWhatsAppOrgSlug,
        },
    };
}

function buildSchedulerQueueKey(job: SystemSchedulerJob, targetOrgId?: string, dryRun?: boolean): string {
    return [job, targetOrgId ?? "all", dryRun ? "dry" : "live"].join(":");
}

function parseSchedulerQueuePayload(payloadJson: string): SchedulerQueuePayload {
    try {
        const parsed = JSON.parse(payloadJson) as Partial<SchedulerQueuePayload>;
        if (!parsed || typeof parsed !== "object" || !parsed.job || !isValidSystemSchedulerJob(parsed.job)) {
            throw new Error("Invalid scheduler payload");
        }

        return {
            job: parsed.job,
            targetOrgId: typeof parsed.targetOrgId === "string" && parsed.targetOrgId.trim() ? parsed.targetOrgId : undefined,
            dryRun: Boolean(parsed.dryRun),
            triggeredBy: parsed.triggeredBy === "api" || parsed.triggeredBy === "cron" || parsed.triggeredBy === "worker"
                ? parsed.triggeredBy
                : "worker",
            requestedAt: typeof parsed.requestedAt === "string" ? parsed.requestedAt : new Date().toISOString(),
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid scheduler queue payload: ${message}`);
    }
}

async function runTimedSchedulerStage<T>(
    job: SystemSchedulerJob,
    stage: string,
    fn: () => Promise<T>,
    context: Record<string, unknown> = {},
): Promise<T> {
    const startedAt = Date.now();
    logger.info("[SystemScheduler] stage start", { job, stage, ...context });
    try {
        const result = await fn();
        logger.info("[SystemScheduler] stage done", {
            job,
            stage,
            latencyMs: Date.now() - startedAt,
            ...context,
        });
        return result;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("[SystemScheduler] stage failed", {
            job,
            stage,
            latencyMs: Date.now() - startedAt,
            error: message,
            ...context,
        });
        throw error;
    }
}

async function resolveTargetOrgIds(orgId?: string): Promise<string[]> {
    if (orgId) return [orgId];
    const orgs = await prisma.organization.findMany({ select: { id: true } });
    return orgs.map((org) => org.id);
}

async function executeGrowthCycle(orgIds: string[], dryRun: boolean): Promise<string> {
    if (dryRun) return `dry-run: growth cycle planned for ${orgIds.length} org(s)`;

    let discovered = 0;
    let enrolled = 0;
    let signals = 0;

    for (const orgId of orgIds) {
        const leads = await runTimedSchedulerStage("growth_cycle", "discover_high_ticket_leads", () => discoverHighTicketLeads(orgId), { orgId });
        const outbound = await runTimedSchedulerStage("growth_cycle", "run_outbound_autopilot", () => runOutboundAutopilot(orgId), { orgId });
        const foundSignals = await runTimedSchedulerStage("growth_cycle", "detect_growth_signals", () => detectGrowthSignals(orgId), { orgId });
        discovered += leads.length;
        enrolled += outbound.enrolled;
        signals += foundSignals.length;
    }

    return `growth cycle complete: discovered=${discovered}, enrolled=${enrolled}, signals=${signals}`;
}

async function executeQueueProcess(orgIds: string[], dryRun: boolean): Promise<string> {
    if (dryRun) return `dry-run: queue processing planned for ${orgIds.length} org(s)`;

    for (const orgId of orgIds) {
        await runTimedSchedulerStage("queue_process", "orchestrator_process_queue", () => Orchestrator.processQueue(orgId), { orgId });
    }

    return `queue processed for ${orgIds.length} org(s)`;
}

async function executeWhatsAppRetryDispatch(orgIds: string[], dryRun: boolean): Promise<string> {
    if (dryRun) return `dry-run: whatsapp retry dispatch planned for ${orgIds.length} org(s)`;

    let processed = 0;
    for (const orgId of orgIds) {
        processed += await runTimedSchedulerStage(
            "whatsapp_retry_dispatch",
            "process_whatsapp_retry_queue",
            () => runDueWhatsAppRetryDispatch({ organizationId: orgId }),
            { orgId },
        );
    }

    return `whatsapp retry dispatch processed ${processed} queue item(s) across ${orgIds.length} org(s)`;
}

async function executeWhatsAppBriefing(dryRun: boolean): Promise<string> {
    const orgSlug = (process.env.WHATSAPP_COPILOT_ORG_SLUG ?? "").trim();
    if (!orgSlug) {
        throw new Error("WHATSAPP_COPILOT_ORG_SLUG not configured");
    }

    const org = await prisma.organization.findUnique({
        where: { slug: orgSlug },
        select: { id: true, name: true },
    });

    if (!org) {
        throw new Error(`Organization not found for slug '${orgSlug}'`);
    }

    if (dryRun) return `dry-run: whatsapp briefing planned for ${org.name}`;

    await runTimedSchedulerStage("whatsapp_briefing", "alert_daily_summary", () => alertDailySummary(org.id), { orgId: org.id });
    await runTimedSchedulerStage("whatsapp_briefing", "run_alert_engine", () => runAlertEngine(org.id), { orgId: org.id });
    return `whatsapp briefing completed for ${org.name}`;
}

async function executeBenchmarkGenerate(dryRun: boolean): Promise<string> {
    const cronSecret = process.env.CRON_SECRET ?? "";
    if (!cronSecret.trim()) {
        throw new Error("CRON_SECRET not configured");
    }

    const url = new URL("https://internal.inovacortex/api/agency/monitoring/cron/benchmark-generate");
    url.searchParams.set("window", "30d");
    if (dryRun) url.searchParams.set("dry_run", "true");

    const request = new Request(url.toString(), {
        method: "POST",
        headers: {
            authorization: `Bearer ${cronSecret}`,
        },
    });

    const result = await runTimedSchedulerStage("benchmark_generate", "generate_benchmarks", () => runBenchmarkGenerate(request));
    return `benchmark generate completed (${dryRun ? "dry-run" : "execute"}): ${JSON.stringify(result).slice(0, 220)}`;
}

async function executeWarRoomRefresh(orgIds: string[], dryRun: boolean): Promise<string> {
    if (dryRun) return `dry-run: war room refresh planned for ${orgIds.length} org(s)`;

    const results = await Promise.allSettled(
        orgIds.map((orgId) =>
            runTimedSchedulerStage("war_room_refresh", "refresh_snapshot", () =>
                refreshWarRoomSnapshotCache({
                    agencyOrganizationId: orgId,
                    actorUserId: "system-scheduler",
                    requestId: `scheduler-war-room-${Date.now()}`,
                }),
            { orgId }),
        ),
    );

    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length > 0) {
        const first = failed[0] as PromiseRejectedResult;
        const firstError = first.reason instanceof Error ? first.reason.message : String(first.reason);
        throw new Error(`war_room_refresh failed for ${failed.length}/${orgIds.length} org(s): ${firstError}`);
    }

    return `war room refreshed for ${orgIds.length} org(s)`;
}

export async function enqueueSystemSchedulerJobs(options: {
    queueOrganizationId: string;
    jobs?: SystemSchedulerJob[];
    orgId?: string;
    dryRun?: boolean;
    triggeredBy?: "api" | "cron" | "worker";
}): Promise<SchedulerEnqueueResult> {
    const config = inspectSystemSchedulerConfig();
    const dryRun = options.dryRun ?? false;
    const triggeredBy = options.triggeredBy ?? "api";
    const jobsRequested = (options.jobs && options.jobs.length > 0 ? options.jobs : config.enabledJobs).filter((job) => VALID_JOBS.has(job));
    const queuedJobs: SchedulerEnqueueJobResult[] = [];
    const duplicateJobs: SchedulerEnqueueJobResult[] = [];

    for (const job of jobsRequested) {
        const dedupeKey = buildSchedulerQueueKey(job, options.orgId, dryRun);
        const existing = await prisma.actionQueue.findFirst({
            where: {
                organizationId: options.queueOrganizationId,
                type: SYSTEM_SCHEDULER_QUEUE_TYPE,
                relatedEntityType: SYSTEM_SCHEDULER_QUEUE_ENTITY_TYPE,
                relatedEntityId: dedupeKey,
                status: { in: [...SCHEDULER_QUEUE_ACTIVE_STATUSES] },
            },
            orderBy: { createdAt: "desc" },
            select: { id: true },
        });

        if (existing) {
            duplicateJobs.push({
                job,
                queueId: existing.id,
                queued: false,
                dedupeKey,
            });
            continue;
        }

        const created = await prisma.actionQueue.create({
            data: {
                organizationId: options.queueOrganizationId,
                type: SYSTEM_SCHEDULER_QUEUE_TYPE,
                payloadJson: JSON.stringify({
                    job,
                    targetOrgId: options.orgId,
                    dryRun,
                    triggeredBy,
                    requestedAt: new Date().toISOString(),
                } satisfies SchedulerQueuePayload),
                priority: "high",
                status: "queued",
                approvalRequired: false,
                relatedEntityType: SYSTEM_SCHEDULER_QUEUE_ENTITY_TYPE,
                relatedEntityId: dedupeKey,
                reason: `system_scheduler:${job}`,
            },
            select: { id: true },
        });

        queuedJobs.push({
            job,
            queueId: created.id,
            queued: true,
            dedupeKey,
        });
    }

    logger.info("[SystemScheduler] jobs enqueued", {
        queueOrganizationId: options.queueOrganizationId,
        jobsRequested,
        queuedCount: queuedJobs.length,
        duplicateCount: duplicateJobs.length,
        dryRun,
        triggeredBy,
    });

    return {
        success: true,
        message: "Scheduler cycle triggered",
        queuedJobs,
        duplicateJobs,
        jobsRequested,
        config,
    };
}

async function claimQueuedSchedulerJobs(limit: number): Promise<SchedulerQueueRecord[]> {
    const runId = crypto.randomUUID();
    const now = new Date();
    const lockExpiration = new Date(now.getTime() + SYSTEM_SCHEDULER_LOCK_MS);

    const candidates = await prisma.actionQueue.findMany({
        where: {
            type: SYSTEM_SCHEDULER_QUEUE_TYPE,
            status: "queued",
            OR: [
                { lockedUntil: null },
                { lockedUntil: { lt: now } },
            ],
        },
        orderBy: { createdAt: "asc" },
        take: limit,
        select: {
            id: true,
        },
    });

    if (candidates.length === 0) {
        return [];
    }

    const candidateIds = candidates.map((candidate) => candidate.id);
    await prisma.actionQueue.updateMany({
        where: {
            id: { in: candidateIds },
            type: SYSTEM_SCHEDULER_QUEUE_TYPE,
            status: "queued",
            OR: [
                { lockedUntil: null },
                { lockedUntil: { lt: now } },
            ],
        },
        data: {
            status: "running",
            lockedByRunId: runId,
            lockedUntil: lockExpiration,
            attempts: { increment: 1 },
        },
    });

    return prisma.actionQueue.findMany({
        where: {
            lockedByRunId: runId,
            type: SYSTEM_SCHEDULER_QUEUE_TYPE,
            status: "running",
        },
        select: {
            id: true,
            organizationId: true,
            payloadJson: true,
            relatedEntityId: true,
            status: true,
            attempts: true,
        },
    }) as Promise<SchedulerQueueRecord[]>;
}

async function finalizeSchedulerQueueItem(id: string, status: SchedulerQueueStatus, reason: string): Promise<void> {
    await prisma.actionQueue.update({
        where: { id },
        data: {
            status,
            reason,
            executedAt: status === "executed" ? new Date() : null,
            lockedByRunId: null,
            lockedUntil: null,
        },
    });
}

async function executeQueuedSchedulerJob(item: SchedulerQueueRecord): Promise<void> {
    const payload = parseSchedulerQueuePayload(item.payloadJson);
    const startedAt = Date.now();

    logger.info("[SystemScheduler] queued job start", {
        queueId: item.id,
        job: payload.job,
        targetOrgId: payload.targetOrgId ?? "all",
        dryRun: payload.dryRun,
        attempts: item.attempts,
    });

    try {
        const result = await runSystemSchedulerOnce({
            jobs: [payload.job],
            orgId: payload.targetOrgId,
            dryRun: payload.dryRun,
            triggeredBy: "worker",
        });
        const jobResult = result.jobsExecuted[0];
        if (!jobResult?.success) {
            const error = jobResult?.error ?? jobResult?.detail ?? "Scheduler job failed";
            await finalizeSchedulerQueueItem(item.id, "rejected", error);
            logger.error("[SystemScheduler] queued job failed", {
                queueId: item.id,
                job: payload.job,
                latencyMs: Date.now() - startedAt,
                error,
            });
            return;
        }

        await finalizeSchedulerQueueItem(item.id, "executed", jobResult.detail);
        logger.info("[SystemScheduler] queued job complete", {
            queueId: item.id,
            job: payload.job,
            latencyMs: Date.now() - startedAt,
            detail: jobResult.detail,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await finalizeSchedulerQueueItem(item.id, "rejected", message);
        logger.error("[SystemScheduler] queued job exception", {
            queueId: item.id,
            job: payload.job,
            latencyMs: Date.now() - startedAt,
            error: message,
        });
    }
}

export async function runQueuedSystemSchedulerJobs(options: { maxJobs?: number } = {}): Promise<number> {
    const lockedItems = await claimQueuedSchedulerJobs(options.maxJobs ?? SYSTEM_SCHEDULER_QUEUE_BATCH_SIZE);
    for (const item of lockedItems) {
        await executeQueuedSchedulerJob(item);
    }
    return lockedItems.length;
}

export async function triggerSystemSchedulerWorker(options: { maxJobs?: number } = {}): Promise<void> {
    if (systemSchedulerWorkerPromise) {
        return systemSchedulerWorkerPromise;
    }

    systemSchedulerWorkerPromise = (async () => {
        try {
            let processed = 0;
            do {
                processed = await runQueuedSystemSchedulerJobs(options);
            } while (processed > 0);
        } finally {
            systemSchedulerWorkerPromise = null;
        }
    })();

    return systemSchedulerWorkerPromise;
}

export async function runSystemSchedulerOnce(options: SchedulerRunOptions = {}): Promise<SchedulerRunResult> {
    const startedAt = new Date();
    const triggeredBy = options.triggeredBy ?? "worker";
    const dryRun = options.dryRun ?? false;
    const config = inspectSystemSchedulerConfig();

    const requestedJobs = (options.jobs && options.jobs.length > 0 ? options.jobs : config.enabledJobs).filter(
        (job) => VALID_JOBS.has(job),
    );

    const orgIds = await resolveTargetOrgIds(options.orgId);
    const jobsExecuted: SchedulerJobResult[] = [];

    const runners: Record<SystemSchedulerJob, () => Promise<string>> = {
        growth_cycle: () => executeGrowthCycle(orgIds, dryRun),
        queue_process: () => executeQueueProcess(orgIds, dryRun),
        whatsapp_retry_dispatch: () => executeWhatsAppRetryDispatch(orgIds, dryRun),
        whatsapp_briefing: () => executeWhatsAppBriefing(dryRun),
        benchmark_generate: () => executeBenchmarkGenerate(dryRun),
        war_room_refresh: () => executeWarRoomRefresh(orgIds, dryRun),
    };

    for (const job of requestedJobs) {
        const jobStart = new Date();
        logger.info("[SystemScheduler] job start", { job, dryRun, triggeredBy, orgId: options.orgId ?? "all" });
        try {
            const detail = await runners[job]();
            logger.info("[SystemScheduler] job done", {
                job,
                dryRun,
                triggeredBy,
                latencyMs: Date.now() - jobStart.getTime(),
                detail,
            });
            jobsExecuted.push({
                job,
                success: true,
                startedAt: jobStart.toISOString(),
                finishedAt: new Date().toISOString(),
                detail,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error("[SystemScheduler] job failed", { job, error: message });
            jobsExecuted.push({
                job,
                success: false,
                startedAt: jobStart.toISOString(),
                finishedAt: new Date().toISOString(),
                detail: "Job failed",
                error: message,
            });
        }
    }

    const success = jobsExecuted.every((result) => result.success);
    const finishedAt = new Date();

    return {
        success,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        triggeredBy,
        dryRun,
        targetOrgCount: orgIds.length,
        jobsRequested: requestedJobs,
        jobsExecuted,
        config,
    };
}
