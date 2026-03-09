import { redirect } from "next/navigation";
import { isLegacyAdminFinalRedirectEnabled } from "@/lib/auth/admin-api-guard";

function isAgencyCommercialUiEnabled(): boolean {
    const raw = process.env.FF_AGENCY_COMMERCIAL_UI;
    if (typeof raw === "undefined") return true;
    const normalized = raw.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export default async function AdminLeadPageAdapter({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    if (isLegacyAdminFinalRedirectEnabled()) {
        redirect(`/agency/commercial/leads/${id}`);
    }

    if (isAgencyCommercialUiEnabled()) {
        redirect(`/agency/commercial/leads/${id}`);
    }

    redirect("/admin");
}
