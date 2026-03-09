import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertRole } from "@/lib/auth/rbac";
import { writeAuditEvent } from "@/lib/audit";
import { listMaskedMetaSettings, sanitizeMetaSettingInputs, upsertMetaSettings } from "@/lib/whatsapp/meta-settings";

export const runtime = "nodejs";

function authErrorResponse(error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (message === "ORG_NOT_FOUND") return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    if (typeof message === "string" && message.startsWith("FORBIDDEN")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    try {
        const { orgId, role } = await requireOrgContext((await params).slug);
        assertRole(role, "admin");

        const settings = await listMaskedMetaSettings(orgId);
        return NextResponse.json({ settings }, { status: 200 });
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    try {
        const { orgId, role, userId } = await requireOrgContext((await params).slug);
        assertRole(role, "admin");

        const body = await request.json().catch(() => null);
        const parsed = sanitizeMetaSettingInputs(body);
        if (!parsed.ok) {
            return NextResponse.json({ error: parsed.error }, { status: 400 });
        }

        const result = await upsertMetaSettings(orgId, parsed.settings);

        await writeAuditEvent({
            organizationId: orgId,
            action: "tenantMetaSettingsUpdated",
            details: {
                keys: result.updatedKeys,
                actorUserId: userId,
                scope: "tenant",
            },
            strict: false,
            context: { keys: result.updatedKeys.length },
        });

        return NextResponse.json({ success: true, updatedKeys: result.updatedKeys }, { status: 200 });
    } catch (error) {
        return authErrorResponse(error) ?? NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
