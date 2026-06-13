import { withApiLogging } from "@/lib/logger";
import { NextRequest } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import { tenantContextErrorResponse } from "@/lib/auth/tenant-route";
import { canOpenRealtimeConnection, createRealtimeEventStream } from "@/lib/realtime/event-stream";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function GETHandler(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> },
) {
    const { slug } = await params;

    let auth;
    try {
        auth = await requireOrgContext(slug);
    } catch (error) {
        return tenantContextErrorResponse(error) ?? new Response("Unauthorized", { status: 401 });
    }

    const limit = canOpenRealtimeConnection(auth.orgId);
    if (!limit.ok) {
        return new Response(JSON.stringify({
            error: "Too many open realtime connections",
            code: limit.reason === "org_limit" ? "ORG_CONNECTION_LIMIT" : "GLOBAL_CONNECTION_LIMIT",
        }), {
            status: 429,
            headers: { "content-type": "application/json; charset=utf-8" },
        });
    }

    const lastEventId = req.headers.get("last-event-id");
    const stream = createRealtimeEventStream(auth.orgId, req.signal, lastEventId);

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}

export const GET = withApiLogging("/api/org/[slug]/realtime/events", "GET", GETHandler);
