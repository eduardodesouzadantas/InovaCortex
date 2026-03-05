import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { ExecutiveDashboardClient } from "./executive-dashboard-client";

export default async function ExecutiveDashboardPage({
    params,
}: {
    params: { slug: string };
}) {
    const session = await getSession();
    if (!session || session.orgSlug !== params.slug) {
        redirect("/auth/login");
    }

    const org = await prisma.organization.findUnique({
        where: { slug: params.slug },
        select: { id: true, name: true },
    });

    if (!org) {
        redirect("/404");
    }

    return (
        <main className="min-h-screen bg-[#030712] text-slate-100 overflow-x-hidden selection:bg-amber-500/30">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(31,41,55,0.3),transparent_70%)] pointer-events-none" />
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />

            <ExecutiveDashboardClient slug={params.slug} orgName={org.name} />
        </main>
    );
}
