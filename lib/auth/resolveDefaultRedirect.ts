import { getSession } from "./session";

/**
 * Resolves the default redirect path based on user session and role.
 * Used for the "Empire CTA" and other general entry points.
 */
export async function resolveDefaultRedirect(): Promise<string> {
    const session = await getSession();

    if (!session) {
        return "/login";
    }

    const { role, orgSlug } = session;

    switch (role) {
        case "owner":
            return `/org/${orgSlug}/admin/command-center`;
        case "admin":
            return "/admin";
        case "closer":
        case "viewer":
            return `/org/${orgSlug}/admin`;
        default:
            return "/login";
    }
}
