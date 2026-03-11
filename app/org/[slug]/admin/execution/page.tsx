import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ExecutionClient from "./execution-client";
import { getCurrentUser } from "@/lib/auth/server-utils";
import { getAuthContext } from "@/lib/auth/session";
import { isAgencyMonitoringNamespaceEnabled } from "@/lib/agency/monitoring/flag";

export const metadata = {
    title: "Execution Center | InovaCortex",
};

export default async function ExecutionCenterPage({ params }: { params: { slug: string } }) {
    const auth = await getAuthContext();
    if (isAgencyMonitoringNamespaceEnabled() && auth.isAuthenticated && auth.authScope === "agency") {
        redirect("/agency/monitoring");
    }

    const user = await getCurrentUser();
    if (!user || user.organization?.slug !== params.slug) redirect(`/org/${params.slug}/admin/login`);

    // Fetch initial data
    const playbooks = await prisma.playbook.findMany({
        where: { organizationId: user.organizationId },
        include: { runs: { take: 5, orderBy: { createdAt: "desc" } } },
        orderBy: { createdAt: "desc" },
    });

    const approvals = await prisma.playbookApproval.findMany({
        where: { organizationId: user.organizationId, status: "pending" },
        orderBy: { createdAt: "desc" },
    });

    return (
        <div className="flex-1 space-y-6 p-8 bg-zinc-950/50 min-h-screen text-zinc-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                        Execution Center
                        <span className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 text-xs font-semibold uppercase tracking-wider border border-violet-500/20">
                            V41 Core
                        </span>
                    </h1>
                    <p className="text-zinc-400 mt-1">Autonomous playbooks, approvals & deep analytics.</p>
                </div>
            </div>

            <ExecutionClient
                orgSlug={params.slug}
                initialPlaybooks={playbooks}
                initialApprovals={approvals}
                currentUser={user}
            />
        </div>
    );
}
