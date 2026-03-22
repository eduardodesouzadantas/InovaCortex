export function normalizePathname(pathname: string): string {
    return pathname.split("?")[0].split("#")[0];
}

export function isAgencyPath(pathname: string): boolean {
    const normalized = normalizePathname(pathname);
    return normalized === "/agency" || normalized.startsWith("/agency/");
}

export function isShelllessPath(pathname: string): boolean {
    const normalized = normalizePathname(pathname);
    return normalized === "/mobile"
        || normalized.startsWith("/mobile/")
        || normalized === "/m"
        || normalized.startsWith("/m/")
        || isAgencyPath(normalized);
}

export function isAgencyLoginPath(pathname: string): boolean {
    return normalizePathname(pathname) === "/agency/login";
}
