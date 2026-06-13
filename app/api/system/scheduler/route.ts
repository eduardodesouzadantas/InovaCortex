import { after } from "next/server";
import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSessionFromRequest } from "@/lib/auth/admin-session";
import { authErrorResponse } from "@/lib/auth/auth-api-response";
import { apiSuccess } from "@/lib/http/api-response";
import {
    enqueueSystemSchedulerJobs,
    isValidSystemSchedulerJob,
    triggerSystemSchedulerWorker,
    type SystemSchedulerJob,
} from "@/workers/system-scheduler";

export const runtime = "nodejs";

type SchedulerTriggerBody = {
    jobs?: string[];
    orgId?: string;
    dryRun?: boolean;
};

const VALID_SCHEDULER_JOBS: readonly SystemSchedulerJob[] = [
    "growth_cycle",
    "queue_process",
    "whatsapp_briefing",
    "benchmark_generate",
    "war_room_refresh",
] as const;

async function parseBody(request: NextRequest): Promise<SchedulerTriggerBody> {
    try {
        return (await request.json()) as SchedulerTriggerBody;
    } catch {
        return {};
    }
}

async function POSTHandler(request: NextRequest) {
    const admin = await requireAdminSessionFromRequest(request).catch((error) => error);
    if (admin instanceof Error) {
        return authErrorResponse(admin);
    }

    const body = await parseBody(request);
    const requestedJobs = Array.isArray(body.jobs) ? body.jobs : undefined;
    const invalidJobs = (requestedJobs ?? []).filter((job) => !isValidSystemSchedulerJob(job));

    if (invalidJobs.length > 0) {
        return NextResponse.json(
            {
                error: "Invalid scheduler jobs",
                invalidJobs,
                validJobs: VALID_SCHEDULER_JOBS,
            },
            { status: 400 },
        );
    }

    const jobs = requestedJobs?.filter(isValidSystemSchedulerJob);
    const result = await enqueueSystemSchedulerJobs({
        queueOrganizationId: admin.organizationId,
        jobs,
        orgId: typeof body.orgId === "string" && body.orgId.trim() ? body.orgId.trim() : undefined,
        dryRun: Boolean(body.dryRun),
        triggeredBy: "api",
    });

    after(async () => {
        await triggerSystemSchedulerWorker({
            maxJobs: Math.max(1, result.queuedJobs.length || 1),
        });
    });

    return apiSuccess(request, {
        message: "Scheduler cycle triggered",
        queuedJobs: result.queuedJobs,
        duplicateJobs: result.duplicateJobs,
    }, { status: 202 });
}

export const POST = withApiLogging("/api/system/scheduler", "POST", POSTHandler);
