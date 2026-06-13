/**
 * lib/authority-engine.ts
 * R4: Authority Amplifier — extract real metrics, anonymize, generate narratives,
 * update proof library, and track usage across proposals.
 *
 * Flow:
 *   Workspace (completed) → extractClientMetrics()
 *   → anonymizeMetrics() at desired level
 *   → generateAuthorityAsset(type, metrics)
 *   → save to AuthorityAsset (status: "internal")
 *   → admin reviews → status: "anonymized" → "approved" → "published"
 *   → updateProofStatistics() after approval
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import {
    anonymizeMetrics,
    categorizeCompanySize,
    aggregateStatistics,
    ASSET_PROMPTS,
    type AuthorityAssetType,
    type AnonLevel,
    type ClientMetrics,
} from "@/lib/authority-templates";
import { assertAIEngineAvailable, isAIUnavailableError, toAIUnavailableError } from "@/lib/http/route-errors";

// ─── Metrics Extractor ────────────────────────────────────────────────────────

/**
 * Pull real numbers from a completed workspace + its linked data.
 * Returns null if insufficient data to build a case.
 */
export async function extractClientMetrics(
    workspaceId: string,
    orgId?: string,
): Promise<ClientMetrics | null> {
    const workspace = await (prisma as any).clientWorkspace.findFirst({
        where: { id: workspaceId, ...(orgId ? { organizationId: orgId } : {}) },
        include: {
            // Include related data via assessmentId/proposalId
        }
    });

    if (!workspace) return null;

    // Load ROI from assessment
    const roi = await (prisma as any).roiProjection.findUnique({
        where: { assessmentId: workspace.assessmentId }
    });

    const assessment = await (prisma as any).assessment.findUnique({
        where: { id: workspace.assessmentId }
    });

    if (!roi || !assessment) return null;

    // Count tasks and modules
    const tasks = await (prisma as any).implementationTask.count({
        where: {
            workspaceId,
            organizationId: workspace.organizationId,
        },
    });
    const modules = (() => {
        try { return JSON.parse(workspace.modulesEnabled); }
        catch { return []; }
    })();

    // Go-live duration
    const goLiveDays = workspace.goLiveAt && workspace.createdAt
        ? Math.round((new Date(workspace.goLiveAt).getTime() - new Date(workspace.createdAt).getTime()) / 86400000)
        : undefined;

    return {
        operationalSavingsPerYear: roi.operationalSavingsEstimate,
        revenueIncreasePerYear: roi.revenueIncreaseEstimate,
        monthlyHoursRecovered: roi.monthlyHoursRecovered,
        paybackMonths: roi.estimatedPaybackMonths,
        confidenceLevel: roi.confidenceLevel ?? "Media",
        moduleCount: Array.isArray(modules) ? modules.length : 1,
        taskCount: tasks,
        sector: assessment.sector ?? "servicos",
        companyName: assessment.company ?? "Empresa",
        teamSize: categorizeCompanySize(Number(assessment.teamSize) || 15),
        goLiveDays,
    };
}

// ─── Core Generator ───────────────────────────────────────────────────────────

