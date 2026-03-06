
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { computeOrgKPIs, buildLeaderboards } from "@/lib/performance/stats-engine";
import { PerformanceClient } from "./performance-client";
import { prisma } from "@/lib/prisma";

export default async function PerformanceDashboardPage({
    params
}: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    let ctx;
    try {
        ctx = await requireOrgContext(slug);
        assertRole(ctx.role, "admin");
    } catch {
        redirect(`/org/${slug}/admin/login`);
    }

    // Initial load for 30d
    const [overview, leaderboard, snapshots, salesReps, slaBreaches] = await Promise.all([
        computeOrgKPIs(ctx.orgId, "30d"),
        buildLeaderboards(ctx.orgId, "30d"),
        (prisma as any).performanceSnapshot.findMany({
            where: { organizationId: ctx.orgId, window: "30d" },
            orderBy: { createdAt: "desc" },
            take: 14
        }),
        (prisma as any).salesRep.findMany({
            where: { organizationId: ctx.orgId },
            orderBy: { name: "asc" }
        }),
        (prisma as any).whatsAppConversation.findMany({
            where: { organizationId: ctx.orgId, status: "open", slaDueAt: { lt: new Date() } },
            include: { user: true, contact: true }
        })
    ]);

    // Format SLA for the UI
    const formattedSla = slaBreaches.map((b: any) => ({
        id: b.id,
        contactName: b.contact?.name || "Unknown",
        assignedTo: b.user?.name || "Unassigned",
        slaDueAt: b.slaDueAt,
        unreadCount: b.unreadCount,
        preview: b.lastMessagePreview
    }));

    return (
        <PerformanceClient
            slug={slug}
            initialOverview={overview}
            initialLeaderboard={leaderboard}
            initialSnapshots={snapshots}
            initialTeam={salesReps}
            initialSla={formattedSla}
        />
    );
}
