import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import {
    startSequence,
    sendNextStep,
    getFunnelMetrics,
    pauseSequence,
    resumeSequence,
    markConverted,
    markOptedOut,
} from "@/lib/funnel-sequence";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * POST /api/admin/sequences
 * Trigger a new sequence for an assessment.
 * Body: { assessmentId, action?: "start" | "next" | "pause" | "resume" | "convert" | "optout" }
 */
export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try { assertRole(session.role, "closer"); }
    catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

    const { assessmentId, action, sequenceId, closerName, dossierLink, proposalLink } = await request.json();

    // Validate assessment belongs to org
    const assessment = await (prisma as any).assessment.findFirst({
        where: { id: assessmentId, organizationId: session.orgId }
    });
    if (!assessment && action === "start") {
        return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    try {
        switch (action ?? "start") {
            case "start": {
                const result = await startSequence(assessmentId, session.orgId);
                if (result.created) {
                    // Auto-send first step
                    await sendNextStep(result.sequence.id, { closerName, dossierLink });
                }
                return NextResponse.json({ success: true, ...result });
            }
            case "next": {
                const result = await sendNextStep(sequenceId, { closerName, dossierLink, proposalLink });
                return NextResponse.json({ success: true, ...result });
            }
            case "pause": { await pauseSequence(sequenceId); return NextResponse.json({ success: true }); }
            case "resume": { await resumeSequence(sequenceId); return NextResponse.json({ success: true }); }
            case "convert": { await markConverted(sequenceId); return NextResponse.json({ success: true }); }
            case "optout": { await markOptedOut(sequenceId); return NextResponse.json({ success: true }); }
            default:
                return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
    } catch (err) {
        logger.error("Sequence action failed", { action, error: String(err), orgId: session.orgId });
        return NextResponse.json({ error: "Action failed" }, { status: 500 });
    }
}

/**
 * GET /api/admin/sequences
 * List all sequences for the org with conversion metrics.
 */
export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const take = 25;

    const where: any = { organizationId: session.orgId };
    if (status) where.status = status;

    const [sequences, total, metrics] = await Promise.all([
        (prisma as any).leadSequence.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * take,
            take,
            include: {
                steps: { select: { status: true, sentAt: true } }
            }
        }),
        (prisma as any).leadSequence.count({ where }),
        getFunnelMetrics(session.orgId),
    ]);

    // Enrich with assessment data
    const assessmentIds = sequences.map((s: any) => s.assessmentId);
    const assessments = assessmentIds.length > 0
        ? await (prisma as any).assessment.findMany({
            where: { id: { in: assessmentIds } },
            select: { id: true, company: true, contactName: true, scoreTotal: true, classification: true },
        })
        : [];
    const aMap: Record<string, any> = {};
    for (const a of assessments) aMap[a.id] = a;

    const enriched = sequences.map((s: any) => ({
        ...s,
        assessment: aMap[s.assessmentId] ?? null,
        stepCount: s.steps.length,
        lastStepAt: s.steps.reduce((latest: any, step: any) => {
            if (!step.sentAt) return latest;
            return (!latest || step.sentAt > latest) ? step.sentAt : latest;
        }, null),
    }));

    return NextResponse.json({ sequences: enriched, total, metrics, page, totalPages: Math.ceil(total / take) });
}
