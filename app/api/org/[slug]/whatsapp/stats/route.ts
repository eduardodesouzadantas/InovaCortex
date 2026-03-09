import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import { calculateInboxStats } from "@/lib/whatsapp/engines/metrics-engine";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { orgId } = await requireOrgContext((await params).slug);
        const stats = await calculateInboxStats(orgId);
        return NextResponse.json(stats, { status: 200 });
    } catch (e: any) {
        if (e?.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (e?.message === "ORG_NOT_FOUND") return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        if (typeof e?.message === "string" && e.message.startsWith("FORBIDDEN")) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        console.error("GET /stats Error:", e);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
