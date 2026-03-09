import { redirect } from "next/navigation";
import LegacyAdminLoginForm from "./legacy-login-form";
import { isLegacyAdminFinalRedirectEnabled } from "@/lib/auth/admin-api-guard";

function isAgencyEntrypointEnabled(): boolean {
    const raw = process.env.FF_AGENCY_ENTRYPOINT;
    if (typeof raw === "undefined") return true;
    const normalized = raw.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export default function AdminLoginPage() {
    if (isLegacyAdminFinalRedirectEnabled()) {
        redirect("/agency/login");
    }

    if (isAgencyEntrypointEnabled()) {
        redirect("/agency/login");
    }

    return <LegacyAdminLoginForm />;
}
