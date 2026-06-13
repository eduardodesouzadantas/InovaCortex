import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CommandEngine } from "@/lib/ai/command-engine";
import { hasRole } from "@/lib/auth/rbac";
import { withApiLogging } from "@/lib/logger";
import { z } from "zod";
import { readValidatedJson } from "@/lib/http/route-errors";
import { orgContextErrorResponse, requireOrgContext } from "@/lib/auth/org-context";

const commandRequestSchema = z.object({
    command: z.string().trim().min(1),
    args: z.string().optional().default(""),
    sessionId: z.string().trim().min(1).optional(),
    scope: z.enum(["admin", "ceo"]).default("admin"),
});

/**
 * POST /api/org/[slug]/ai/command
 * 100% Deterministic command endpoint with Auth + RBAC.
 */
async function POSTHandler(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    const { command, args, sessionId, scope } = await readValidatedJson(request, commandRequestSchema);

    const ctx = await requireOrgContext(slug).catch((error) => error);
    if (ctx instanceof Error) return orgContextErrorResponse(ctx);

    if (!hasRole(ctx.role, "admin")) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    let chatSession;
    if (sessionId) {
        chatSession = await (prisma as any).aIChatSession.findFirst({
            where: {
                id: sessionId,
                organizationId: ctx.orgId,
            },
            select: { id: true },
        });
    } else {
        chatSession = await (prisma as any).aIChatSession.findFirst({
            where: { organizationId: ctx.orgId, scope },
            select: { id: true },
        });
    }

    if (!chatSession) {
        chatSession = await (prisma as any).aIChatSession.create({
            data: {
                organizationId: ctx.orgId,
                scope,
                title: scope === "ceo" ? "CEO Room" : "Admin Room",
                createdByUserId: ctx.userId,
            },
            select: { id: true },
        });
    }

    const result = await CommandEngine.executeCommand(
        ctx.orgId,
        ctx.userId,
        ctx.role,
        command,
        args,
    );

    await (prisma as any).aIChatMessage.createMany({
        data: [
            {
                sessionId: chatSession.id,
                organizationId: ctx.orgId,
                role: "user",
                content: `${command} ${args}`.trim(),
                command,
            },
            {
                sessionId: chatSession.id,
                organizationId: ctx.orgId,
                role: "assistant",
                content: JSON.stringify(result),
                command,
                meta: { deterministic: true, cacheHit: result.meta.cached },
            },
        ],
    });

    return NextResponse.json(result);
}

export const POST = withApiLogging("/api/org/[slug]/ai/command", "POST", POSTHandler);
