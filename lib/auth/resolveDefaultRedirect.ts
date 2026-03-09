import { getAuthContext, isAuthContextSplitEnabled } from "./session";
import { hasAuthScope } from "./rbac";

function isAgencyEntrypointEnabled(): boolean {
    const raw = process.env.FF_AGENCY_ENTRYPOINT;
    if (typeof raw === "undefined") return true;
    const normalized = raw.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function isAgencyShellEnabled(): boolean {
    const raw = process.env.FF_AGENCY_SHELL;
    if (typeof raw === "undefined") return true;
    const normalized = raw.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

/**
 * Resolves the default redirect path based on user session and role.
 * Used for the "Empire CTA" and other general entry points.
 */
export async function resolveDefaultRedirect(): Promise<string> {
    const auth = await getAuthContext();

    if (!auth.isAuthenticated || !auth.role || !auth.organizationSlug) {
        return isAgencyEntrypointEnabled() ? "/agency/login" : "/admin/login";
    }

    const { role, organizationSlug } = auth;

    if (isAuthContextSplitEnabled() && hasAuthScope(auth, "agency")) {
        if (isAgencyShellEnabled()) {
            return "/agency/dashboard";
        }

        switch (role) {
            case "owner":
                return `/org/${organizationSlug}/admin/command-center`;
            case "admin":
            case "closer":
            case "viewer":
            default:
                return `/org/${organizationSlug}/admin`;
        }
    }

    switch (role) {
        case "owner":
            return `/org/${organizationSlug}/admin/command-center`;
        case "admin":
        case "closer":
        case "viewer":
        default:
            return `/org/${organizationSlug}/admin`;
    }
}
