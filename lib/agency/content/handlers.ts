/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { z } from "zod";
import {
    generateLinkedInPost,
    generateInstagramPost,
    generateCaseBreakdown,
    generateAuthorityThread,
    generateVideoScript,
    ContentEngineError,
    CONTENT_STATUS_FLOW,
    updateContentStatus,
    type ContentType,
    type ContentStatus,
} from "@/lib/content-engine";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { fromZodError, isAIUnavailableError, toAIUnavailableError } from "@/lib/http/route-errors";

const CONTENT_TYPES = ["linkedin", "instagram", "case_breakdown", "authority_thread", "video_script"] as const;

const generateContentSchema = z.object({
    type: z.enum(CONTENT_TYPES),
    assessmentId: z.string().trim().min(1).optional(),
    proposalId: z.string().trim().min(1).optional(),
});

const updateContentArtifactStatusSchema = z.object({
    id: z.string().trim().min(1),
    status: z.enum(CONTENT_STATUS_FLOW),
});

const GENERATORS: Record<ContentType, (input: any) => Promise<any>> = {
    linkedin: generateLinkedInPost,
    instagram: generateInstagramPost,
    case_breakdown: generateCaseBreakdown,
    authority_thread: generateAuthorityThread,
    video_script: generateVideoScript,
};

const CONTENT_REUSE_WINDOW_MS = 10 * 60 * 1000;

function parseJsonRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "string") return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : {};
    } catch {
        return {};
    }
}

function parseJsonArray(value: unknown): string[] {
    if (!value || typeof value !== "string") return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    } catch {
        return [];
    }
}

function toStructuredContentPayload(artifact: any) {
    return {
        id: artifact.id,
        organizationId: artifact.organizationId,
        assessmentId: artifact.assessmentId ?? null,
        proposalId: artifact.proposalId ?? null,
        type: artifact.type,
        status: artifact.status,
        title: artifact.title,
        hook: artifact.hook ?? null,
        body: artifact.body,
        cta: artifact.cta,
        hashtags: parseJsonArray(artifact.hashtags),
        metadata: parseJsonRecord(artifact.metadata),
        sourceInsight: artifact.sourceInsight,
        roiSnapshot: artifact.roiSnapshot ? parseJsonRecord(artifact.roiSnapshot) : null,
        version: artifact.version,
        createdAt: artifact.createdAt,
        updatedAt: artifact.updatedAt,
    };
}

export async function generateContentHandler(
    orgId: string,
    userId: string | null,
    body: unknown,
): Promise<NextResponse> {
    const parsed = generateContentSchema.safeParse(body);
    if (!parsed.success) {
        throw fromZodError(parsed.error);
    }
    const { type, assessmentId, proposalId } = parsed.data;

    if (assessmentId) {
        const assessment = await (prisma as any).assessment.findFirst({
            where: { id: assessmentId, organizationId: orgId },
            select: { id: true },
        });
        if (!assessment) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    if (proposalId) {
        const proposal = await prisma.proposal.findFirst({
            where: {
                id: proposalId,
                assessment: { organizationId: orgId },
            },
            select: { id: true },
        });
        if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    try {
        const recentArtifact = await (prisma as any).contentArtifact.findFirst({
            where: {
                organizationId: orgId,
                type,
                assessmentId: assessmentId ?? null,
                proposalId: proposalId ?? null,
                createdAt: {
                    gte: new Date(Date.now() - CONTENT_REUSE_WINDOW_MS),
                },
            },
            orderBy: { createdAt: "desc" },
        });

        if (recentArtifact) {
            logger.info("Content artifact reused from cache", {
                type,
                artifactId: recentArtifact.id,
                orgId,
            });

            return NextResponse.json({
                success: true,
                artifact: recentArtifact,
                content: toStructuredContentPayload(recentArtifact),
                cached: true,
            });
        }

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

        return NextResponse.json({
            success: true,
            artifact,
            content: toStructuredContentPayload(artifact),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        logger.error("Content generation failed", { type, error: message, orgId });

        if (isAIUnavailableError(error)) {
            throw toAIUnavailableError(error);
        }

        if (error instanceof ContentEngineError && error.code === "CONTENT_MODEL_GENERATION_FAILED") {
            throw toAIUnavailableError(error);
        }

        throw error;
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
    body: unknown,
): Promise<NextResponse> {
    const parsed = updateContentArtifactStatusSchema.safeParse(body);
    if (!parsed.success) {
        throw fromZodError(parsed.error);
    }
    const { id, status } = parsed.data;

    const artifact = await (prisma as any).contentArtifact.findFirst({
        where: { id, organizationId: orgId },
        select: { id: true, status: true },
    });
    if (!artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (status === "posted" && artifact.status !== "approved") {
        return NextResponse.json({ error: "Conteudo precisa ser aprovado antes de postar." }, { status: 400 });
    }

    const updated = await updateContentStatus(id, status as ContentStatus, userId ?? undefined);
    return NextResponse.json({ success: true, artifact: updated });
}
