import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import * as jose from 'jose';

/**
 * GET /api/org/[slug]/market-intel/snapshots?window=30d
 * Returns aggregated benchmark metrics for an organization's segment,
 * providing the orgCount to prove K-Anonymity without leaking orgIds.
 * 
 * Includes an AuditEvent.
 */
export async function GET(
    request: Request,
    { params }: { params: { slug: string } }
) {
    try {
        const { slug } = params;
        const url = new URL(request.url);
        const window = url.searchParams.get('window') || '30d';

        // 1. RBAC Auth Check (Simplified logic for POC)
        const token = cookies().get('admin_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Retrieve ORG to figure out its dimensions
        const org = await prisma.organization.findUnique({
            where: { slug },
            select: { id: true, plan: true }
        });

        if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

        const industry = (org as any).industry || "general";
        const sizeBand = (org as any).sizeBand || "small";
        const plan = org.plan || "free";

        // 2. Fetch Snapshots that loosely match the org's dimensions (fallback to generic buckets)
        // If a segment collapsed (e.g. sizeBand fell back to "all"), we want to match it.
        // We'll query backwards from most specific to least specific.

        let targetSegment = await prisma.benchmarkSegment.findFirst({
            where: { industry, sizeBand, plan, timeWindow: window },
            include: { snapshots: { orderBy: { createdAt: 'desc' }, take: 1 } },
            orderBy: { periodEnd: 'desc' }
        });

        if (!targetSegment) {
            targetSegment = await prisma.benchmarkSegment.findFirst({
                where: { industry, sizeBand, plan: 'all', timeWindow: window },
                include: { snapshots: { orderBy: { createdAt: 'desc' }, take: 1 } },
                orderBy: { periodEnd: 'desc' }
            });
        }

        if (!targetSegment) {
            targetSegment = await prisma.benchmarkSegment.findFirst({
                where: { industry, sizeBand: 'all', plan: 'all', timeWindow: window },
                include: { snapshots: { orderBy: { createdAt: 'desc' }, take: 1 } },
                orderBy: { periodEnd: 'desc' }
            });
        }

        if (!targetSegment) {
            return NextResponse.json({ insufficient_data: true, message: 'No K-Anonymity benchmark bucket available for this segment yet.' }, { status: 204 });
        }

        // 3. Log Audit Event
        const dummyAssessment = await prisma.assessment.findFirst({ where: { organizationId: org.id } });
        if (dummyAssessment) {
            await prisma.auditEvent.create({
                data: {
                    assessmentId: dummyAssessment.id,
                    organizationId: org.id,
                    action: 'benchmarkViewed',
                    details: `Viewed benchmark for segment ${targetSegment.id}`
                }
            });
        }

        return NextResponse.json({
            segment: {
                orgCount: targetSegment.orgCount,
                industry: targetSegment.industry,
                sizeBand: targetSegment.sizeBand,
                plan: targetSegment.plan,
                periodEnd: targetSegment.periodEnd
            },
            snapshot: targetSegment.snapshots[0] ? JSON.parse(targetSegment.snapshots[0].metrics) : null
        });

    } catch (error) {
        console.error("Market Intel GET Error:", error);
        return NextResponse.json({ error: "Failed to fetch benchmarks" }, { status: 500 });
    }
}
