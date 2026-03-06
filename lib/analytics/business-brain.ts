/**
 * lib/analytics/business-brain.ts
 * 
 * V29 AI Business Brain: Strategic Intelligence Layer
 * 
 * Analyzes SystemEvents, Sales Funnel, KPIs, and leverages an LLM Advisor
 * to produce actionable `StrategicInsight` records for the CEO Command Center.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

/**
 * 1. CORE ANALYTICS ENGINE & PATTERN DETECTION
 * Aggregates recent operational data and detects anomalies.
 */
export async function runBusinessAnalyticsEngine(orgId: string) {
    logger.info(`Running Business Analytics Engine for org: ${orgId}`);

    // Gather past 30 days of SystemEvents for pattern detection
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const recentEvents = await prisma.systemEvent.findMany({
        where: {
            organizationId: orgId,
            createdAt: { gte: thirtyDaysAgo }
        },
        select: { type: true, createdAt: true, payloadJson: true }
    });

    // Calculate some basic KPI aggregations
    const eventCounts = recentEvents.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    // Gather Pipeline & Sales Data
    const proposals = await prisma.proposal.findMany({
        where: { organizationId: orgId, createdAt: { gte: thirtyDaysAgo } },
        select: { status: true, pricingEstimate: true, updatedAt: true, createdAt: true }
    });

    const totalProposals = proposals.length;
    const acceptedProposals = proposals.filter(p => p.status === 'accepted').length;
    const proposalAcceptanceRate = totalProposals > 0 ? (acceptedProposals / totalProposals) * 100 : 0;

    // Compute Pipeline Velocity (avg days from proposal creation to acceptance)
    let totalVelocityDays = 0;
    let pipelineVelocityDays = 0;
    const acceptedWithDates = proposals.filter(p => p.status === 'accepted' && p.updatedAt);
    if (acceptedWithDates.length > 0) {
        acceptedWithDates.forEach(p => {
            const diffTime = Math.abs(p.updatedAt!.getTime() - p.createdAt.getTime());
            totalVelocityDays += Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        });
        pipelineVelocityDays = totalVelocityDays / acceptedWithDates.length;
    }

    // Calculate Average Deal Size
    const totalValueCents = acceptedWithDates.reduce((sum, p) => sum + (parseInt(p.pricingEstimate || "0") * 100), 0);
    const averageDealSize = acceptedWithDates.length > 0 ? (totalValueCents / acceptedWithDates.length) / 100 : 0;

    // Structure the raw intelligence
    const rawIntelligence = {
        events: eventCounts,
        sales: {
            proposalsSent: totalProposals,
            proposalsAccepted: acceptedProposals,
            proposalAcceptanceRate,
            pipelineVelocityDays,
            averageDealSize
        },
        detectedAnomalies: [] as string[]
    };

    // --- PATTERN DETECTION ALGORITHMS ---

    if (totalProposals >= 5 && proposalAcceptanceRate < 30) {
        rawIntelligence.detectedAnomalies.push(`Low proposal acceptance rate detected (${proposalAcceptanceRate.toFixed(1)}%). Standard target is >40%.`);
    }

    if (pipelineVelocityDays > 14) {
        rawIntelligence.detectedAnomalies.push(`Slow pipeline velocity. Average time to close is ${pipelineVelocityDays.toFixed(1)} days.`);
    }

    const meetingScheduled = eventCounts['meeting_scheduled'] || 0;
    if (meetingScheduled > 10 && acceptedProposals === 0) {
        rawIntelligence.detectedAnomalies.push(`High meeting volume (${meetingScheduled}) but 0 conversions in the last 30 days.`);
    }

    const outboundReplies = eventCounts['outbound_reply'] || 0;
    if (outboundReplies && outboundReplies < 2) {
        rawIntelligence.detectedAnomalies.push("Outbound sequence response rate is critically low. Campaigns may be stale.");
    }

    // --- MARKET BENCHMARK CONTEXT ---
    // Inject industry benchmarks to give the Brain comparative reasoning.
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { industry: true } });
    const benchmarks: any[] = []; // Neutralized: BenchmarkMetric model not in schema

    if (benchmarks.length > 0) {
        (rawIntelligence as any).industryBenchmarks = benchmarks;
    }

    // Pass to AI Advisor if anomalies exist
    if (rawIntelligence.detectedAnomalies.length > 0 || (totalProposals > 0)) {
        await runAIAdvisor(orgId, rawIntelligence);
    }

    return rawIntelligence;
}


/**
 * 2. AI ADVISOR (Insight Generator)
 * Uses LLM to translate raw data & anomalies into StrategicInsights.
 */
async function runAIAdvisor(orgId: string, intelligence: any) {
    // Budget Check (Neutralized for Controlled Go)
    const budget = { allowed: false };
    if (!budget.allowed) {
        logger.warn(`AI Advisor halted for org ${orgId}: Budget exceeded (Neutralized).`);
        return null;
    }

    const prompt = `
You are the Chief Intelligence Architect of a B2B platform.
Analyze the following operational data, anomalies, and industry benchmarks from the last 30 days.
Generate exactly 2 to 3 high-leverage "Strategic Insights".

Rules:
1. NEVER fabricate financial numbers. Only use the provided data.
2. If industry benchmarks are provided, compare the company's performance to the benchmark to justify the insight.
3. Provide a concrete 'recommendedAction' for each insight.
4. Categorize each insight accurately (sales, marketing, delivery, revenue, operations).
5. Assign an 'impactScore' (1 to 10) denoting the ROI priority of the action.
6. Provide a realistic 'estimatedRevenueImpact' in BRL if applicable, otherwise omit.

Data to Analyze (includes local KPIs and Market Benchmarks):
${JSON.stringify(intelligence, null, 2)}
`;

    try {
        const aiResult = await generateObject({
            model: openai('gpt-4o-mini'),
            prompt,
            schema: z.object({
                insights: z.array(z.object({
                    category: z.enum(["sales", "marketing", "delivery", "revenue", "operations"]),
                    title: z.string(),
                    description: z.string(),
                    impactScore: z.number().min(1).max(10),
                    estimatedRevenueImpact: z.number().optional().nullable(),
                    recommendedAction: z.string()
                }))
            })
        });

        const generatedInsights = aiResult.object.insights;

        for (const insight of generatedInsights) {
            // Deduplicate recent identical insights based on title
            const existing = await prisma.strategicInsight.findFirst({
                where: {
                    organizationId: orgId,
                    title: insight.title,
                    createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // within last 7 days
                }
            });

            if (!existing) {
                await prisma.strategicInsight.create({
                    data: {
                        organizationId: orgId,
                        category: insight.category,
                        title: insight.title,
                        description: insight.description,
                        impactScore: insight.impactScore,
                        estimatedRevenueImpact: insight.estimatedRevenueImpact ?? null,
                        recommendedAction: insight.recommendedAction,
                        status: "active"
                    }
                });
                logger.info(`Generated AI Insight: ${insight.title} for org ${orgId}`);
            }
        }

        return generatedInsights;

    } catch (err: any) {
        logger.error(`AI Advisor computation failed: ${err.message}`);
        return null;
    }
}
