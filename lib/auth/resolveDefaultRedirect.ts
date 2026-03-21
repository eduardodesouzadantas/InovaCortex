import { getAuthContext, isAuthContextSplitEnabled } from "./session";
import { hasAuthScope } from "./rbac";

/**
 * Resolves the default redirect path based on user session and role.
 * Used for the "Empire CTA" and other general entry points.
 */
export async function resolveDefaultRedirect(): Promise<string> {
    const auth = await getAuthContext();

    if (!auth.isAuthenticated || !auth.role || !auth.organizationSlug) {
        return "/acesso";
    }

    const { role, organizationSlug } = auth;

    if (isAuthContextSplitEnabled() && hasAuthScope(auth, "agency")) {
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
