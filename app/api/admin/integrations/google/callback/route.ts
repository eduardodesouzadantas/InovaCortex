import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { exchangeGoogleCode } from "@/lib/integrations/google-calendar";
import { prisma } from "@/lib/prisma";

async function GETHandler(req: Request) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error || !code || !state) {
        return new NextResponse(`OAuth Error: ${error ?? "missing code or state"}`, { status: 400 });
    }

    let orgId: string;
    let orgSlug: string;
    try {
        const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
        orgId = decoded.orgId;

        // Resolve slug for redirect
        const org = await (prisma as any).organization.findUnique({ where: { id: orgId } });
        orgSlug = org?.slug ?? "default";
    } catch {
        return new NextResponse("Invalid state parameter", { status: 400 });
    }

    try {
        await exchangeGoogleCode(code, orgId);
    } catch (err: any) {
        const redirectError = `/org/${orgSlug}/admin/integrations/google?error=${encodeURIComponent(err.message)}`;
        return NextResponse.redirect(new URL(redirectError, req.url));
    }

    // Redirect to the integrations page after success
    return NextResponse.redirect(new URL(`/org/${orgSlug}/admin/integrations/google?connected=1`, req.url));
}

export const GET = withApiLogging("/api/admin/integrations/google/callback", "GET", GETHandler);
