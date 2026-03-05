import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CommandEngine } from "@/lib/ai/command-engine";
import { getSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/rbac";
import { logger } from "@/lib/logger";

/**
 * POST /api/org/[slug]/ai/command
 * 100% Deterministic command endpoint with Auth + RBAC.
 */
export async function POST(
    request: Request,
    { params }: { params: { slug: string } }
) {
    try {
        const { slug } = params;
        const body = await request.json();
        const { command, args = "", sessionId, scope = "admin" } = body;

        // 1. Auth & RBAC Check
        const session = await getSession();
        if (!session || session.orgSlug !== slug) {
            return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
        }

        if (!hasRole(session.role, "admin")) {
            return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
        }

        if (!command) {
            return NextResponse.json({ error: "Command is required" }, { status: 400 });
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

        // 3. Execute Deterministic Command
        const result = await CommandEngine.executeCommand(
            org.id,
            session.userId,
            session.role,
            command,
            args
        );

        // 4. Persistence
        await (prisma as any).aIChatMessage.createMany({
            data: [
                {
                    sessionId: chatSession.id,
                    organizationId: org.id,
                    role: "user",
                    content: `${command} ${args}`.trim(),
                    command: command
                },
                {
                    sessionId: chatSession.id,
                    organizationId: org.id,
                    role: "assistant",
                    content: JSON.stringify(result),
                    command: command,
                    meta: { deterministic: true, cacheHit: result.meta.cached }
                }
            ]
        });

        return NextResponse.json(result);

    } catch (error: any) {
        logger.error("AI Command Execution Error", { error: error.message });
        return NextResponse.json({ error: "Command execution failed" }, { status: 500 });
    }
}
