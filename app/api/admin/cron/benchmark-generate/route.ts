import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSnapshots } from '@/lib/market-intel/benchmark-engine';

/**
 * POST /api/admin/cron/benchmark-generate
 * Protected Cron Job intended to sweep and build the deterministic segments.
 */
export async function POST(request: Request) {
    try {
        const url = new URL(request.url);
        const window = url.searchParams.get('window') || '30d';

        // Protected check (in a real scenario, compare bearer token with process.env.CRON_SECRET)
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'dev-secret'}`) {
            // Bypass purely for prototype testing simplicity if CRON_SECRET is missing
            if (process.env.NODE_ENV === 'production' && process.env.CRON_SECRET) {
                return NextResponse.json({ error: 'Unauthorized cron invoker' }, { status: 401 });
            }
        }

        // 1. Generate new snapshots
        await generateSnapshots(window as any);

        // 2. Audit Trail
        // We log a generic system audit by attaching it to the first org in the DB as a proxy to "system" for the MVP
        const org = await prisma.organization.findFirst();
        if (org) {
            const dummyAssessment = await prisma.assessment.findFirst({ where: { organizationId: org.id } });
            if (dummyAssessment) {
                await prisma.auditEvent.create({
                    data: {
                        assessmentId: dummyAssessment.id,
                        organizationId: org.id,
                        action: 'benchmarkGenerated',
                        details: `Generated snapshot batch for window ${window}`
                    }
                });
            }
        }

        return NextResponse.json({ success: true, message: `Benchmark snapshots generated for ${window}` });

    } catch (error) {
        console.error("Benchmark Generation Cron Error:", error);
        return NextResponse.json({ error: "Failed to generate benchmarks" }, { status: 500 });
    }
}
