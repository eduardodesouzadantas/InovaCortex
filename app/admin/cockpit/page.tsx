import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isLegacyAdminFinalRedirectEnabled } from "@/lib/auth/admin-api-guard";

export const runtime = "nodejs";

function isAgencyShellEnabled(): boolean {
    const raw = process.env.FF_AGENCY_SHELL;
    if (typeof raw === "undefined") return true;
    const normalized = raw.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

/**
 * /admin/cockpit legacy adapter.
 * While FF_AGENCY_SHELL is ON, cockpit canonical route is /agency/cockpit.
 */
export default async function AdminCockpitAdapterPage() {
    if (isLegacyAdminFinalRedirectEnabled()) {
        redirect("/agency/cockpit");
    }

    if (isAgencyShellEnabled()) {
        redirect("/agency/cockpit");
    }

    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token");

    if (token?.value === "authenticated_true") {
        redirect("/admin");
    }

    redirect("/admin/login");
}
