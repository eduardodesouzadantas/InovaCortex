import { redirect } from "next/navigation";
import { WhatsAppCRMClient } from "@/app/org/[slug]/admin/whatsapp/whatsapp-crm-client";
import { getAgencyOrgSlug, getAuthContext } from "@/lib/auth/session";

export const runtime = "nodejs";

export default async function AgencyWhatsAppPage() {
    const auth = await getAuthContext();

    if (!auth.isAuthenticated || auth.authScope !== "agency") {
        redirect("/agency/login");
    }

    return <WhatsAppCRMClient slug={getAgencyOrgSlug()} />;
}
