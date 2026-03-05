/**
 * lib/authority/proof-engine.ts
 * V21 Prompt 2/4: Authority Flywheel — Proof Engine.
 *
 * Transforms completed ClientWorkspace into:
 *   - case_study  (Markdown)
 *   - linkedin_case (LinkedIn post)
 *   - stat_card   (3-5 numbers)
 *
 * Functions:
 *   extractWorkspaceMetrics(workspaceId)  → ProofMetrics
 *   anonymizeWorkspaceContext(...)        → string label
 *   generateProofPack(orgId, workspaceId) → 3 ProofAsset rows (draft)
 *   recalcProofStats(orgId)              → upsert ProofStatSnapshot
 *
 * Guardrails:
 *   - anonLevel "none" + allowPublicName != true → blocked
 *   - Never published without approved
 *   - STUB mode when no OPENAI_API_KEY / budget exceeded
 */

import { assertBudget, trackUsage, BudgetExceededError } from "@/lib/agentops/budget";
import { makeCacheKey, getCached, setCached } from "@/lib/agentops/cache";
import { logger } from "@/lib/logger";
import {
    buildStubProofPack,
    buildAnonLabel,
    type ProofMetrics,
    type ProofPack,
} from "./stub-proof-pack";

// ─── Cost estimation ──────────────────────────────────────────────────────────

function estimateCost(inTok: number, outTok: number): number {
    return (inTok / 1_000_000) * 0.15 + (outTok / 1_000_000) * 0.60;
}

// ─── extractWorkspaceMetrics ──────────────────────────────────────────────────

