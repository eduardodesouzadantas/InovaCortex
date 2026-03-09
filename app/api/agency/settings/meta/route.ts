import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/admin-api-guard";
import { writeAuditEvent } from "@/lib/audit";
import { listMaskedMetaSettings, sanitizeMetaSettingInputs, upsertMetaSettings } from "@/lib/whatsapp/meta-settings";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!access.auth?.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const settings = await listMaskedMetaSettings(access.auth.organizationId);
    return NextResponse.json({ settings }, { status: 200 });
}

export async function POST(request: NextRequest) {
    const access = await requireAdminApiAccess(request, {
        requiredRole: "admin",
        allowLegacyTokenFallback: false,
    });
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!access.auth?.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json().catch(() => null);
    const parsed = sanitizeMetaSettingInputs(body);
    if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await upsertMetaSettings(access.auth.organizationId, parsed.settings);

    await writeAuditEvent({
        organizationId: access.auth.organizationId,
        action: "agencyMetaSettingsUpdated",
        details: {
            keys: result.updatedKeys,
            actorUserId: access.auth.userId,
            scope: "agency",
        },
        strict: false,
        context: { keys: result.updatedKeys.length },
    });

    return NextResponse.json({ success: true, updatedKeys: result.updatedKeys }, { status: 200 });
}
