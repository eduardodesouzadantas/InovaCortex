import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const org = await prisma.organization.findUnique({ where: { slug: (await params).slug } });
        if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

        const { playbookId, actorUserId, dryRun, inputJson } = await req.json();

        // Enqueue a playbook_run ActionQueue job
        const job = await prisma.actionQueue.create({
            data: {
                organizationId: org.id,
                type: "playbook_run",
                priority: "high", // Manual runs get high priority
                payloadJson: JSON.stringify({
                    playbookId,
                    actorUserId,
                    dryRun: !!dryRun,
                    inputJson,
                }),
            },
        });

        return NextResponse.json({ queued: true, jobId: job.id });
    } catch (error: any) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
