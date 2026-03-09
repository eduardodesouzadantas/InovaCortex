import { NextRequest, NextResponse } from "next/server";
import {
    applyLegacyAdminApiDeprecationHeaders,
    createLegacyAdminWriteFrozenResponse,
    requireAdminApiAccess,
} from "@/lib/auth/admin-api-guard";
import { runBenchmarkGenerate } from "@/lib/agency/monitoring/benchmark-generate-handler";

function hasValidCronToken(request: NextRequest): boolean {
    const authHeader = request.headers.get("authorization");
    if (authHeader === `Bearer ${process.env.CRON_SECRET || "dev-secret"}`) return true;
    if (process.env.NODE_ENV === "production" && process.env.CRON_SECRET) return false;
    return true;
}

function withDeprecation(response: NextResponse, mode?: "session" | "legacy_admin_token") {
    return applyLegacyAdminApiDeprecationHeaders(response, {
        successorPath: "/api/agency/monitoring/cron/benchmark-generate",
        mode,
    });
}

export async function POST(request: NextRequest) {
    let mode: "session" | "legacy_admin_token" | undefined;
    let freezeChecked = false;

    if (!hasValidCronToken(request)) {
        const access = await requireAdminApiAccess(request, {
            requiredRole: "admin",
            allowLegacyTokenFallback: false,
        });
        if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
        mode = access.mode;

        const frozen = createLegacyAdminWriteFrozenResponse({
            successorPath: "/api/agency/monitoring/cron/benchmark-generate",
            mode,
        });
        if (frozen) return frozen;
        freezeChecked = true;
    }

    if (!freezeChecked) {
        const frozen = createLegacyAdminWriteFrozenResponse({
            successorPath: "/api/agency/monitoring/cron/benchmark-generate",
            mode,
        });
        if (frozen) return frozen;
    }

    try {
        const result = await runBenchmarkGenerate(request);
        return withDeprecation(NextResponse.json(result), mode);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === "UNAUTHORIZED_CRON_INVOKER") {
            return withDeprecation(NextResponse.json({ error: "Unauthorized cron invoker" }, { status: 401 }), mode);
        }
        if (message.startsWith("INVALID_WINDOW:")) {
            return withDeprecation(
                NextResponse.json({ error: "Invalid window. Allowed: 7d, 30d, 90d, all" }, { status: 400 }),
                mode,
            );
        }
        return withDeprecation(NextResponse.json({ error: "Failed to generate benchmarks" }, { status: 500 }), mode);
    }
}
