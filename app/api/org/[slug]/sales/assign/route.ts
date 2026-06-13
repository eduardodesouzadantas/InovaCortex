import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { assignLead, autoAssign } from "@/lib/sales/assignment-engine";
import { orgContextErrorResponse, requireOrgContext } from "@/lib/auth/org-context";

async function POSTHandler(req: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const ctx = await requireOrgContext(slug).catch((error) => error);
    if (ctx instanceof Error) return orgContextErrorResponse(ctx);

    const { assessmentId, salesRepId, auto, classification } = await req.json();

    if (auto && classification) {
        const result = await autoAssign({ assessmentId, orgId: ctx.orgId, classification });
        return NextResponse.json({ assignment: result, mode: "auto" });
    }

    if (!assessmentId || !salesRepId) {
        return NextResponse.json({ error: "assessmentId and salesRepId required" }, { status: 400 });
    }

    const assignment = await assignLead({ assessmentId, orgId: ctx.orgId, salesRepId, assignedByUserId: ctx.userId });
    return NextResponse.json({ assignment, mode: "manual" }, { status: 201 });
}

export const POST = withApiLogging("/api/org/[slug]/sales/assign", "POST", POSTHandler);
