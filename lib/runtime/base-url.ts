const LOCAL_FALLBACK = "http://localhost:3000";

const ENV_BASE_URL_KEYS = [
    "NEXT_PUBLIC_BASE_URL",
    "NEXT_PUBLIC_APP_URL",
    "APP_URL",
    "BASE_URL",
] as const;

function normalizeCandidate(raw: string | undefined): string | null {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const candidate = /^https?:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed.replace(/^\/+/, "")}`;

    try {
        const url = new URL(candidate);
        return url.origin.replace(/\/$/, "");
    } catch {
        return null;
    }
}

export function getBaseUrl(): string {
    for (const key of ENV_BASE_URL_KEYS) {
        const normalized = normalizeCandidate(process.env[key]);
        if (normalized) return normalized;
    }

    const vercelUrl = normalizeCandidate(process.env.VERCEL_URL);
    if (vercelUrl) return vercelUrl;

    return LOCAL_FALLBACK;
}

export function toAbsoluteUrl(pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) {
        return pathOrUrl;
    }
    const normalizedPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
    return `${getBaseUrl()}${normalizedPath}`;
}
