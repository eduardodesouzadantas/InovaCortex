/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth/session";
import { KanbanBoard } from "@/app/admin/kanban-board";

export const runtime = "nodejs";

export default async function AgencyCommercialLeadsPage() {
    const auth = await getAuthContext();
    if (!auth.isAuthenticated || auth.authScope !== "agency") {
        redirect("/agency/login");
    }

    const assessments = await (prisma as any).assessment.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            artifactReport: true,
            messageLogs: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { status: true },
            },
            assignments: {
                where: { status: "active" },
                include: { salesRep: { select: { name: true } } },
                take: 1,
            },
        },
        take: 500,
    });

    return (
        <section className="space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-cyan-400/90">Agency Commercial</p>
                    <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">Leads Pipeline</h1>
                    <p className="text-sm text-slate-300">Operacao comercial canônica da agency em namespace dedicado.</p>
                </div>
                <Link
                    href="/agency/commercial/workspaces"
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
                >
                    Abrir workspaces
                </Link>
            </header>

            <KanbanBoard
                initialLeads={assessments as any[]}
                apiBasePath="/api/agency/commercial/leads"
                leadBasePath="/agency/commercial/leads"
            />
        </section>
    );
}
