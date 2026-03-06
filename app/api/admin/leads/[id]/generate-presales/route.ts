import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { generatePreSalesArtifacts } from "@/lib/ai/agent";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("admin_token");

        if (!token || token.value !== "authenticated_true") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const assessmentId = (await params).id;

        const assessment = await (prisma as any).assessment.findUnique({
            where: { id: assessmentId },
            include: { preSalesArtifacts: { orderBy: { version: "desc" } } }
        });

        if (!assessment) {
            return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
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

        // Call hardened AI agent (includes rate limiting, Zod validation, cost tracking)
        const result = await generatePreSalesArtifacts(assessmentId, context);

        const artifact = await (prisma as any).preSalesArtifact.create({
            data: {
                assessmentId,
                version: nextVersion,
                executiveSummary: result.executiveSummary,
                diagnosticQuestions: JSON.stringify(result.diagnosticQuestions),
                initialArchitecture: JSON.stringify(result.architectureProposal),
            }
        });

        await logAudit("presales", assessmentId, "generated", { version: nextVersion });

        logger.info("PreSales artifact saved", { assessmentId, version: nextVersion });

        return NextResponse.json({
            success: true,
            artifact: {
                ...artifact,
                diagnosticQuestions: result.diagnosticQuestions,
                initialArchitecture: result.architectureProposal,
            }
        });

    } catch (e: any) {
        logger.error("generate-presales error", { error: e?.message });

        // Surface rate limit / cooldown errors clearly
        if (e.message?.includes("Limite") || e.message?.includes("Aguarde")) {
            return NextResponse.json({ error: e.message }, { status: 429 });
        }
        if (e.message?.includes("OPENAI_API_KEY")) {
            return NextResponse.json({ error: e.message }, { status: 503 });
        }

        return NextResponse.json({ error: "Erro ao gerar artefatos de pré-venda" }, { status: 500 });
    }
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token");
    if (!token || token.value !== "authenticated_true") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const artifacts = await (prisma as any).preSalesArtifact.findMany({
        where: { assessmentId: (await params).id },
        orderBy: { version: "desc" }
    });

    return NextResponse.json({
        artifacts: artifacts.map((a: any) => ({
            ...a,
            diagnosticQuestions: JSON.parse(a.diagnosticQuestions),
            initialArchitecture: JSON.parse(a.initialArchitecture),
        }))
    });
}
