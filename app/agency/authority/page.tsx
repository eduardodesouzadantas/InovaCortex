/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ChevronLeft, Award } from "lucide-react";
import { AgencyAuthorityClient } from "./authority-client";

export const runtime = "nodejs";

export default async function AgencyAuthorityPage() {
    const auth = await getAuthContext();
    if (!auth.isAuthenticated || auth.authScope !== "agency" || !auth.organizationId) {
        redirect("/agency/login");
    }

    const workspaces = await (prisma as any).clientWorkspace.findMany({
        where: { organizationId: auth.organizationId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, status: true, assessmentId: true },
    });

    const assessmentIds = workspaces.map((workspace: any) => workspace.assessmentId).filter(Boolean);
    const assessments = assessmentIds.length
        ? await (prisma as any).assessment.findMany({
            where: { id: { in: assessmentIds } },
            select: { id: true, company: true },
        })
        : [];
    const assessmentById = new Map(assessments.map((assessment: any) => [assessment.id, assessment.company]));

    const workspaceOptions = workspaces.map((workspace: any) => ({
        id: workspace.id,
        status: workspace.status,
        companyName: assessmentById.get(workspace.assessmentId) ?? workspace.assessmentId ?? workspace.id.slice(0, 8),
    }));

    return (
        <div className="min-h-screen bg-background">
            <nav className="sticky top-0 z-40 border-b border-border/50 bg-background/80 px-6 py-3 backdrop-blur-md">
                <div className="mx-auto flex max-w-7xl items-center gap-4">
                    <Link href="/agency/dashboard" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                        <ChevronLeft className="h-4 w-4" /> Agency
                    </Link>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                        <Award className="h-4 w-4 text-primary" /> Authority Library
                    </span>
                </div>
            </nav>

            <main className="mx-auto max-w-7xl px-6 py-8">
                <AgencyAuthorityClient workspaces={workspaceOptions} />
            </main>
        </div>
    );
}
