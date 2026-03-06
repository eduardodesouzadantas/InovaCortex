/**
 * lib/agents/publisher-agent.ts
 * V20.1 Prompt 4/4: Publisher Agent — zero tokens, review-gated.
 *
 * Rules:
 *  - Only publishes plans with status === "approved"
 *  - Respects scheduledFor: skips if now < scheduledFor
 *  - If integration connected → post via API → status "posted"
 *  - If integration NOT connected → build PostingPack → status "ready_to_post"
 *  - Creates PublicationLog for every attempt (idempotent by marketingPlanId)
 *  - Zero LLM tokens
 *
 * Exports:
 *   publishDuePosts(orgId, limit?)
 *   publishOne(marketingPlanId)
 *   buildPostingPack(plan, bestHour) → PostingPack
 */

import { registerAgent } from "@/lib/agentops/registry";
import { getBestSendHour } from "@/lib/services/deal-optimization/send-window";
import { logger } from "@/lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PostingPack {
    text: string;
    headlines: string[];      // 3 short headline variations
    hashtags: string[];
    bestHour: number;         // 0-23
    bestHourLabel: string;    // e.g. "10:00"
    instructions: string;
}

export interface PublishResult {
    marketingPlanId: string;
    day: number;
    platform: string;
    status: "posted" | "ready_to_post" | "skipped" | "failed";
    externalPostId?: string;
    stub?: boolean;
    postingPack?: PostingPack;
    reason?: string;
}

// ─── Headline Generator (deterministic, zero tokens) ─────────────────────────

function generateHeadlines(topic: string, postType: string, platform: string): string[] {
    const t = topic.slice(0, 55);
    const platformSuffix = platform === "linkedin" ? "| LinkedIn" : "";

    const templates: Record<string, string[]> = {
        authority: [`${t}`, `Por que isso importa para o seu negócio`, `A verdade sobre ${t.toLowerCase()}`],
        case: [`${t}: o case completo`, `Como fizemos isso acontecer`, `Resultados reais: ${t.toLowerCase()}`],
        insight: [`${t}`, `O que poucos sabem sobre isso`, `3 coisas essenciais: ${t.toLowerCase()}`],
        demonstration: [`Veja ${t.toLowerCase()} ao vivo`, `${t} — demonstração`, `Como funciona na prática`],
        offer: [`${t}`, `Vagas limitadas: ${t.toLowerCase()}`, `Oportunidade: ${t.toLowerCase()}`],
        myth_break: [`${t} — mito ou verdade?`, `Desmistificando: ${t.toLowerCase()}`, `A realidade sobre ${t.toLowerCase()}`],
    };

    return (templates[postType] ?? [`${t}`, `Sobre ${t.toLowerCase()}`, `${t} ${platformSuffix}`])
        .map(h => h.slice(0, 60));
}

// ─── PostingPack Builder ──────────────────────────────────────────────────────

export function buildPostingPack(plan: {
    id: string;
    platform: string;
    postType: string;
    topic: string;
    contentJson: string | null;
}, bestHour: number): PostingPack {
    let text = "";
    let hashtags: string[] = [];

    if (plan.contentJson) {
        try {
            const parsed = JSON.parse(plan.contentJson);
            text = parsed.text ?? "";
            hashtags = parsed.hashtags ?? [];
        } catch { /* use defaults */ }
    }

    if (!text) {
        text = `[Post sobre: ${plan.topic}]\n\nConteúdo não gerado ainda — use o Content Generator primeiro.`;
    }

    const headlines = generateHeadlines(plan.topic, plan.postType, plan.platform);
    const hh = String(bestHour).padStart(2, "0");
    const bestHourLabel = `${hh}:00`;

    const platformInstructions = plan.platform === "linkedin"
        ? "1. Abra o LinkedIn\n2. Clique em 'Iniciar uma publicação'\n3. Cole o texto abaixo\n4. Publique"
        : "1. Abra o Instagram\n2. Clique em '+' → 'Post'\n3. Adicione uma imagem\n4. Cole o texto na legenda\n5. Publique";

    return {
        text,
        headlines,
        hashtags,
        bestHour,
        bestHourLabel,
        instructions: `📋 PACOTE DE PUBLICAÇÃO — ${plan.platform.toUpperCase()}\n\n` +
            `⏰ Melhor horário: ${bestHourLabel}\n\n` +
            `📝 Título sugerido:\n${headlines[0]}\n\n` +
            `📄 Texto:\n${text}\n\n` +
            `#️⃣ Hashtags:\n${hashtags.join(" ")}\n\n` +
            `📱 Como publicar:\n${platformInstructions}`,
    };
}

