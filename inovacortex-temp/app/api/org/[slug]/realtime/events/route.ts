import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgContext } from "@/lib/auth/org-context";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Set route max duration for Vercel

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;

    // 1. Resolve Org and Auth
    const org = await prisma.organization.findUnique({
        where: { slug },
    });

    if (!org) {
        return new Response(JSON.stringify({ error: "Org not found" }), { status: 404 });
    }

    // To secure the SSE stream, ensure the user requesting has valid admin/owner session
    // Note: if checkAuth redirects or throws, wrap carefully.
    let auth;
    try {
        auth = await requireOrgContext(slug);
    } catch (e) {
        return new Response("Unauthorized", { status: 401 });
    }

    // 2. Setup Server-Sent Events stream
    let lastPolledAt = new Date();

    const stream = new ReadableStream({
        async start(controller) {
            // Send an initial connected ping
            controller.enqueue('event: connected\ndata: {"status": "ok"}\n\n');

            // Poll interval function
            const pollEvents = async () => {
                try {
                    // Fetch any new events since the last tick
                    const incomingEvents = await (prisma as any).systemEvent.findMany({
                        where: {
                            organizationId: org.id,
                            createdAt: { gt: lastPolledAt },
                        },
                        orderBy: { createdAt: "asc" },
                    });

                    if (incomingEvents.length > 0) {
                        // Update timestamp
                        lastPolledAt = incomingEvents[incomingEvents.length - 1].createdAt;

                        // Enqueue all newly found events
                        for (const event of incomingEvents) {
                            controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
                        }
                    }
                } catch (err) {
                    console.error("SSE Poll error", err);
                    clearInterval(interval);
                    controller.close();
                }
            };

            const interval = setInterval(pollEvents, 2000); // Poll DB every 2s

            // Close stream if client disconnects
            req.signal.addEventListener("abort", () => {
                clearInterval(interval);
                controller.close();
            });
        },
    });

    // 3. Return as a stream
    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
        },
    });
}