async function callAI(prompt: string): Promise<any> {
    assertAIEngineAvailable();

    let text = "";
    try {
        const response = await generateText({
            model: openai("gpt-4o-mini"),
            prompt,
            maxOutputTokens: 1400,
        });
        text = response.text;
    } catch (error) {
        if (isAIUnavailableError(error)) {
            throw toAIUnavailableError(error);
        }
        throw error;
    }

    try {
        return JSON.parse(text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
    } catch {
        return { title: "Asset gerado", headline: "", body: text, keyMetricsSummary: "" };
    }
}

// ─── Public Generation Functions ─────────────────────────────────────────────

export async function generateAuthorityAsset(
    type: AuthorityAssetType,
    workspaceId: string,
    anonLevel: AnonLevel = "full",
    orgId: string,
): Promise<any> {
    // 1. Extract real metrics
    const rawMetrics = await extractClientMetrics(workspaceId, orgId);
    if (!rawMetrics) throw new Error("Insufficient data for this workspace");

    // 2. Anonymize
    const metrics = anonymizeMetrics(rawMetrics, anonLevel);

    // 3. Generate narrative
    const prompt = ASSET_PROMPTS[type](metrics);
    const result = await callAI(prompt);

    // Build keyMetrics summary
    const keyMetrics = {
        operationalSavingsPerYear: rawMetrics.operationalSavingsPerYear,
        revenueIncreasePerYear: rawMetrics.revenueIncreasePerYear,
        monthlyHoursRecovered: rawMetrics.monthlyHoursRecovered,
        paybackMonths: rawMetrics.paybackMonths,
        moduleCount: rawMetrics.moduleCount,
        goLiveDays: rawMetrics.goLiveDays,
    };

    // 4. Save to DB
    const workspace = await (prisma as any).clientWorkspace.findUnique({ where: { id: workspaceId } });

    const asset = await (prisma as any).authorityAsset.create({
        data: {
            organizationId: orgId,
            workspaceId,
            assessmentId: workspace?.assessmentId ?? null,
            proposalId: workspace?.proposalId ?? null,
            type,
            status: "internal",
            title: result.title ?? `${type} — ${new Date().toLocaleDateString("pt-BR")}`,
            headline: result.headline ?? "",
            body: result.body ?? "",
            keyMetrics: JSON.stringify(keyMetrics),
            modules: workspace?.modulesEnabled ?? null,
            sector: rawMetrics.sector,
            companySize: rawMetrics.teamSize,
            anonLevel,
            originalData: JSON.stringify(rawMetrics),
        }
    });

    // Audit
    await (prisma as any).auditEvent.create({
        data: {
            assessmentId: workspace?.assessmentId ?? "",
            organizationId: orgId,
            action: "authorityAssetGenerated",
            details: JSON.stringify({ assetId: asset.id, type, anonLevel }),
        }
    });

    logger.info("Authority asset generated", { assetId: asset.id, type, workspaceId, orgId });
    return asset;
}

// ─── Status Transitions ───────────────────────────────────────────────────────

export const AUTHORITY_STATUS_FLOW = ["internal", "anonymized", "approved", "published"] as const;
export type AuthorityStatus = typeof AUTHORITY_STATUS_FLOW[number];

export async function updateAuthorityStatus(
    assetId: string,
    newStatus: AuthorityStatus,
    userId?: string,
    publishedUrl?: string,
): Promise<any> {
    const now = new Date();
    const data: any = { status: newStatus, updatedAt: now };

    if (newStatus === "approved") { data.approvedBy = userId; data.approvedAt = now; }
    if (newStatus === "published") { data.publishedAt = now; if (publishedUrl) data.publishedUrl = publishedUrl; }

    const asset = await (prisma as any).authorityAsset.update({
        where: { id: assetId },
        data,
    });

    // When approved, update proof statistics
    if (newStatus === "approved") {
        await updateProofStatistics(asset);
    }

    return asset;
}

// ─── Proof Statistics Library ─────────────────────────────────────────────────

/**
 * Aggregate metrics from all approved assets into ProofStatistic records
 * for use in proposals and content.
 */
async function updateProofStatistics(approvedAsset: any): Promise<void> {
    const orgId = approvedAsset.organizationId;

    // Pull all approved/published assets with metrics
    const assets = await (prisma as any).authorityAsset.findMany({
        where: { organizationId: orgId, status: { in: ["approved", "published"] } },
        select: { keyMetrics: true, sector: true }
    });

    // Parse all metrics
    const cases = assets
        .map((a: any) => { try { return JSON.parse(a.keyMetrics); } catch { return null; } })
        .filter(Boolean);

    if (cases.length === 0) return;

    const agg = aggregateStatistics(cases.map((c: any) => ({
        operationalSavingsPerYear: c.operationalSavingsPerYear ?? 0,
        revenueIncreasePerYear: c.revenueIncreasePerYear ?? 0,
        monthlyHoursRecovered: c.monthlyHoursRecovered ?? 0,
        paybackMonths: c.paybackMonths ?? 0,
        confidenceLevel: "Media",
        moduleCount: c.moduleCount ?? 1,
        taskCount: 0,
        sector: "",
        companyName: "",
        teamSize: "",
    })));

    // Upsert aggregate stats
    const statsToUpsert = [
        { label: "Payback medio", value: `${agg.avgPaybackMonths} meses`, unit: "meses" },
        { label: "Economia operacional media", value: `R$ ${Math.round(agg.avgSavingsPerYear).toLocaleString("pt-BR")}/ano`, unit: "R$/ano" },
        { label: "Horas recuperadas (media)", value: `${agg.avgHoursRecovered}h/mes`, unit: "h/mes" },
        { label: "Aumento de receita medio", value: `R$ ${Math.round(agg.avgRevenueIncrease).toLocaleString("pt-BR")}/ano`, unit: "R$/ano" },
        { label: "Cases documentados", value: `${agg.totalCases}`, unit: "cases" },
    ];

    for (const stat of statsToUpsert) {
        const existing = await (prisma as any).proofStatistic.findFirst({
            where: { organizationId: orgId, label: stat.label }
        });

        if (existing) {
            await (prisma as any).proofStatistic.update({
                where: { id: existing.id },
                data: { value: stat.value, sampleSize: agg.totalCases, lastUpdatedAt: new Date() }
            });
        } else {
            await (prisma as any).proofStatistic.create({
                data: { organizationId: orgId, ...stat, sampleSize: agg.totalCases }
            });
        }
    }

    logger.info("Proof statistics updated", { orgId, caseCount: agg.totalCases });
}

// ─── Proof Library Query ─────────────────────────────────────────────────────

/**
 * Get all approved/published assets for use in proposals and content.
 */
export async function getProofLibrary(orgId: string, type?: AuthorityAssetType) {
    const where: any = {
        organizationId: orgId,
        status: { in: ["approved", "published"] },
    };
    if (type) where.type = type;

    const [assets, stats] = await Promise.all([
        (prisma as any).authorityAsset.findMany({
            where,
            orderBy: { publishedAt: "desc" },
            select: {
                id: true, type: true, status: true, title: true, headline: true,
                sector: true, companySize: true, anonLevel: true, keyMetrics: true,
                usageCount: true, publishedAt: true, publishedUrl: true,
            }
        }),
        (prisma as any).proofStatistic.findMany({
            where: { organizationId: orgId },
            orderBy: { lastUpdatedAt: "desc" },
        })
    ]);

    return { assets, stats };
}

/**
 * Record that an asset was used in a proposal — increments usageCount.
 */
export async function recordAssetUsage(assetId: string): Promise<void> {
    await (prisma as any).authorityAsset.update({
        where: { id: assetId },
        data: { usageCount: { increment: 1 } },
    });
}
