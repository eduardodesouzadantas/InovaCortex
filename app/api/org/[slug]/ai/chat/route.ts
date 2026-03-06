import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ChatEngine } from "@/lib/ai/chat-engine";
import { CommandEngine } from "@/lib/ai/command-engine";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";
import { logger } from "@/lib/logger";

/**
 * POST /api/org/[slug]/ai/chat
 * Unified endpoint for Chat and Commands with Auth + RBAC.
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const body = await request.json();
        const { message, sessionId, scope = "admin" } = body;

        // 1. Auth & RBAC Check
        const session = await getSession();
        if (!session || session.orgSlug !== slug) {
            return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        }

        if (!hasRole(session.role, "admin")) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }

        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        const org = await prisma.organization.findUnique({
            where: { slug },
            select: { id: true, name: true }
        });
        if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

        // 2. Resolve or Create Session
        let chatSession;
        if (sessionId) {
            chatSession = await (prisma as any).aIChatSession.findUnique({ where: { id: sessionId } });
        } else {
            chatSession = await (prisma as any).aIChatSession.findFirst({
                where: { organizationId: org.id, scope: scope }
            });
        }

        if (!chatSession) {
            chatSession = await (prisma as any).aIChatSession.create({
                data: {
                    organizationId: org.id,
                    scope: scope,
                    title: scope === "ceo" ? "CEO Room" : "Admin Room",
                    createdByUserId: session.userId
                }
            });
        }

        // 3. Routing (Command vs Chat)
        const parsed = CommandEngine.parseInput(message);

        if (parsed.type === "command") {
            const result = await CommandEngine.executeCommand(
                org.id,
                session.userId,
                session.role,
                parsed.command!,
                parsed.args
            );

            // Persistent log for Command
            await (prisma as any).aIChatMessage.createMany({
                data: [
                    {
                        sessionId: chatSession.id,
                        organizationId: org.id,
                        role: "user",
                        content: message,
                        command: parsed.command
                    },
                    {
                        sessionId: chatSession.id,
                        organizationId: org.id,
                        role: "assistant",
                        content: JSON.stringify(result),
                        command: parsed.command,
                        meta: { deterministic: true, cacheHit: result.meta.cached }
                    }
                ]
            });

            return NextResponse.json(result);
        }

        // 4. Fallback to Chat Engine
        const chatResult = await ChatEngine.answerChat(
            org.id,
            chatSession.id,
            session.userId,
            scope as "admin" | "ceo",
            message
        );

        return NextResponse.json(chatResult);

    } catch (error: any) {
        logger.error("AI Unified Chat Error", { error: error.message });
        return NextResponse.json({ error: "Intelligence failure" }, { status: 500 });
    }
}
