import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { sendAssessmentDossierWhatsApp } from "@/lib/whatsapp/assessment-send";

export const runtime = "nodejs";

const LEGACY_WHATSAPP_SEND_SUNSET = "Wed, 30 Sep 2026 23:59:59 GMT";

function applyLegacyWhatsAppSendDeprecationHeaders<T extends NextResponse>(response: T): T {
    response.headers.set("Deprecation", "true");
    response.headers.set("Sunset", LEGACY_WHATSAPP_SEND_SUNSET);
    response.headers.set("X-Inova-Legacy-Api", "/api/whatsapp/send");
    response.headers.set("X-Inova-Successor-Path", "/api/agency/whatsapp/send");
    return response;
}

export async function POST(request: NextRequest) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "closer",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) {
        return applyLegacyWhatsAppSendDeprecationHeaders(
            NextResponse.json({ error: access.error }, { status: access.status }),
        );
    }
    if (!access.auth?.organizationId) {
        return applyLegacyWhatsAppSendDeprecationHeaders(
            NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        );
    }

    const body = await request.json().catch(() => ({}));
    const assessmentId = typeof body?.assessmentId === "string" ? body.assessmentId : "";

    if (!assessmentId) {
        return applyLegacyWhatsAppSendDeprecationHeaders(
            NextResponse.json({ error: "assessmentId required" }, { status: 400 }),
        );
    }

    const result = await sendAssessmentDossierWhatsApp({
        assessmentId,
        expectedOrganizationId: access.auth.organizationId,
    });

    if (!result.ok) {
        return applyLegacyWhatsAppSendDeprecationHeaders(
            NextResponse.json({ error: result.error, detail: result.details }, { status: result.status }),
        );
    }

    return applyLegacyWhatsAppSendDeprecationHeaders(
        NextResponse.json({ success: true, messageId: result.messageId }, { status: 200 }),
    );
}