// ─── Core: publishOne ─────────────────────────────────────────────────────────

export async function publishOne(marketingPlanId: string): Promise<PublishResult> {
    const { prisma } = await import("@/lib/prisma");

    const plan = await (prisma as any).marketingPlan.findUnique({
        where: { id: marketingPlanId },
    }).catch(() => null);

    if (!plan) {
        return { marketingPlanId, day: 0, platform: "", status: "failed", reason: "Plan not found" };
    }

    // ── Review Gate ───────────────────────────────────────────────────────────
    if (plan.status !== "approved") {
        return {
            marketingPlanId, day: plan.day, platform: plan.platform,
            status: "skipped", reason: `Status is '${plan.status}', requires 'approved'`,
        };
    }

    // ── Scheduling Gate ───────────────────────────────────────────────────────
    if (plan.scheduledFor && new Date() < new Date(plan.scheduledFor)) {
        return {
            marketingPlanId, day: plan.day, platform: plan.platform,
            status: "skipped", reason: `Scheduled for ${plan.scheduledFor}`,
        };
    }

    // ── Check existing log (idempotency) ──────────────────────────────────────
    const existingLog = await (prisma as any).publicationLog.findUnique({
        where: { marketingPlanId },
    }).catch(() => null);

    if (existingLog?.status === "posted") {
        return {
            marketingPlanId, day: plan.day, platform: plan.platform,
            status: "posted", externalPostId: existingLog.externalPostId ?? undefined,
            reason: "Already posted (idempotent)",
        };
    }

    // ── Load social integration ───────────────────────────────────────────────
    const integration = await (prisma as any).socialIntegration.findUnique({
        where: { orgId: plan.orgId },
    }).catch(() => null);

    const isLinkedIn = plan.platform === "linkedin";
    const isInstagram = plan.platform === "instagram";
    const linkedInConnected = integration?.linkedinStatus === "connected";
    const instagramConnected = integration?.instagramStatus === "connected";

    const hasIntegration = (isLinkedIn && linkedInConnected) || (isInstagram && instagramConnected);

    // ── Send Window best hour ─────────────────────────────────────────────────
    let bestHour = 10;
    try {
        const sw = await getBestSendHour(plan.orgId);
        bestHour = sw.hour;
    } catch { /* fallback 10 */ }

    let result: PublishResult;

    if (hasIntegration) {
        // ── Real publish path ─────────────────────────────────────────────────
        try {
            let externalPostId = "";
            let stub = false;

            const contentParsed = (() => {
                try { return JSON.parse(plan.contentJson ?? "{}"); } catch { return {}; }
            })();
            const text = contentParsed.text ?? plan.topic;

            if (isLinkedIn) {
                const { publishToLinkedIn, getLinkedInToken } = await import("@/lib/integrations/linkedin");
                const token = await getLinkedInToken(plan.orgId);
                const res = await publishToLinkedIn(token, { text, orgId: plan.orgId });
                externalPostId = res.externalPostId;
                stub = res.stub;
            } else {
                const { publishToInstagram, getMetaCredentials } = await import("@/lib/integrations/meta-instagram");
                const { accessToken, pageId } = await getMetaCredentials(plan.orgId);
                const res = await publishToInstagram(accessToken, pageId, { text, orgId: plan.orgId });
                externalPostId = res.externalPostId;
                stub = res.stub;
            }

            const postedAt = new Date();

            // Update MarketingPlan
            await (prisma as any).marketingPlan.update({
                where: { id: marketingPlanId },
                data: { status: stub ? "ready_to_post" : "posted", postedAt },
            });

            // Upsert PublicationLog
            await (prisma as any).publicationLog.upsert({
                where: { marketingPlanId },
                create: {
                    orgId: plan.orgId, marketingPlanId, platform: plan.platform,
                    status: stub ? "stub" : "posted",
                    externalPostId, postedAt,
                },
                update: {
                    status: stub ? "stub" : "posted",
                    externalPostId, postedAt, error: null,
                },
            });

            result = {
                marketingPlanId, day: plan.day, platform: plan.platform,
                status: stub ? "ready_to_post" : "posted", externalPostId, stub
            };

        } catch (err: any) {
            logger.error("[Publisher] Publish failed", { marketingPlanId, error: err?.message });

            await (prisma as any).publicationLog.upsert({
                where: { marketingPlanId },
                create: {
                    orgId: plan.orgId, marketingPlanId, platform: plan.platform,
                    status: "failed", error: err?.message ?? "Unknown error",
                },
                update: { status: "failed", error: err?.message ?? "Unknown error" },
            }).catch(() => null);

            result = {
                marketingPlanId, day: plan.day, platform: plan.platform,
                status: "failed", reason: err?.message
            };
        }

    } else {
        // ── Posting Pack path (no integration) ───────────────────────────────
        const pack = buildPostingPack(plan, bestHour);

        // Merge postingPack into contentJson
        let existing: any = {};
        try { existing = JSON.parse(plan.contentJson ?? "{}"); } catch { /* ok */ }

        await (prisma as any).marketingPlan.update({
            where: { id: marketingPlanId },
            data: {
                status: "ready_to_post",
                contentJson: JSON.stringify({ ...existing, postingPack: pack }),
            },
        });

        await (prisma as any).publicationLog.upsert({
            where: { marketingPlanId },
            create: {
                orgId: plan.orgId, marketingPlanId, platform: plan.platform,
                status: "stub",
            },
            update: { status: "stub", error: null },
        }).catch(() => null);

        result = {
            marketingPlanId, day: plan.day, platform: plan.platform,
            status: "ready_to_post", postingPack: pack, stub: true
        };
    }

    logger.info("[Publisher] publishOne done", {
        marketingPlanId, day: plan.day, status: result.status,
    });

    return result;
}

// ─── Core: publishDuePosts ────────────────────────────────────────────────────

export async function publishDuePosts(
    orgId: string,
    limit: number = 10,
): Promise<PublishResult[]> {
    const { prisma } = await import("@/lib/prisma");
    const now = new Date();

    const duePlans = await (prisma as any).marketingPlan.findMany({
        where: {
            orgId,
            status: "approved",
            OR: [
                { scheduledFor: null },
                { scheduledFor: { lte: now } },
            ],
        },
        orderBy: [{ priority: "desc" }, { day: "asc" }],
        take: limit,
        select: { id: true },
    });

    const results = await Promise.allSettled(
        duePlans.map((p: any) => publishOne(p.id))
    );

    return results
        .filter((r): r is PromiseFulfilledResult<PublishResult> => r.status === "fulfilled")
        .map(r => r.value);
}

// ─── Agent Registration ───────────────────────────────────────────────────────

registerAgent(
    "publisher",
    async (input: { orgId: string; limit?: number }) =>
        publishDuePosts(input.orgId, input.limit ?? 10),
    {
        model: "none",
        maxTokens: 0,
        cacheEnabled: false,
        fallbackToTemplate: true,
    },
);
