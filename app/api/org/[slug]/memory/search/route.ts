import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { hasRole } from "@/lib/auth/rbac";
import { retrieve } from "@/lib/memory/retrieve";
import { orgContextErrorResponse, requireOrgContext } from "@/lib/auth/org-context";

/** POST /api/org/[slug]/memory/search */
async function POSTHandler(request: Request, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const ctx = await requireOrgContext(slug).catch((error) => error);
    if (ctx instanceof Error) return orgContextErrorResponse(ctx);
    if (!hasRole(ctx.role, "admin")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

    const { query, topK = 8 } = await request.json();
    if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

    const results = await retrieve(ctx.orgId, query, topK);
    return NextResponse.json({ results });
}

export const POST = withApiLogging("/api/org/[slug]/memory/search", "POST", POSTHandler);
