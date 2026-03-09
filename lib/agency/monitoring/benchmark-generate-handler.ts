import {
    backfillSnapshots,
    generateSnapshots,
    inspectBackfillImpact,
} from "@/lib/market-intel/benchmark-engine";
import {
    isValidMarketWindow,
    MARKET_WINDOWS,
    type MarketWindow,
} from "@/lib/market-intel/segment-utils";

function parseBool(value: string | null): boolean {
    if (!value) return false;
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseWindows(windowParam: string): MarketWindow[] {
    if (windowParam === "all") return MARKET_WINDOWS;
    if (!isValidMarketWindow(windowParam)) {
        throw new Error(`INVALID_WINDOW:${windowParam}`);
    }
    return [windowParam];
}

function isAuthorizedCronInvoker(request: Request): boolean {
    const authHeader = request.headers.get("authorization");
    if (authHeader === `Bearer ${process.env.CRON_SECRET || "dev-secret"}`) return true;
    if (process.env.NODE_ENV === "production" && process.env.CRON_SECRET) return false;
    return true;
}

export async function runBenchmarkGenerate(request: Request): Promise<Record<string, unknown>> {
    if (!isAuthorizedCronInvoker(request)) {
        const error = new Error("UNAUTHORIZED_CRON_INVOKER");
        (error as Error & { status?: number }).status = 401;
        throw error;
    }

    const url = new URL(request.url);
    const windowParam = (url.searchParams.get("window") || "30d").toLowerCase();
    const windows = parseWindows(windowParam);
    const backfill = parseBool(url.searchParams.get("backfill"));
    const dryRun = parseBool(url.searchParams.get("dry_run"));

    const impact = await inspectBackfillImpact(windows);
    if (dryRun) {
        return { success: true, mode: "dry_run", windows, impact };
    }

    let result: unknown;
    if (backfill) {
        result = await backfillSnapshots(windows);
    } else {
        const generated = [];
        for (const window of windows) {
            generated.push(await generateSnapshots(window));
        }
        result = { windows, generated };
    }

    return {
        success: true,
        mode: backfill ? "backfill" : "generate",
        windows,
        impactBefore: impact,
        result,
    };
}
