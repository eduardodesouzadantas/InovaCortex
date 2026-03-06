import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string, approvalId: string }> }) {
    try {
        const org = await prisma.organization.findUnique({ where: { slug: (await params).slug } });
        if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

        const { status, note, actorUserId } = await req.json();

        const approval = await prisma.playbookApproval.findUnique({
            where: { id: (await params).approvalId },
        });

        if (!approval || approval.organizationId !== org.id) {
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
                    organizationId: org.id,
                    type: "playbook_run",
                    priority: "high",
                    payloadJson: JSON.stringify({
                        playbookId: "resume-only", // The playbook-executor handles this when resumeRunId is present
                        actorUserId,
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
    } catch (error: any) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
