import { redirect, notFound } from "next/navigation";

import { AccountStatusBanner } from "@/components/billing/account-status-banner";
import { getAuthContext } from "@/lib/auth/session";
import { requireOrgContext, resolveOrgContextFromAgencySession } from "@/lib/auth/org-context";
import { loadMobileCommandSurface } from "@/lib/mobile/mobile-surface";

import { MobileCommandSurfaceClient } from "./mobile-command-surface-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function MobilePage() {
    const auth = await getAuthContext();
    const organizationSlug = auth.organizationSlug;

    if (!auth.isAuthenticated || !organizationSlug) {
        redirect("/agency/login");
    }

    const orgContext = await (async () => {
        try {
            return auth.authScope === "agency"
                ? await resolveOrgContextFromAgencySession(organizationSlug, auth)
                : await requireOrgContext(organizationSlug);
        } catch {
            redirect("/agency/login");
        }
    })();

    const data = await loadMobileCommandSurface({
        organizationId: orgContext.orgId,
        organizationSlug: orgContext.orgSlug,
    });

    if (!data) {
        notFound();
    }

    return (
        <div className="space-y-4">
            <AccountStatusBanner slug={orgContext.orgSlug} subscriptionStatus={orgContext.subscriptionStatus} />
            <MobileCommandSurfaceClient slug={orgContext.orgSlug} data={data} />
        </div>
    );
}
