import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";
import {
    assertTenantRole,
    invalidTenantInputResponse,
    resolveTenantRouteError,
} from "@/lib/auth/tenant-route";

type PlaybookRunBody = {
    actorUserId?: string;
    dryRun?: boolean;
    inputJson?: unknown;
    playbookId?: string;
};

async function POSTHandler(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params;
        const { orgId, role, userId } = await requireOrgContext(slug);
        assertTenantRole(role, "admin");

        const body = await req.json().catch(() => null) as PlaybookRunBody | null;
        if (!body || typeof body.playbookId !== "string" || !body.playbookId.trim()) {
            return invalidTenantInputResponse("playbookId is required");
        }

        // Enqueue a playbook_run ActionQueue job
        const job = await prisma.actionQueue.create({
            data: {
                organizationId: orgId,
                type: "playbook_run",
                priority: "high", // Manual runs get high priority
                payloadJson: JSON.stringify({
                    playbookId: body.playbookId,
                    actorUserId: typeof body.actorUserId === "string" ? body.actorUserId : userId,
                    dryRun: !!body.dryRun,
                    inputJson: body.inputJson ?? null,
                }),
            },
        });

        return NextResponse.json({ queued: true, jobId: job.id });
    } catch (error) {
        return resolveTenantRouteError(error, "Failed to queue playbook run");
    }
}

export const POST = withApiLogging("/api/org/[slug]/playbooks/run", "POST", POSTHandler);
