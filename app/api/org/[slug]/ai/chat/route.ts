import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ChatEngine } from "@/lib/ai/chat-engine";
import { CommandEngine } from "@/lib/ai/command-engine";
import { hasRole } from "@/lib/auth/rbac";
import { orgContextErrorResponse, requireOrgContext } from "@/lib/auth/org-context";
import { readValidatedJson } from "@/lib/http/route-errors";
import { withApiLogging } from "@/lib/logger";

const chatRequestSchema = z.object({
    message: z.string().trim().min(1),
    sessionId: z.string().trim().min(1).optional(),
    scope: z.enum(["admin", "ceo"]).default("admin"),
});

async function POSTHandler(
    request: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;
    const { message, sessionId, scope } = await readValidatedJson(request, chatRequestSchema);

    const ctx = await requireOrgContext(slug).catch((error) => error);
    if (ctx instanceof Error) return orgContextErrorResponse(ctx);
    if (!hasRole(ctx.role, "admin")) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const existingSession = sessionId
        ? await prisma.aIChatSession.findFirst({
            where: {
                id: sessionId,
                organizationId: ctx.orgId,
            },
            select: { id: true },
        })
        : await prisma.aIChatSession.findFirst({
            where: { organizationId: ctx.orgId, scope },
            select: { id: true },
        });

    const chatSession = existingSession ?? await prisma.aIChatSession.create({
        data: {
            organizationId: ctx.orgId,
            scope,
            title: scope === "ceo" ? "CEO Room" : "Admin Room",
            createdByUserId: ctx.userId,
        },
        select: { id: true },
    });

    const parsed = CommandEngine.parseInput(message);

    if (parsed.type === "command" && parsed.command) {
        const result = await CommandEngine.executeCommand(
            ctx.orgId,
            ctx.userId,
            ctx.role,
            parsed.command,
            parsed.args,
        );

        await prisma.aIChatMessage.createMany({
            data: [
                {
                    sessionId: chatSession.id,
                    organizationId: ctx.orgId,
                    role: "user",
                    content: message,
                    command: parsed.command,
                },
                {
                    sessionId: chatSession.id,
                    organizationId: ctx.orgId,
                    role: "assistant",
                    content: JSON.stringify(result),
                    command: parsed.command,
                    meta: JSON.stringify({ deterministic: true, cacheHit: result.meta.cached }),
                },
            ],
        });

        return NextResponse.json(result);
    }

    const chatResult = await ChatEngine.answerChat(
        ctx.orgId,
        chatSession.id,
        ctx.userId,
        scope,
        message,
    );

    return NextResponse.json(chatResult);
}

export const POST = withApiLogging("/api/org/[slug]/ai/chat", "POST", POSTHandler);
