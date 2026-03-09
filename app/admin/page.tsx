import { redirect } from "next/navigation";
import { isLegacyAdminFinalRedirectEnabled } from "@/lib/auth/admin-api-guard";

function isAgencyShellEnabled(): boolean {
    const raw = process.env.FF_AGENCY_SHELL;
    if (typeof raw === "undefined") return true;
    const normalized = raw.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export default function AdminPageAdapter() {
    if (isLegacyAdminFinalRedirectEnabled()) {
        redirect("/agency/dashboard");
    }

    if (isAgencyShellEnabled()) {
        redirect("/agency/dashboard");
    }

    redirect("/admin/login");
}
