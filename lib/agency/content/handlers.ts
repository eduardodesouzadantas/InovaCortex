/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import {
    generateLinkedInPost,
    generateInstagramPost,
    generateCaseBreakdown,
    generateAuthorityThread,
    generateVideoScript,
    updateContentStatus,
    type ContentType,
    type ContentStatus,
} from "@/lib/content-engine";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const GENERATORS: Record<ContentType, (input: any) => Promise<any>> = {
    linkedin: generateLinkedInPost,
    instagram: generateInstagramPost,
    case_breakdown: generateCaseBreakdown,
    authority_thread: generateAuthorityThread,
    video_script: generateVideoScript,
};

export async function generateContentHandler(
    orgId: string,
    userId: string | null,
    body: {
        type?: string;
        assessmentId?: string;
        proposalId?: string;
    },
): Promise<NextResponse> {
    const { type, assessmentId, proposalId } = body;

    if (!type || !GENERATORS[type as ContentType]) {
        return NextResponse.json(
            { error: `Invalid type. Must be: ${Object.keys(GENERATORS).join(", ")}` },
            { status: 400 },
        );
    }

    if (assessmentId) {
        const assessment = await (prisma as any).assessment.findFirst({
            where: { id: assessmentId, organizationId: orgId },
        });
        if (!assessment) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    try {
        const generator = GENERATORS[type as ContentType];
        const artifact = await generator({
            assessmentId,
            proposalId,
            orgId,
            userId: userId ?? undefined,
        });

        logger.info("Content artifact generated", {
            type,
            artifactId: artifact.id,
            orgId,
        });

        return NextResponse.json({ success: true, artifact });
    } catch (error) {
        logger.error("Content generation failed", { type, error: String(error), orgId });
        return NextResponse.json({ error: "Generation failed. Check OPENAI_API_KEY." }, { status: 500 });
    }
}

export async function listContentArtifactsHandler(
    orgId: string,
    query: {
        type?: string | null;
        status?: string | null;
        page?: number;
    },
): Promise<NextResponse> {
    const page = Math.max(1, Number(query.page ?? 1));
    const take = 20;

    const where: any = { organizationId: orgId };
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;

    const [artifacts, total] = await Promise.all([
        (prisma as any).contentArtifact.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * take,
            take,
            select: {
                id: true,
                type: true,
                status: true,
                title: true,
                version: true,
                sourceInsight: true,
                createdAt: true,
                scheduledFor: true,
                postedAt: true,
            },
        }),
        (prisma as any).contentArtifact.count({ where }),
    ]);

    return NextResponse.json({
        artifacts,
        total,
        page,
        totalPages: Math.ceil(total / take),
    });
}

export async function updateContentArtifactStatusHandler(
    orgId: string,
    userId: string | null,
    body: {
        id?: string;
        status?: string;
    },
): Promise<NextResponse> {
    const { id, status } = body;
    if (!id || !status) {
        return NextResponse.json({ error: "id and status are required" }, { status: 400 });
    }

    const artifact = await (prisma as any).contentArtifact.findFirst({
        where: { id, organizationId: orgId },
    });
    if (!artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (status === "posted" && artifact.status !== "approved") {
        return NextResponse.json({ error: "Conteudo precisa ser aprovado antes de postar." }, { status: 400 });
    }

    const updated = await updateContentStatus(id, status as ContentStatus, userId ?? undefined);
    return NextResponse.json({ success: true, artifact: updated });
}
