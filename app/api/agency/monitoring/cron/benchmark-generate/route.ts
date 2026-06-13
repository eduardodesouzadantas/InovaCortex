import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { runBenchmarkGenerate } from "@/lib/agency/monitoring/benchmark-generate-handler";

function hasValidCronToken(request: NextRequest): boolean {
    const authHeader = request.headers.get("authorization");
    if (authHeader === `Bearer ${process.env.CRON_SECRET || "dev-secret"}`) return true;
    if (process.env.NODE_ENV === "production" && process.env.CRON_SECRET) return false;
    return true;
}

async function POSTHandler(request: NextRequest) {
    const allowByCron = hasValidCronToken(request);
    if (!allowByCron) {
        const access = await requireAdminApiAccess(request, {
            requiredRole: "admin",
            allowLegacyTokenFallback: false,
        });
        if (!access.ok) {
            return NextResponse.json({ error: access.error }, { status: access.status });
        }
    }

    try {
        const result = await runBenchmarkGenerate(request);
        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === "UNAUTHORIZED_CRON_INVOKER") {
            return NextResponse.json({ error: "Unauthorized cron invoker" }, { status: 401 });
        }
        if (message.startsWith("INVALID_WINDOW:")) {
            return NextResponse.json(
                { error: "Invalid window. Allowed: 7d, 30d, 90d, all" },
                { status: 400 },
            );
        }
        return NextResponse.json({ error: "Failed to generate benchmarks" }, { status: 500 });
    }
}

export const POST = withApiLogging("/api/agency/monitoring/cron/benchmark-generate", "POST", POSTHandler);
