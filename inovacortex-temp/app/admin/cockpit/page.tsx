import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

/**
 * /admin/cockpit — redirect shim
 * Redirects authenticated admin users to the classic Mission Control dashboard.
 */
export default async function AdminCockpitRedirect() {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token");

    // If user has the simple admin_token, send to /admin
    if (token?.value === "authenticated_true") {
        redirect("/admin");
    }

    // No session: send to login
    redirect("/admin/login");
}
