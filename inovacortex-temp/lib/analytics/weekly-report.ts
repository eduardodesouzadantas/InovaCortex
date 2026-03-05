/**
 * lib/analytics/weekly-report.ts
 * 
 * V29 AI Business Brain: Weekly Executive Report Generator
 * 
 * Automatically synthesizes a readable Business Intelligence report
 * based on weekly trailing metrics.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { checkAgentBudget } from "@/lib/ai/agent-ops";
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function generateWeeklyExecutiveReport(orgId: string) {
    logger.info(`Generating Weekly Executive Report for org: ${orgId}`);

    // Fetch 7-day data
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const weeklyEvents = await prisma.systemEvent.findMany({
        where: { organizationId: orgId, createdAt: { gte: sevenDaysAgo } },
        select: { type: true }
    });

    const weeklyProposals = await prisma.proposal.findMany({
        where: { orgId, createdAt: { gte: sevenDaysAgo } }
    });

    const accepted = weeklyProposals.filter(p => p.status === 'accepted');
    const totalRevenueCents = accepted.reduce((acc, p) => acc + p.totalValueCents, 0);

    // Get active Strategic Insights for context
    const activeInsights = await prisma.strategicInsight.findMany({
        where: { organizationId: orgId, status: 'active' },
        take: 5
    });

    // Package Data
    const reportData = {
        eventsFound: weeklyEvents.length,
        funnel: {
            proposalsCreated: weeklyProposals.length,
            proposalsWon: accepted.length,
            revenueGenerated: totalRevenueCents / 100
        },
        currentRisks: activeInsights.map(i => ({ title: i.title, impact: i.impactScore }))
    };

    // LLM Generation
    const budget = await checkAgentBudget(orgId, 'business_brain_agent');
    if (!budget.allowed) {
        logger.warn(`Weekly Report halted for org ${orgId}: Budget exceeded.`);
        return null;
    }

    const prompt = `
You are the Chief Intelligence Architect of a B2B platform.
Write a highly professional, concise "Weekly Business Intelligence Report" for the CEO.

Rules:
1. NEVER fabricate numbers. Only mention the exact figures provided.
2. Structure the report into: "Executive Summary", "Funnel Metrics", "Growth Opportunities", and "Operational Risks".
3. Write in markdown format.

Provided Data for last 7 days:
${JSON.stringify(reportData, null, 2)}
`;

    try {
        const { text } = await generateText({
            model: openai('gpt-4o'),
            prompt,
        });

        // We can save this report as an ActionQueue artifact, an ExecPack, or email it.
        // Assuming for V29 MVP we log it and return it for the API endpoint to serve.
        logger.info(`Weekly Report successfully generated for org ${orgId}`);

        return text;
    } catch (error: any) {
        logger.error(`Weekly Report generation failed: ${error.message}`);
        return null;
    }
}
