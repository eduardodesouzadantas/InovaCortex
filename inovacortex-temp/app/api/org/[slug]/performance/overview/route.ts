
import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { computeOrgKPIs, WindowKey } from "@/lib/performance/stats-engine";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const window = (searchParams.get("window") as WindowKey) || "7d";

    try {
        const ctx = await requireOrgContext(slug);
        assertRole(ctx.role, "admin");

        const overview = await computeOrgKPIs(ctx.orgId, window);
        return NextResponse.json(overview);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: err.message === "FORBIDDEN" ? 403 : 401 });
    }
}
