import { notFound } from "next/navigation";

import { ExecutiveDashboardView } from "../_components/executive-dashboard-view";
import { buildTenantExecutiveDashboard } from "@/lib/executive/tenant-intelligence";

export const runtime = "nodejs";

export default async function TenantExecutivePage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const dashboard = await buildTenantExecutiveDashboard(slug);

    if (!dashboard) {
        notFound();
    }

    return <ExecutiveDashboardView data={dashboard} />;
}