export async function extractWorkspaceMetrics(workspaceId: string): Promise<ProofMetrics> {
    const { prisma } = await import("@/lib/prisma");

    const workspace = await (prisma as any).clientWorkspace.findUnique({
        where: { id: workspaceId },
    });
    if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`);

    // Load Proposal for modules + roi snapshot
    const proposal = await (prisma as any).proposal.findUnique({
        where: { id: workspace.proposalId },
    }).catch(() => null);

    // Load Assessment for sector + team size + ROI projection
    const assessment = await (prisma as any).assessment.findUnique({
        where: { id: workspace.assessmentId },
    }).catch(() => null);

    const roiProjection = assessment
        ? await (prisma as any).roiProjection.findUnique({
            where: { assessmentId: assessment.id },
        }).catch(() => null)
        : null;

    // Parse modules
    let modules: string[] = [];
    if (proposal?.modules) {
        try {
            const parsed = JSON.parse(proposal.modules);
            modules = Array.isArray(parsed)
                ? parsed.map((m: any) => m?.title ?? m?.name ?? String(m)).filter(Boolean)
                : [];
        } catch { /* ok */ }
    }

    // Parse ROI snapshot from proposal (priority) or live projection
    let monthlyEconomy = 0;
    let monthlyRevenue = 0;
    let hoursSaved = 0;
    let paybackMonths = 0;

    if (proposal?.roiSnapshot) {
        try {
            const roi = JSON.parse(proposal.roiSnapshot);
            monthlyEconomy = roi.operationalSavingsEstimate ?? roi.monthlyEconomy ?? 0;
            monthlyRevenue = roi.revenueIncreaseEstimate ?? roi.monthlyRevenue ?? 0;
            hoursSaved = roi.monthlyHoursRecovered ?? roi.hoursSaved ?? 0;
            paybackMonths = roi.estimatedPaybackMonths ?? roi.paybackMonths ?? 0;
        } catch { /* ok */ }
    }

    if (monthlyEconomy === 0 && roiProjection) {
        monthlyEconomy = roiProjection.operationalSavingsEstimate ?? 0;
        monthlyRevenue = roiProjection.revenueIncreaseEstimate ?? 0;
        hoursSaved = roiProjection.monthlyHoursRecovered ?? 0;
        paybackMonths = roiProjection.estimatedPaybackMonths ?? 0;
    }

    // Sector + team size from assessment
    const sector = assessment?.segment ?? assessment?.nicho ?? "empresa";
    const teamSizeLabel = assessment?.teamSize ?? "equipe";

    // Days to go-live
    const goLiveAt = workspace.goLiveAt ? new Date(workspace.goLiveAt) : new Date();
    const createdAt = new Date(workspace.createdAt);
    const diasGoLive = Math.max(1, Math.round((goLiveAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)));

    return {
        sector,
        teamSizeLabel,
        monthlyEconomy,
        monthlyRevenue,
        hoursSaved,
        paybackMonths,
        diasGoLive,
        modules: modules.length > 0 ? modules : ["automação de atendimento"],
        anonLabel: buildAnonLabel(sector, teamSizeLabel, "full"),
    };
}

// ─── anonymizeWorkspaceContext ────────────────────────────────────────────────

export async function anonymizeWorkspaceContext(
    workspaceId: string,
    level: "full" | "sector_only" | "size_only" | "none",
): Promise<string> {
    const { prisma } = await import("@/lib/prisma");

    const workspace = await (prisma as any).clientWorkspace.findUnique({
        where: { id: workspaceId },
        select: { assessmentId: true, allowPublicName: true },
    }).catch(() => null);

    // Guardrail: none + !allowPublicName → fallback to full
    if (level === "none" && !workspace?.allowPublicName) {
        logger.warn("[ProofEngine] anonLevel=none but allowPublicName!=true, falling back to 'full'", { workspaceId });
        level = "full";
    }

    const assessment = workspace?.assessmentId
        ? await (prisma as any).assessment.findUnique({
            where: { id: workspace.assessmentId },
            select: { segment: true, nicho: true, teamSize: true, company: true },
        }).catch(() => null)
        : null;

    const sector = assessment?.segment ?? assessment?.nicho ?? "empresa";
    const teamSize = assessment?.teamSize ?? "equipe";
    const realName = assessment?.company;

    return buildAnonLabel(sector, teamSize, level, realName);
}

// ─── LLM Prompt ──────────────────────────────────────────────────────────────

function buildProofPrompt(metrics: ProofMetrics): string {
    return `Você é um copywriter B2B especialista em cases de sucesso para empresas de AI/automação.

Crie 3 ativos de prova para um case real (anonimizado), usando SOMENTE os dados fornecidos.

DADOS REAIS (não invente números):
- Cliente: ${metrics.anonLabel}
- Módulos: ${metrics.modules.join(", ")}
- Economia mensal: R$ ${Math.round(metrics.monthlyEconomy).toLocaleString("pt-BR")}
- Receita adicional mensal: R$ ${Math.round(metrics.monthlyRevenue).toLocaleString("pt-BR")}
- Horas recuperadas/mês: ${metrics.hoursSaved}h
- Payback estimado: ${metrics.paybackMonths} meses
- Dias para go-live: ${metrics.diasGoLive}

REGRAS:
- Dados reais apenas, sem exageros
- Tom consultivo, profissional
- Português brasileiro
- case_study_md: markdown completo (contexto, desafio, solução, resultados em tabela)
- linkedin_post: 150-200 palavras, dados reais, CTA no final
- stat_card: exatamente 5 strings (números de prova, curtos)

Responda APENAS com JSON válido, sem markdown:
{
  "case_study_md": "...",
  "linkedin_post": "...",
  "stat_card": ["...", "...", "...", "...", "..."]
}`;
}

// ─── generateProofPack ────────────────────────────────────────────────────────

export async function generateProofPack(
    orgId: string,
    workspaceId: string,
    anonLevel: "full" | "sector_only" | "size_only" | "none" = "full",
): Promise<{ assetIds: string[]; stub: boolean }> {
    const { prisma } = await import("@/lib/prisma");

    // Load metrics
    const metrics = await extractWorkspaceMetrics(workspaceId);
    metrics.anonLabel = await anonymizeWorkspaceContext(workspaceId, anonLevel);

    // ── Cache check ───────────────────────────────────────────────────────────
    const model = "gpt-4o-mini";
    const { keyHash } = makeCacheKey("proof_pack", model, { metrics, anonLevel });

    let pack: ProofPack;
    let isStub = false;
    let tokensUsed = 0;
    let costUsd = 0;

    const cacheHit = await getCached(orgId, keyHash, 7 * 24 * 60 * 60 * 1000);
    if (cacheHit) {
        logger.info("[ProofEngine] Cache hit", { orgId, workspaceId });
        pack = cacheHit.output as ProofPack;
    } else {
        // ── Budget ────────────────────────────────────────────────────────────
        let budgetOk = true;
        try { await assertBudget(orgId, 1500); }
        catch (err) {
            if (err instanceof BudgetExceededError) { budgetOk = false; }
            else throw err;
        }

        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey || !budgetOk) {
            isStub = true;
            pack = buildStubProofPack(metrics);
        } else {
            try {
                const { generateText } = await import("ai");
                const { createOpenAI } = await import("@ai-sdk/openai");
                const openai = createOpenAI({ apiKey });

                const response = await generateText({
                    model: openai(model),
                    prompt: buildProofPrompt(metrics),
                    temperature: 0.55,
                });

                const raw = (response.text ?? "")
                    .replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

                const usage = (response.usage as any) ?? {};
                tokensUsed = (usage.promptTokens ?? usage.inputTokens ?? 0)
                    + (usage.completionTokens ?? usage.outputTokens ?? 0);
                costUsd = estimateCost(
                    usage.promptTokens ?? usage.inputTokens ?? 0,
                    usage.completionTokens ?? usage.outputTokens ?? 0,
                );

                pack = JSON.parse(raw) as ProofPack;

                await setCached(orgId, keyHash, {
                    agentName: "proof_pack", model, inputObj: metrics, outputObj: pack, tokensUsed, costUsd,
                }).catch(() => null);
                await trackUsage(orgId, tokensUsed, costUsd).catch(() => null);

            } catch (err: any) {
                logger.error("[ProofEngine] LLM failed, STUB fallback", { orgId, error: err?.message });
                isStub = true;
                pack = buildStubProofPack(metrics);
            }
        }
    }

    // ── Save 3 ProofAssets (upsert for idempotency) ───────────────────────────
    const metricsJson = JSON.stringify(metrics);

    const types: Array<{ type: string; title: string; body: string }> = [
        { type: "case_study", title: `Case: ${metrics.anonLabel}`, body: pack.case_study_md },
        { type: "linkedin_case", title: `LinkedIn: ${metrics.anonLabel}`, body: pack.linkedin_post },
        { type: "stat_card", title: `Stats: ${metrics.anonLabel}`, body: pack.stat_card.join("\n") },
    ];

    const assetIds: string[] = [];

    for (const entry of types) {
        const existing = await (prisma as any).proofAsset.findFirst({
            where: { orgId, workspaceId, type: entry.type, anonLevel },
        }).catch(() => null);

        let asset;
        if (existing) {
            asset = await (prisma as any).proofAsset.update({
                where: { id: existing.id },
                data: { title: entry.title, body: entry.body, metricsJson, status: "draft" },
            });
        } else {
            asset = await (prisma as any).proofAsset.create({
                data: {
                    orgId, workspaceId, type: entry.type, anonLevel,
                    title: entry.title, body: entry.body, metricsJson,
                    status: "draft",
                },
            });
        }
        assetIds.push(asset.id);
    }

    logger.info("[ProofEngine] generateProofPack done", { orgId, workspaceId, assetIds, isStub });
    return { assetIds, stub: isStub };
}

// ─── recalcProofStats ─────────────────────────────────────────────────────────

export async function recalcProofStats(orgId: string): Promise<void> {
    const { prisma } = await import("@/lib/prisma");

    // Get all approved/published case_study assets (one per workspace)
    const assets = await (prisma as any).proofAsset.findMany({
        where: { orgId, type: "case_study", status: { in: ["approved", "published"] } },
    }).catch(() => []);

    if (assets.length === 0) {
        await (prisma as any).proofStatSnapshot.upsert({
            where: { orgId },
            create: { orgId, totalCases: 0, avgPaybackMonths: 0, avgMonthlyEconomy: 0, avgMonthlyRevenue: 0, avgHoursSaved: 0 },
            update: { totalCases: 0, avgPaybackMonths: 0, avgMonthlyEconomy: 0, avgMonthlyRevenue: 0, avgHoursSaved: 0 },
        }).catch(() => null);
        return;
    }

    let sumPayback = 0, sumEconomy = 0, sumRevenue = 0, sumHours = 0, count = 0;

    for (const asset of assets) {
        try {
            const m = JSON.parse(asset.metricsJson ?? "{}");
            sumPayback += m.paybackMonths ?? 0;
            sumEconomy += m.monthlyEconomy ?? 0;
            sumRevenue += m.monthlyRevenue ?? 0;
            sumHours += m.hoursSaved ?? 0;
            count++;
        } catch { /* skip */ }
    }

    const avg = (sum: number) => count > 0 ? Math.round((sum / count) * 100) / 100 : 0;

    await (prisma as any).proofStatSnapshot.upsert({
        where: { orgId },
        create: {
            orgId,
            totalCases: count,
            avgPaybackMonths: avg(sumPayback),
            avgMonthlyEconomy: avg(sumEconomy),
            avgMonthlyRevenue: avg(sumRevenue),
            avgHoursSaved: avg(sumHours),
        },
        update: {
            totalCases: count,
            avgPaybackMonths: avg(sumPayback),
            avgMonthlyEconomy: avg(sumEconomy),
            avgMonthlyRevenue: avg(sumRevenue),
            avgHoursSaved: avg(sumHours),
        },
    }).catch((err: any) => logger.warn("[ProofEngine] recalcProofStats upsert failed", { error: err?.message }));

    logger.info("[ProofEngine] recalcProofStats done", { orgId, totalCases: count });
}
