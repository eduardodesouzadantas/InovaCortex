import { NextRequest, NextResponse } from "next/server";
import { withApiLogging, logger } from "@/lib/logger";
import { runScheduledEmailSync } from "@/lib/integrations/email/sync-runner";

export const runtime = "nodejs";

function isProductionDeployment(): boolean {
    return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

function hasValidCronToken(request: NextRequest): boolean {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret) {
        return !isProductionDeployment();
    }

    const authHeader = request.headers.get("authorization");
    if (authHeader === `Bearer ${secret}`) {
        return true;
    }

    const cronHeader = request.headers.get("x-cron-secret");
    return cronHeader === secret;
}

async function handleCronRequest(request: NextRequest) {
    if (!process.env.CRON_SECRET?.trim() && isProductionDeployment()) {
        return NextResponse.json(
            {
                success: false,
                error: "CRON_SECRET is not configured",
            },
            { status: 503 },
        );
    }

    if (!hasValidCronToken(request)) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await runScheduledEmailSync();

        logger.info("[Email Sync Cron] Job finished", {
            provider: result.provider,
            totalEligible: result.totalEligible,
            succeeded: result.succeeded,
            failed: result.failed,
            skipped: result.skipped,
            durationMs: result.durationMs,
        });

        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        logger.error("[Email Sync Cron] Job failed", {
            error: message,
        });

        return NextResponse.json(
            {
                success: false,
                error: "Failed to run scheduled email sync",
            },
            { status: 500 },
        );
    }
}

export const GET = withApiLogging("/api/cron/email-sync", "GET", handleCronRequest);
export const POST = withApiLogging("/api/cron/email-sync", "POST", handleCronRequest);
