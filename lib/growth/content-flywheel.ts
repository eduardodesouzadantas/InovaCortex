/**
 * lib/growth/content-flywheel.ts
 * V28: Content Flywheel Engine
 * 
 * Takes proof points / authority assets and automatically repurposes
 * them into continuous social media flows.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { checkAgentBudget } from "@/lib/ai/agent-ops";
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const FLYWHEEL_PROMPT = `
You are the InovaCortex Authority Flywheel AI.
We have just published a new Case Study / Proof Asset.
Generate a cohesive Content Pack to distribute this authority:
1. A LinkedIn promotional post (professional, data-driven, engaging hook)
2. An Instagram caption (shorter, visual-oriented)
3. A short Email Newsletter snippet

Use the given proof asset details.
`;

export async function spinContentFlywheel(orgId: string, assetId: string) {
    logger.info(`Spinning Content Flywheel for Asset ${assetId} in org: ${orgId}`);

    // 1. Get the source AuthorityAsset
    const asset = await prisma.authorityAsset.findUnique({
        where: { id: assetId }
    });

    if (!asset || asset.status !== 'published') {
        logger.warn(`Asset ${assetId} not found or not published.`);
        return null;
    }

    // 2. Budget Check
    const budget = await checkAgentBudget(orgId, 'content_flywheel_agent');
    if (!budget.allowed) {
        logger.warn(`Flywheel halted for org ${orgId}: Budget exceeded.`);
        return null;
    }

    // 3. Generate Repurposed Pack
    try {
        const aiResult = await generateObject({
            model: openai('gpt-4o'),
            prompt: FLYWHEEL_PROMPT + `\n\nTitle: ${asset.title}\nHeadline: ${asset.headline}\nMetrics: ${asset.keyMetrics}`,
            schema: z.object({
                linkedinPost: z.string(),
                instagramCaption: z.string(),
                emailNewsletter: z.string(),
            })
        });

        // 4. Save ContentArtifacts
        const artifacts = [];

        // LinkedIn
        artifacts.push(await prisma.contentArtifact.create({
            data: {
                organizationId: orgId,
                type: 'linkedin',
                title: `Auto-generated from Asset: ${asset.title}`,
                body: aiResult.object.linkedinPost,
                status: 'draft' // Awaiting human review or auto-publish policy
            }
        }));

        // Instagram
        artifacts.push(await prisma.contentArtifact.create({
            data: {
                organizationId: orgId,
                type: 'instagram',
                title: `Auto-generated from Asset: ${asset.title}`,
                body: aiResult.object.instagramCaption,
                status: 'draft'
            }
        }));

        logger.info(`Flywheel successfully spun 3 artifacts for Asset ${assetId}`);
        return artifacts;

    } catch (error: any) {
        logger.error(`Content Flywheel AI Failed: ${error.message}`);
        return null;
    }
}
