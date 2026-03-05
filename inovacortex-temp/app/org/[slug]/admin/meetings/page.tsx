import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MeetingsClient } from "./meetings-client";

export const runtime = "nodejs";

export default async function MeetingsPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    let ctx: Awaited<ReturnType<typeof requireOrgContext>>;
    try {
        ctx = await requireOrgContext(slug);
        assertRole(ctx.role, "admin");
    } catch {
        redirect(`/org/${slug}/admin/login`);
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const sessions = await (prisma as any).meetingSession.findMany({
        where: { organizationId: ctx!.orgId, startAt: { gte: since } },
        orderBy: { startAt: "desc" },
        take: 50,
    });

    const sessionIds = sessions.map((s: any) => s.id);
    const performances = sessionIds.length > 0
        ? await (prisma as any).meetingPerformance.findMany({
            where: { sessionId: { in: sessionIds } }
        })
        : [];

    const perfMap: Record<string, any> = {};
    for (const p of performances) perfMap[p.sessionId] = p;

    const enriched = sessions.map((s: any) => ({
        ...s,
        startAt: s.startAt.toISOString(),
        endAt: s.endAt.toISOString(),
        performance: perfMap[s.id] ?? null,
    }));

    return (
        <div className="min-h-screen bg-[#030712] text-white">
            <div className="max-w-6xl mx-auto p-8">
                <div className="mb-8">
                    <a href={`/org/${slug}/admin/cockpit`} className="text-xs text-muted-foreground hover:text-white transition-colors">← Voltar ao Cockpit</a>
                </div>
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-black">Reuniões</h1>
                        <p className="text-sm text-muted-foreground">Últimos 30 dias · {sessions.length} registros</p>
                    </div>
                    <MeetingsClient orgSlug={slug} meetings={enriched} />
                </div>
            </div>
        </div>
    );
}
