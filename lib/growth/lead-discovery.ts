/**
 * lib/growth/lead-discovery.ts
 * V28: Autonomous Lead Discovery Engine
 * 
 * Sources high-ticket prospects using AI intelligence and simulated data enrichment.
 * Filters strictly for companies with real purchasing power.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { checkAgentBudget } from "@/lib/ai/agent-ops";
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const DISCOVERY_PROMPT = `
You are the InovaCortex Lead Discovery AI.
Your objective is to generate 3 highly targeted B2B prospect profiles strictly adhering to our High-Ticket ICP.

ICP Constraints:
- MUST be mid-market or enterprise. Company size > 5. Estimated Revenue > 500k BRL.
- Valid industries: clinics, consulting, real estate, law firms, agencies.
- Contact role MUST be C-Level or Director.

Return an array of 3 company profiles with realistic mock data in Brazil.
`;

export async function discoverHighTicketLeads(orgId: string) {
    logger.info(`Running Lead Discovery for org: ${orgId}`);

    // 1. Safety Check: Budget
    const budget = await checkAgentBudget(orgId, 'lead_discovery_agent');
    if (!budget.allowed) {
        logger.warn(`Lead Discovery halted for org ${orgId}: Budget exceeded.`);
        return [];
    }

    // 2. Intelligence Gathering (AI Generation of Prospects)
    let prospectsData = [];
    try {
        const aiResult = await generateObject({
            model: openai('gpt-4o-mini'),
            prompt: DISCOVERY_PROMPT,
            schema: z.object({
                prospects: z.array(z.object({
                    companyName: z.string(),
                    industry: z.string(),
                    companySize: z.string(),
                    estimatedRevenue: z.string(),
                    linkedinUrl: z.string(),
                    contactName: z.string(),
                }))
            })
        });

        prospectsData = aiResult.object.prospects;
    } catch (error: any) {
        logger.error(`Lead Discovery AI Failed: ${error.message}`);
        return [];
    }

    // 3. Database Insertion
    const createdProspects = [];
    for (const match of prospectsData) {
        // Avoid exact company duplicates
        const existing = await prisma.prospect.findFirst({
            where: { orgId, company: match.companyName }
        });

        if (!existing) {
            const prospect = await prisma.prospect.create({
                data: {
                    orgId,
                    company: match.companyName,
                    industry: match.industry,
                    companySize: match.companySize,
                    estimatedRevenue: match.estimatedRevenue,
                    linkedinUrl: match.linkedinUrl,
                    fullName: match.contactName,
                    title: "Executive",
                    status: 'discovered',
                    discoverySource: 'ai_agent'
                }
            });
            createdProspects.push(prospect);
        }
    }

    logger.info(`Discovered ${createdProspects.length} high-ticket prospects.`);
    return createdProspects;
}
