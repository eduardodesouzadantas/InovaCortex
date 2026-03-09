/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePreSalesArtifacts } from "@/lib/ai/agent";
import { generateProposal } from "@/lib/proposal-engine";
import { calculateROI } from "@/lib/roi-engine";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export async function patchLeadHandler(request: NextRequest, id: string): Promise<NextResponse> {
    try {
        const body = await request.json();

        const currentLead = await prisma.assessment.findUnique({
            where: { id },
        });

        if (!currentLead) {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }

        const updateData: any = {};
        let auditAction: string | null = null;
        let auditDetails: string | null = null;

        if (body.status && body.status !== currentLead.status) {
            updateData.status = body.status;
            auditAction = "statusChanged";
            auditDetails = JSON.stringify({ from: currentLead.status, to: body.status });
        }

        if (body.internalNotes !== undefined && body.internalNotes !== currentLead.internalNotes) {
            updateData.internalNotes = body.internalNotes;
            auditAction = auditAction ? "multipleUpdates" : "noteAdded";
        }

        const updatedLead = await prisma.$transaction(async (tx) => {
            const lead = await tx.assessment.update({
                where: { id },
                data: updateData,
            });

            if (auditAction) {
                await tx.auditEvent.create({
                    data: {
                        assessmentId: id,
                        action: auditAction,
                        details: auditDetails,
                    },
                });
            }

            return lead;
        });

        return NextResponse.json(updatedLead);
    } catch (error) {
        console.error("[LEAD_PATCH_ERROR]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function generatePresalesHandler(assessmentId: string): Promise<NextResponse> {
    try {
        const assessment = await (prisma as any).assessment.findUnique({
            where: { id: assessmentId },
            include: { preSalesArtifacts: { orderBy: { version: "desc" } } },
        });

        if (!assessment) {
            return NextResponse.json({ error: "Lead nao encontrado" }, { status: 404 });
        }

        const nextVersion = (assessment.preSalesArtifacts[0]?.version ?? 0) + 1;

        const context = {
            name: assessment.name,
            company: assessment.company,
            role: assessment.role,
            segment: assessment.segment,
            teamSize: assessment.teamSize,
            volumeDay: assessment.volumeDay,
            channels: JSON.parse(assessment.channels || "[]"),
            stack: JSON.parse(assessment.stack || "[]"),
            pains: JSON.parse(assessment.pains || "[]"),
            urgency: assessment.urgency,
            goal: assessment.goal,
            scoreTotal: assessment.scoreTotal,
            classification: assessment.classification,
            recommendedMissions: JSON.parse(assessment.recommendedMissions || "[]"),
        };

        const result = await generatePreSalesArtifacts(assessmentId, context);

        const artifact = await (prisma as any).preSalesArtifact.create({
            data: {
                assessmentId,
                version: nextVersion,
                executiveSummary: result.executiveSummary,
                diagnosticQuestions: JSON.stringify(result.diagnosticQuestions),
                initialArchitecture: JSON.stringify(result.architectureProposal),
            },
        });

        await logAudit("presales", assessmentId, "generated", { version: nextVersion });
        logger.info("PreSales artifact saved", { assessmentId, version: nextVersion });

        return NextResponse.json({
            success: true,
            artifact: {
                ...artifact,
                diagnosticQuestions: result.diagnosticQuestions,
                initialArchitecture: result.architectureProposal,
            },
        });
    } catch (error: any) {
        logger.error("generate-presales error", { error: error?.message });

        if (error.message?.includes("Limite") || error.message?.includes("Aguarde")) {
            return NextResponse.json({ error: error.message }, { status: 429 });
        }
        if (error.message?.includes("OPENAI_API_KEY")) {
            return NextResponse.json({ error: error.message }, { status: 503 });
        }

        return NextResponse.json({ error: "Erro ao gerar artefatos de pre-venda" }, { status: 500 });
    }
}

export async function listPresalesHandler(assessmentId: string): Promise<NextResponse> {
    const artifacts = await (prisma as any).preSalesArtifact.findMany({
        where: { assessmentId },
        orderBy: { version: "desc" },
    });

    return NextResponse.json({
        artifacts: artifacts.map((artifact: any) => ({
            ...artifact,
            diagnosticQuestions: JSON.parse(artifact.diagnosticQuestions),
            initialArchitecture: JSON.parse(artifact.initialArchitecture),
        })),
    });
}

export async function generateProposalHandler(assessmentId: string): Promise<NextResponse> {
    const [assessment, roiProjection, lastPreSales, existingProposals] = await Promise.all([
        (prisma as any).assessment.findUnique({ where: { id: assessmentId } }),
        (prisma as any).roiProjection.findUnique({ where: { assessmentId } }),
        (prisma as any).preSalesArtifact.findFirst({
            where: { assessmentId },
            orderBy: { version: "desc" },
        }),
        (prisma as any).proposal.findMany({
            where: { assessmentId },
            orderBy: { version: "desc" },
            take: 1,
        }),
    ]);

    if (!assessment) {
        return NextResponse.json({ error: "Lead nao encontrado" }, { status: 404 });
    }

    const existingVersion = existingProposals[0]?.version ?? 0;

    const proposal = generateProposal({
        assessment,
        roiProjection,
        lastPreSales,
        existingVersion,
    });

    const saved = await (prisma as any).proposal.create({
        data: {
            assessmentId,
            version: proposal.version,
            publicSlug: proposal.publicSlug,
            modules: JSON.stringify(proposal.modules),
            pricingEstimate: JSON.stringify(proposal.pricingEstimate),
            roiSnapshot: JSON.stringify(proposal.roiSnapshot),
            presalesSnapshot: JSON.stringify(proposal.presalesSnapshot),
            status: "draft",
        },
    });

    await logAudit("presales", assessmentId, "proposalGenerated", {
        version: proposal.version,
        modules: proposal.modules.length,
        minBRL: proposal.pricingEstimate.minBRL,
        maxBRL: proposal.pricingEstimate.maxBRL,
    });

    logger.info("Proposal generated", { assessmentId, version: proposal.version });

    return NextResponse.json({
        success: true,
        proposal: {
            ...saved,
            ...proposal,
        },
    });
}

export async function listProposalsHandler(assessmentId: string): Promise<NextResponse> {
    const proposals = await (prisma as any).proposal.findMany({
        where: { assessmentId },
        orderBy: { version: "desc" },
    });

    return NextResponse.json({
        proposals: proposals.map((proposal: any) => ({
            ...proposal,
            modules: JSON.parse(proposal.modules),
            pricingEstimate: JSON.parse(proposal.pricingEstimate),
            roiSnapshot: JSON.parse(proposal.roiSnapshot),
            presalesSnapshot: JSON.parse(proposal.presalesSnapshot),
        })),
    });
}

export async function updateProposalHandler(
    request: NextRequest,
    assessmentId: string,
): Promise<NextResponse> {
    const { proposalId, status, customNotes, modules } = await request.json();

    if (!proposalId) {
        return NextResponse.json({ error: "proposalId required" }, { status: 400 });
    }

    const updateData: any = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (customNotes !== undefined) updateData.customNotes = customNotes;
    if (modules) updateData.modules = JSON.stringify(modules);

    const updated = await (prisma as any).proposal.update({
        where: { id: proposalId },
        data: updateData,
    });

    const action = status ? "proposalStatusChanged" : "proposalUpdated";
    await logAudit("presales", assessmentId, action, { proposalId, status, customNotes: !!customNotes });

    return NextResponse.json({ success: true, proposal: updated });
}

export async function getRoiHandler(assessmentId: string): Promise<NextResponse> {
    const roi = await (prisma as any).roiProjection.findUnique({ where: { assessmentId } });
    if (!roi) {
        return NextResponse.json({ error: "Sem projecao de ROI para este lead" }, { status: 404 });
    }

    return NextResponse.json({ roi });
}

export async function updateRoiHandler(
    request: NextRequest,
    assessmentId: string,
): Promise<NextResponse> {
    const body = await request.json();
    const { avgHourlyCost, avgTicket, conversionRate } = body;

    const assessment = await (prisma as any).assessment.findUnique({
        where: { id: assessmentId },
    });

    if (!assessment) {
        return NextResponse.json({ error: "Lead nao encontrado" }, { status: 404 });
    }

    const roi = calculateROI({
        teamSize: assessment.teamSize,
        volumeDay: assessment.volumeDay,
        scoreTotal: assessment.scoreTotal,
        classification: assessment.classification,
        pains: JSON.parse(assessment.pains || "[]"),
        avgHourlyCost: avgHourlyCost ?? 80,
        avgTicket: avgTicket ?? 2000,
        conversionRate: conversionRate ?? 5,
    });

    const updated = await (prisma as any).roiProjection.upsert({
        where: { assessmentId },
        update: {
            operationalSavingsEstimate: roi.operationalSavingsEstimate,
            revenueIncreaseEstimate: roi.revenueIncreaseEstimate,
            monthlyHoursRecovered: roi.monthlyHoursRecovered,
            estimatedPaybackMonths: roi.estimatedPaybackMonths,
            confidenceLevel: roi.confidenceLevel,
            manualOverride: true,
            avgHourlyCost: avgHourlyCost ?? null,
            avgTicket: avgTicket ?? null,
            conversionRate: conversionRate ?? null,
        },
        create: {
            assessmentId,
            operationalSavingsEstimate: roi.operationalSavingsEstimate,
            revenueIncreaseEstimate: roi.revenueIncreaseEstimate,
            monthlyHoursRecovered: roi.monthlyHoursRecovered,
            estimatedPaybackMonths: roi.estimatedPaybackMonths,
            confidenceLevel: roi.confidenceLevel,
            manualOverride: true,
            avgHourlyCost: avgHourlyCost ?? null,
            avgTicket: avgTicket ?? null,
            conversionRate: conversionRate ?? null,
        },
    });

    await logAudit("presales", assessmentId, "roiAdjusted", {
        avgHourlyCost,
        avgTicket,
        conversionRate,
        savings: roi.operationalSavingsEstimate,
    });

    logger.info("ROI adjusted by admin", { assessmentId });

    return NextResponse.json({ success: true, roi: { ...updated, ...roi } });
}
