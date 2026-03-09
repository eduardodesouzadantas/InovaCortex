import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { isAgencyMonitoringNamespaceEnabled } from "@/lib/agency/monitoring/flag";
import { AgencyExecutivePackClient } from "./agency-executive-pack-client";

export const runtime = "nodejs";

export default async function AgencyExecutivePackPage() {
    if (!isAgencyMonitoringNamespaceEnabled()) {
        redirect("/agency/cockpit");
    }

    const auth = await getAuthContext();
    if (!auth.isAuthenticated || auth.authScope !== "agency" || !auth.organizationId) {
        redirect("/agency/login");
    }

    return (
        <section className="space-y-6">
            <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-400/90">Agency Executive Pack</p>
                <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">Executive Pack Generator</h1>
                <p className="max-w-3xl text-sm text-slate-300">
                    Namespace canônico para geração e leitura: <code>/api/agency/executive-pack/*</code>.
                </p>
            </div>

            <AgencyExecutivePackClient defaultOrgId={auth.organizationId} />
        </section>
    );
}
