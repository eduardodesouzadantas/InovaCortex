import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/session";
import { buildAgencySurfaceOverview } from "@/lib/agency/surface-overview";
import { AgencyDashboardView } from "@/app/agency/_components/agency-dashboard-view";

export const runtime = "nodejs";

export default async function AgencyDashboardPage() {
    const auth = await getAuthContext();
    if (!auth.isAuthenticated || auth.authScope !== "agency" || !auth.organizationId) {
        redirect("/agency/login");
    }

    const dashboard = await buildAgencySurfaceOverview(auth.organizationId);

    return <AgencyDashboardView data={dashboard} />;
}
