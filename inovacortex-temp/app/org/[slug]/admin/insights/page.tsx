import { prisma } from "@/lib/prisma";
import { InsightsClient } from "./insights-client";

export default async function AdminInsightsPage({ params }: { params: { slug: string } }) {
    const { slug } = params;

    const org = await prisma.organization.findUnique({
        where: { slug }
    });

    if (!org) return <div>Org not found</div>;

    // Fetch active insights
    const insights = await prisma.strategicInsight.findMany({
        where: {
            organizationId: org.id
        },
        orderBy: [
            { impactScore: 'desc' },
            { createdAt: 'desc' },
        ],
        take: 20
    });

    return (
        <InsightsClient
            orgSlug={slug}
            insights={insights}
        />
    );
}
