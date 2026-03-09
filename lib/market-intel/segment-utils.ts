export type MarketWindow = "7d" | "30d" | "90d";
export const MARKET_WINDOWS: MarketWindow[] = ["7d", "30d", "90d"];

export function isValidMarketWindow(value: string): value is MarketWindow {
    return MARKET_WINDOWS.includes(value as MarketWindow);
}

export function normalizeIndustry(industry?: string | null): string {
    const normalized = industry?.trim().toLowerCase();
    return normalized && normalized.length > 0 ? normalized : "general";
}

export function normalizePlan(plan?: string | null): string {
    const normalized = plan?.trim().toLowerCase();
    return normalized && normalized.length > 0 ? normalized : "free";
}

export function deriveSizeBand(maxUsers?: number | null): string {
    if (!maxUsers || maxUsers <= 10) return "small";
    if (maxUsers <= 50) return "medium";
    if (maxUsers <= 200) return "large";
    return "enterprise";
}
