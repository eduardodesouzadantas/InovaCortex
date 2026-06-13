import { withApiLogging } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { sendAssessmentDossierWhatsApp } from "@/lib/whatsapp/assessment-send";

export const runtime = "nodejs";

async function POSTHandler(request: NextRequest) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "closer",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!access.auth?.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const assessmentId = typeof body?.assessmentId === "string" ? body.assessmentId : "";

    if (!assessmentId) {
        return NextResponse.json({ error: "assessmentId required" }, { status: 400 });
    }

    const result = await sendAssessmentDossierWhatsApp({
        assessmentId,
        expectedOrganizationId: access.auth.organizationId,
    });

    if (!result.ok) {
        return NextResponse.json({ error: result.error, detail: result.details }, { status: result.status });
    }

    return NextResponse.json({ success: true, messageId: result.messageId }, { status: 200 });
}

export const POST = withApiLogging("/api/agency/whatsapp/send", "POST", POSTHandler);
