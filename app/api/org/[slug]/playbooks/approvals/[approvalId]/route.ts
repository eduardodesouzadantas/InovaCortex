import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { orgContextErrorResponse, requireOrgContext } from "@/lib/auth/org-context";
import { hasRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

async function PATCHHandler(req: NextRequest, { params }: { params: Promise<{ slug: string, approvalId: string }> }) {
    try {
        const { slug, approvalId } = await params;
        const { orgId, role, userId } = await requireOrgContext(slug);
        if (!hasRole(role, "admin")) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }

        const { status, note, actorUserId } = await req.json() as {
            status?: string;
            note?: string;
            actorUserId?: string;
        };

        const approval = await prisma.playbookApproval.findUnique({
            where: { id: approvalId },
        });

        if (!approval || approval.organizationId !== orgId) {
            return NextResponse.json({ error: "Approval not found" }, { status: 404 });
        }

        if (status !== "approved" && status !== "rejected") {
            return NextResponse.json({ error: "Invalid status" }, { status: 400 });
        }

        await prisma.playbookApproval.update({
            where: { id: approval.id },
            data: {
                status,
                note,
                decidedAt: new Date(),
            },
        });

        if (status === "approved") {
            // Re-enqueue the run by dispatching a playbook_run but pointing to the paused resumeRunId
            await prisma.actionQueue.create({
                data: {
                    organizationId: orgId,
                    type: "playbook_run",
                    priority: "high",
                    payloadJson: JSON.stringify({
                        playbookId: "resume-only", // The playbook-executor handles this when resumeRunId is present
                        actorUserId: actorUserId ?? userId,
                        resumeRunId: approval.playbookRunId,
                    }),
                },
            });
        } else {
            // Mark run as canceled
            await prisma.playbookRun.update({
                where: { id: approval.playbookRunId },
                data: { status: "canceled", finishedAt: new Date() },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof Error && ["UNAUTHENTICATED", "ORG_NOT_FOUND", "FORBIDDEN"].includes(error.message)) {
            return orgContextErrorResponse(error);
        }
        return NextResponse.json({ error: "Failed to update approval" }, { status: 500 });
    }
}

export const PATCH = withApiLogging("/api/org/[slug]/playbooks/approvals/[approvalId]", "PATCH", PATCHHandler);
