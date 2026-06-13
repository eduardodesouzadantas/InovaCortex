import { withApiLogging } from "@/lib/logger";
import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/auth/org-context";
import { assertTenantRole, invalidTenantInputResponse, resolveTenantRouteError } from "@/lib/auth/tenant-route";
import { writeAuditEvent } from "@/lib/audit";
import { listMaskedMetaSettings, sanitizeMetaSettingInputs, upsertMetaSettings } from "@/lib/whatsapp/meta-settings";

export const runtime = "nodejs";

async function GETHandler(
    _request: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    try {
        const { orgId, role } = await requireOrgContext((await params).slug);
        assertTenantRole(role, "admin");

        const settings = await listMaskedMetaSettings(orgId);
        return NextResponse.json({ settings }, { status: 200 });
    } catch (error) {
        return resolveTenantRouteError(error, "Failed to load Meta settings");
    }
}

async function POSTHandler(
    request: Request,
    { params }: { params: Promise<{ slug: string }> },
) {
    try {
        const { orgId, role, userId } = await requireOrgContext((await params).slug);
        assertTenantRole(role, "admin");

        const body = await request.json().catch(() => null);
        const parsed = sanitizeMetaSettingInputs(body);
        if (!parsed.ok) {
            return invalidTenantInputResponse(parsed.error);
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
        return resolveTenantRouteError(error, "Failed to update Meta settings");
    }
}

export const GET = withApiLogging("/api/org/[slug]/whatsapp/config/meta", "GET", GETHandler);
export const POST = withApiLogging("/api/org/[slug]/whatsapp/config/meta", "POST", POSTHandler);
