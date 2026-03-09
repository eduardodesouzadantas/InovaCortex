import { redirect } from "next/navigation";
import { getAgencyOrgSlug, getAuthContext } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";
import { BuilderClient } from "@/app/org/[slug]/admin/builder/builder-client";
import { isAgencyBuilderEnabled } from "@/lib/builder/agency-builder-scope";

export const runtime = "nodejs";

export default async function AgencyBuilderPage() {
    const auth = await getAuthContext();
    if (!auth.isAuthenticated || auth.authScope !== "agency") {
        redirect("/agency/login");
    }
    if (!auth.role || !hasRole(auth.role, "admin")) {
        redirect("/agency/dashboard");
    }

    const agencySlug = getAgencyOrgSlug();
    if (!isAgencyBuilderEnabled()) {
        redirect(`/org/${agencySlug}/admin/builder`);
    }

    return <BuilderClient orgSlug={agencySlug} apiBasePath="/api/agency/builder" />;
}
