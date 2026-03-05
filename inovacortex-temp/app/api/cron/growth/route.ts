import { NextResponse } from 'next/server';
import { discoverHighTicketLeads } from '@/lib/growth/lead-discovery';
import { runOutboundAutopilot } from '@/lib/growth/outbound-autopilot';
import { detectGrowthSignals } from '@/lib/growth/signal-engine';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/cron/growth
 * Vercel Cron compatible endpoint. 
 * Runs the autonomous growth engine loop.
 */
export async function GET(request: Request) {
    // Add simple header auth to prevent abuse
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    logger.info("CRON: Starting Autonomous Growth Engine cycle");

    try {
        // We run it for all active organizations. For MVP, we just find the first or all that have the feature flag.
        const orgs = await prisma.organization.findMany();

        const results = [];

        for (const org of orgs) {
            logger.info(`Processing Growth Cycle for Org: ${org.id}`);

            // 1. Prospecting
            const leads = await discoverHighTicketLeads(org.id);

            // 2. Outbound Sequencing
            const outbound = await runOutboundAutopilot(org.id);

            // 3. Signal Engine & Deal Acceleration
            const signals = await detectGrowthSignals(org.id);

            // (Content Flywheel is triggered functionally when assets are published, not via cron)

            results.push({
                org: org.id,
                leadsDiscovered: leads.length,
                outboundEnrolled: outbound.enrolled,
                signalsDetected: signals.length
            });
        }

        logger.info("CRON: Autonomous Growth Engine cycle complete");
        return NextResponse.json({ success: true, results });

    } catch (err: any) {
        logger.error(`CRON Failed: ${err.message}`);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
