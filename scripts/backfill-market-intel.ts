import "dotenv/config";
import { backfillSnapshots, inspectBackfillImpact } from "../lib/market-intel/benchmark-engine";
import { isValidMarketWindow, MARKET_WINDOWS, type MarketWindow } from "../lib/market-intel/segment-utils";

function getArg(name: string): string | null {
    const prefix = `--${name}=`;
    const arg = process.argv.find((item) => item.startsWith(prefix));
    return arg ? arg.slice(prefix.length) : null;
}

function parseWindows(value: string | null): MarketWindow[] {
    if (!value || value === "all") return MARKET_WINDOWS;
    const windows = value
        .split(",")
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean);

    if (windows.length === 0) return MARKET_WINDOWS;
    for (const window of windows) {
        if (!isValidMarketWindow(window)) {
            throw new Error(`INVALID_WINDOW:${window}`);
        }
    }
    return Array.from(new Set(windows)) as MarketWindow[];
}

async function main() {
    const windows = parseWindows(getArg("windows"));
    const inspectOnly = getArg("inspect-only") === "1";

    console.log(`[backfill-market-intel] windows=${windows.join(",")}`);

    const impactBefore = await inspectBackfillImpact(windows);
    console.log("[backfill-market-intel] impact-before", JSON.stringify(impactBefore, null, 2));

    if (inspectOnly) {
        console.log("[backfill-market-intel] inspect-only mode. No writes executed.");
        return;
    }

    const result = await backfillSnapshots(windows);
    console.log("[backfill-market-intel] completed", JSON.stringify(result, null, 2));
}

main()
    .catch((error) => {
        console.error("[backfill-market-intel] failed", error);
        process.exit(1);
    });
