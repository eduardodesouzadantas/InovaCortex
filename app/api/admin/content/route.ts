import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertRole } from "@/lib/auth/rbac";
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

export const runtime = "nodejs";

const GENERATORS: Record<ContentType, (input: any) => Promise<any>> = {
    linkedin: generateLinkedInPost,
    instagram: generateInstagramPost,
    case_breakdown: generateCaseBreakdown,
    authority_thread: generateAuthorityThread,
    video_script: generateVideoScript,
};

/**
 * POST /api/admin/content
 * Generate a new content artifact.
 * Body: { type, assessmentId?, proposalId? }
 */
export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try { assertRole(session.role, "admin"); }
    catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

    const body = await request.json();
    const { type, assessmentId, proposalId } = body;

    if (!GENERATORS[type as ContentType]) {
        return NextResponse.json({
            error: `Invalid type. Must be: ${Object.keys(GENERATORS).join(", ")}`
        }, { status: 400 });
    }

    // Validate assessmentId belongs to org if provided
    if (assessmentId) {
        const assessment = await (prisma as any).assessment.findFirst({
            where: { id: assessmentId, organizationId: session.orgId }
        });
        if (!assessment) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    try {
        const generator = GENERATORS[type as ContentType];
        const artifact = await generator({
            assessmentId,
            proposalId,
            orgId: session.orgId,
            userId: session.userId,
        });

        logger.info("Content artifact generated", {
            type, artifactId: artifact.id, orgId: session.orgId,
        });

        return NextResponse.json({ success: true, artifact });
    } catch (err) {
        logger.error("Content generation failed", { type, error: String(err), orgId: session.orgId });
        return NextResponse.json({ error: "Generation failed. Check OPENAI_API_KEY." }, { status: 500 });
    }
}

/**
 * GET /api/admin/content
 * List content artifacts for the current org.
 */
export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const take = 20;

    const where: any = { organizationId: session.orgId };
    if (type) where.type = type;
    if (status) where.status = status;

    const [artifacts, total] = await Promise.all([
        (prisma as any).contentArtifact.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * take,
            take,
            select: {
                id: true, type: true, status: true, title: true,
                version: true, sourceInsight: true, createdAt: true,
                scheduledFor: true, postedAt: true,
            }
        }),
        (prisma as any).contentArtifact.count({ where }),
    ]);

    return NextResponse.json({ artifacts, total, page, totalPages: Math.ceil(total / take) });
}

/**
 * PATCH /api/admin/content/[id]
 * Update status with audit guard.
 */
export async function PATCH(request: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id, status } = await request.json();

    const artifact = await (prisma as any).contentArtifact.findFirst({
        where: { id, organizationId: session.orgId }
    });
    if (!artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Guard: posting requires approval
    if (status === "posted" && artifact.status !== "approved") {
        return NextResponse.json({ error: "Conteúdo precisa ser aprovado antes de postar." }, { status: 400 });
    }

    const updated = await updateContentStatus(id, status as ContentStatus, session.userId);
    return NextResponse.json({ success: true, artifact: updated });
}
