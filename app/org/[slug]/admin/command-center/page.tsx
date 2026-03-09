import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { isAgencyMonitoringNamespaceEnabled } from "@/lib/agency/monitoring/flag";
import { CommandCenter } from "./command-center-client";

export default async function CommandCenterPage({ params }: { params: { slug: string } }) {
    const auth = await getAuthContext();
    if (
        isAgencyMonitoringNamespaceEnabled()
        && auth.isAuthenticated
        && auth.authScope === "agency"
    ) {
        redirect("/agency/command-center");
    }

    return <CommandCenter orgSlug={params.slug} />;
}
