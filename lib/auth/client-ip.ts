import { isIP } from "net";

const PROXY_HEADERS = [
    "x-forwarded-for",
    "x-vercel-forwarded-for",
    "x-real-ip",
    "cf-connecting-ip",
    "true-client-ip",
    "forwarded",
] as const;

function normalizeCandidate(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (trimmed.toLowerCase().startsWith("for=")) {
        const forwardedMatch = trimmed.match(/for=(?:"?\[?([^\];",\s]+)\]?"?)/i);
        if (forwardedMatch?.[1]) {
            return normalizeCandidate(forwardedMatch[1]);
        }
    }

    const commaSeparated = trimmed.split(",")[0]?.trim() ?? "";
    if (!commaSeparated) return null;

    const bracketMatch = commaSeparated.match(/^\[([^\]]+)\](?::\d+)?$/);
    if (bracketMatch?.[1] && isIP(bracketMatch[1])) {
        return bracketMatch[1];
    }

    if (isIP(commaSeparated)) {
        return commaSeparated;
    }

    const ipv4PortMatch = commaSeparated.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
    if (ipv4PortMatch?.[1] && isIP(ipv4PortMatch[1])) {
        return ipv4PortMatch[1];
    }

    return null;
}

function resolveHeaderIp(request: Request, headerName: string): string | null {
    const value = request.headers.get(headerName);
    if (!value) return null;

    if (headerName === "forwarded") {
        const matches = value.split(",").map((part) => part.trim());
        for (const part of matches) {
            const candidate = normalizeCandidate(part);
            if (candidate) return candidate;
        }
        return null;
    }

    return normalizeCandidate(value);
}

export function resolveClientIp(request: Request): string {
    for (const headerName of PROXY_HEADERS) {
        const candidate = resolveHeaderIp(request, headerName);
        if (candidate) return candidate;
    }

    return "unknown-ip";
}

