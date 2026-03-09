import { redirect } from "next/navigation";
import LegacyAdminConfiguracoesPage from "./legacy-page";
import { isLegacyAdminFinalRedirectEnabled } from "@/lib/auth/admin-api-guard";

function isAgencyShellEnabled(): boolean {
    const raw = process.env.FF_AGENCY_SHELL;
    if (typeof raw === "undefined") return true;
    const normalized = raw.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export default async function AdminConfiguracoesAdapterPage() {
    if (isLegacyAdminFinalRedirectEnabled()) {
        redirect("/agency/settings");
    }

    if (isAgencyShellEnabled()) {
        redirect("/agency/settings");
    }

    return <LegacyAdminConfiguracoesPage />;
}
