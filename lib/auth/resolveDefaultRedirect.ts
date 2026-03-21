import { getAuthContext, isAuthContextSplitEnabled } from "./session";
import { hasAuthScope } from "./rbac";

/**
 * Resolves the default redirect path based on user session and role.
 * Used for general entry points and legacy redirects.
 */
export async function resolveDefaultRedirect(): Promise<string> {
    const auth = await getAuthContext();

    if (!auth.isAuthenticated || !auth.role || !auth.organizationSlug) {
        return "/empresa/login";
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
